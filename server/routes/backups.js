import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);
router.use(teacherOnly);

function getUserId(req) {
  return Number.isInteger(req.user?.user_id) ? req.user.user_id : (Number.isInteger(req.user?.id) ? req.user.id : 1);
}

async function snapshotForUser(userId) {
  const queries = {
    schedule: ['SELECT data, updated_at FROM schedule WHERE user_id = ?', [userId]],
    notebooks: ['SELECT * FROM notebooks WHERE user_id = ? ORDER BY position, id', [userId]],
    quick_notes: ['SELECT * FROM quick_notes WHERE user_id = ? ORDER BY id', [userId]],
    dashboard_tasks: ['SELECT * FROM today_dashboard_tasks WHERE user_id = ?', [userId]],
    dashboard_notes: ['SELECT * FROM today_dashboard_notes WHERE user_id = ? ORDER BY note_date', [userId]],
    bug_checklists: ['SELECT * FROM bug_checklists WHERE user_id = ?', [userId]],
    lesson_sessions: ['SELECT * FROM lesson_sessions WHERE user_id = ? ORDER BY id', [userId]],
  };
  const payload = { version: 1, exported_at: new Date().toISOString(), user_id: userId, data: {} };
  for (const [key, [sql, values]] of Object.entries(queries)) {
    const [rows] = await pool.execute(sql, values);
    payload.data[key] = rows;
  }
  const [sections] = await pool.execute(
    'SELECT s.* FROM sections s JOIN notebooks n ON n.id = s.notebook_id WHERE n.user_id = ? ORDER BY s.id', [userId]
  );
  const [pages] = await pool.execute(
    'SELECT p.* FROM pages p JOIN sections s ON s.id = p.section_id JOIN notebooks n ON n.id = s.notebook_id WHERE n.user_id = ? ORDER BY p.id', [userId]
  );
  const [blocks] = await pool.execute(
    'SELECT b.* FROM blocks b JOIN pages p ON p.id = b.page_id JOIN sections s ON s.id = p.section_id JOIN notebooks n ON n.id = s.notebook_id WHERE n.user_id = ? ORDER BY b.id', [userId]
  );
  payload.data.sections = sections;
  payload.data.pages = pages;
  payload.data.blocks = blocks;
  const [lessonPhases] = await pool.execute(
    'SELECT p.* FROM lesson_phases p JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE s.user_id = ? ORDER BY p.id', [userId]
  );
  const [lessonCanvases] = await pool.execute(
    'SELECT c.* FROM lesson_phase_canvases c JOIN lesson_phases p ON p.id = c.phase_id JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE s.user_id = ? ORDER BY c.id', [userId]
  );
  const [lessonCanvasElements] = await pool.execute(
    'SELECT e.* FROM lesson_phase_elements e JOIN lesson_phase_canvases c ON c.id = e.canvas_id JOIN lesson_phases p ON p.id = c.phase_id JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE s.user_id = ? ORDER BY e.id', [userId]
  );
  payload.data.lesson_phases = lessonPhases;
  payload.data.lesson_phase_canvases = lessonCanvases;
  payload.data.lesson_phase_elements = lessonCanvasElements;
  return payload;
}

router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const payload = await snapshotForUser(userId);
    const [result] = await pool.execute('INSERT INTO user_backups (user_id, payload_json) VALUES (?, ?)', [userId, JSON.stringify(payload)]);
    res.status(201).json({ id: result.insertId, created_at: payload.exported_at, payload });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, created_at FROM user_backups WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30', [getUserId(req)]);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, created_at, payload_json FROM user_backups WHERE id = ? AND user_id = ?', [req.params.id, getUserId(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Backup nicht gefunden' });
    res.json({ id: rows[0].id, created_at: rows[0].created_at, payload: JSON.parse(rows[0].payload_json) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;
