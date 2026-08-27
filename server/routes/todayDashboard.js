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
  return new Date().toISOString().slice(0, 10);
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 20) return null;
  const ids = new Set();
  const normalized = [];
  for (const task of tasks) {
    const id = String(task?.id || '').trim();
    const text = String(task?.text || '').trim();
    if (!id || !text || text.length > 500 || ids.has(id)) return null;
    ids.add(id);
    normalized.push({ id, text, done: Boolean(task.done) });
  }
  return normalized;
}

router.get('/today-dashboard', async (req, res) => {
  const noteDate = validDate(req.query.date) ? req.query.date : today();
  try {
    const [taskRows] = await pool.execute(
      'SELECT tasks_json FROM today_dashboard_tasks WHERE user_id = ?',
      [getUserId(req)]
    );
    const [noteRows] = await pool.execute(
      'SELECT content FROM today_dashboard_notes WHERE user_id = ? AND note_date = ?',
      [getUserId(req), noteDate]
    );
    let tasks = [];
    try { tasks = normalizeTasks(JSON.parse(taskRows[0]?.tasks_json || '[]')) || []; } catch {}
    res.json({ tasks, note: noteRows[0]?.content || '', date: noteDate });
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
       ON CONFLICT(user_id) DO UPDATE SET tasks_json = excluded.tasks_json, updated_at = CURRENT_TIMESTAMP`,
      [getUserId(req), JSON.stringify(tasks)]
    );
    res.json({ tasks });
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
