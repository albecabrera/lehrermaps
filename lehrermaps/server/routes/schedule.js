import { Router } from 'express';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT data FROM schedule LIMIT 1`);
    const data = rows[0] ? JSON.parse(rows[0].data) : {};
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    await pool.execute(`UPDATE schedule SET data = ?, updated_at = NOW() LIMIT 1`, [data]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
