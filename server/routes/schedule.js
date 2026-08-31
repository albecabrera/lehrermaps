import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

function getUserId(req) {
  return Number.isInteger(req.user?.user_id) ? req.user.user_id : (Number.isInteger(req.user?.id) ? req.user.id : 1);
}

function parseSchedule(data) {
  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch {
    // An older import persisted the JSON with every quote escaped (e.g.
    // {\"0-0\": …}) instead of storing JSON text directly.  Keep accepting
    // those rows so the recovered timetable is available without data loss.
    try {
      return JSON.parse(data.replaceAll('\\"', '"'));
    } catch {
      return {};
    }
  }
}

router.get('/', async (req, res) => {
  try {
    if (req.user?.role === 'student') return res.json({});
    const userId = getUserId(req);
    const [rows] = await pool.execute('SELECT data FROM schedule WHERE user_id = ?', [userId]);
    const data = rows[0] ? parseSchedule(rows[0].data) : {};
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', teacherOnly, async (req, res) => {
  try {
    const data = JSON.stringify(req.body || {});
    await pool.execute(
      `INSERT INTO schedule (user_id, data) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
      [getUserId(req), data]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
