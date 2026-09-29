import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);
router.use(teacherOnly);

const BACKUP_ERROR = 'Unable to process the backup request';

function sendBackupError(res, error, context) {
  console.error(`[backups] ${context}`, error);
  if (!res.headersSent) res.status(500).json({ error: BACKUP_ERROR });
}

function getUserId(req) {
  return Number.isInteger(req.user?.user_id) ? req.user.user_id : (Number.isInteger(req.user?.id) ? req.user.id : 1);
}

async function snapshotForUser(userId) {
  const queries = {
    schedule: ['SELECT data, updated_at FROM schedule WHERE user_id = ?', [userId]],
    dashboard_tasks: ['SELECT * FROM today_dashboard_tasks WHERE user_id = ?', [userId]],
    dashboard_notes: ['SELECT * FROM today_dashboard_notes WHERE user_id = ? ORDER BY note_date', [userId]],
    bug_checklists: ['SELECT * FROM bug_checklists WHERE user_id = ?', [userId]],
    lesson_sessions: ['SELECT * FROM lesson_sessions WHERE user_id = ? ORDER BY id', [userId]],
    reflection_boards: ['SELECT * FROM reflection_boards WHERE user_id = ?', [userId]],
  };
  const payload = { version: 1, exported_at: new Date().toISOString(), user_id: userId, data: {} };
  for (const [key, [sql, values]] of Object.entries(queries)) {
    const [rows] = await pool.execute(sql, values);
    payload.data[key] = rows;
  }
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
  const [reflectionItems] = await pool.execute(
    'SELECT i.* FROM reflection_items i JOIN reflection_boards b ON b.id = i.board_id WHERE b.user_id = ? ORDER BY i.board_id, i.sort_order, i.id', [userId]
  );
  payload.data.reflection_items = reflectionItems;
  return payload;
}

router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const payload = await snapshotForUser(userId);
    const [result] = await pool.execute('INSERT INTO user_backups (user_id, payload_json) VALUES (?, ?)', [userId, JSON.stringify(payload)]);
    res.status(201).json({ id: result.insertId, created_at: payload.exported_at, payload });
  } catch (error) { sendBackupError(res, error, 'create failed'); }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, created_at FROM user_backups WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30', [getUserId(req)]);
    res.json(rows);
  } catch (error) { sendBackupError(res, error, 'list failed'); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, created_at, payload_json FROM user_backups WHERE id = ? AND user_id = ?', [req.params.id, getUserId(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Backup nicht gefunden' });
    res.json({ id: rows[0].id, created_at: rows[0].created_at, payload: JSON.parse(rows[0].payload_json) });
  } catch (error) { sendBackupError(res, error, 'load failed'); }
});

export default router;
