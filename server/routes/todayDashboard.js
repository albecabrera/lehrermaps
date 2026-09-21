import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);
router.use(teacherOnly);

function getUserId(req) {
  return Number.isInteger(req.user?.user_id) ? req.user.user_id : 1;
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validDueTime(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validDueDate(value) {
  return validDate(value) && value >= '2000-01-01' && value <= '2099-12-31';
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 20) return null;
  const ids = new Set();
  const normalized = [];
  for (const task of tasks) {
    const id = String(task?.id || '').trim();
    const text = String(task?.text || '').trim();
    if (!id || id.length > 100 || !text || text.length > 500 || ids.has(id) || typeof task?.done !== 'boolean') return null;
    ids.add(id);
    const hasDueDate = task?.dueDate !== undefined;
    const hasDueTime = task?.dueTime !== undefined;
    if ((hasDueDate && !validDueDate(task.dueDate)) || (hasDueTime && (!hasDueDate || !validDueTime(task.dueTime)))) return null;
    normalized.push({ id, text, done: Boolean(task.done), ...(hasDueDate ? { dueDate: task.dueDate } : {}), ...(hasDueTime ? { dueTime: task.dueTime } : {}) });
  }
  return normalized;
}

router.get('/today-dashboard', async (req, res) => {
  const noteDate = validDate(req.query.date) ? req.query.date : today();
  try {
    const [taskRows] = await pool.execute(
      'SELECT tasks_json, updated_at FROM today_dashboard_tasks WHERE user_id = ?',
      [getUserId(req)]
    );
    const [noteRows] = await pool.execute(
      'SELECT content FROM today_dashboard_notes WHERE user_id = ? AND note_date = ?',
      [getUserId(req), noteDate]
    );
    let tasks = [];
    try { tasks = normalizeTasks(JSON.parse(taskRows[0]?.tasks_json || '[]')) || []; } catch {}
    res.json({ tasks, tasksUpdatedAt: taskRows[0]?.updated_at || null, note: noteRows[0]?.content || '', date: noteDate });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/today-dashboard/tasks', async (req, res) => {
  const tasks = normalizeTasks(req.body?.tasks);
  if (!tasks) return res.status(400).json({ error: 'Invalid tasks payload' });
  try {
    await pool.execute(
      `INSERT INTO today_dashboard_tasks (user_id, tasks_json) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET tasks_json = excluded.tasks_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [getUserId(req), JSON.stringify(tasks)]
    );
    const [rows] = await pool.execute('SELECT updated_at FROM today_dashboard_tasks WHERE user_id = ?', [getUserId(req)]);
    res.json({ tasks, updatedAt: rows[0]?.updated_at || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/today-dashboard/note', async (req, res) => {
  const noteDate = validDate(req.body?.date) ? req.body.date : null;
  const content = typeof req.body?.content === 'string' ? req.body.content : null;
  if (!noteDate || content === null || content.length > 10000) {
    return res.status(400).json({ error: 'Invalid note payload' });
  }
  try {
    await pool.execute(
      `INSERT INTO today_dashboard_notes (user_id, note_date, content) VALUES (?, ?, ?)
       ON CONFLICT(user_id, note_date) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
      [getUserId(req), noteDate, content]
    );
    res.json({ date: noteDate, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
