import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

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
    const [rows] = await pool.execute(`SELECT data FROM schedule LIMIT 1`);
    const data = rows[0] ? parseSchedule(rows[0].data) : {};
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', teacherOnly, async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    await pool.execute(`UPDATE schedule SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM schedule ORDER BY id LIMIT 1)`, [data]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
