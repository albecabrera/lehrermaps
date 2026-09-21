import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';
import { openTaskCount, parseSchedule, safeAppointment, scheduleSummary, validDate } from '../lib/widgetToday.js';

const router = Router();
const MAX_SCHEDULE_BYTES = 256 * 1024;

router.use((req, res, next) => {
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization Bearer token required' });
  }
  return next();
});
router.use(auth);
router.use(teacherOnly);

function getUserId(req) {
  return Number.isInteger(req.user?.user_id)
    ? req.user.user_id
    : (Number.isInteger(req.user?.id) ? req.user.id : 1);
}

router.get('/today', async (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid date; expected YYYY-MM-DD' });
  try {
    const userId = getUserId(req);
    const generatedAt = new Date();
    const offset = generatedAt.getTimezoneOffset() * 60_000;
    const localDate = new Date(generatedAt.getTime() - offset).toISOString().slice(0, 10);
    const appointmentCutoff = date === localDate
      ? `${String(generatedAt.getHours()).padStart(2, '0')}:${String(generatedAt.getMinutes()).padStart(2, '0')}`
      : '';
    const [scheduleRows] = await pool.execute(
      'SELECT substr(data, 1, ?) AS data, length(data) AS data_length FROM schedule WHERE user_id = ? LIMIT 1',
      [MAX_SCHEDULE_BYTES + 1, userId]
    );
    const [taskRows] = await pool.execute(
      'SELECT substr(tasks_json, 1, 32769) AS tasks_json FROM today_dashboard_tasks WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const [appointmentRows] = await pool.execute(
      `SELECT exam_date, exam_time FROM exams
       WHERE exam_date > ? OR (exam_date = ? AND (? = '' OR exam_time IS NULL OR exam_time = '' OR substr(exam_time, 1, 5) >= ?))
       ORDER BY exam_date ASC, CASE WHEN exam_time IS NULL OR exam_time = '' THEN 1 ELSE 0 END ASC, exam_time ASC LIMIT 10`,
      [date, date, appointmentCutoff, appointmentCutoff]
    );
    const scheduleData = Number(scheduleRows[0]?.data_length || 0) <= MAX_SCHEDULE_BYTES
      ? parseSchedule(scheduleRows[0]?.data)
      : {};
    res.set('Cache-Control', 'private, no-store');
    res.json({
      version: 1,
      date,
      generatedAt: generatedAt.toISOString(),
      schedule: scheduleSummary(scheduleData, date, generatedAt),
      openTaskCount: openTaskCount(taskRows[0]?.tasks_json || '[]'),
      nextAppointment: safeAppointment(appointmentRows),
    });
  } catch {
    res.status(500).json({ error: 'Widget data unavailable' });
  }
});

export default router;
