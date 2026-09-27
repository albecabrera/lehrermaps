import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

const userIdFor = (req) => Number(req.user?.id) || 1;

router.get('/app-rail', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT app_rail_order_json FROM app_preferences WHERE user_id = ?',
      [userIdFor(req)]
    );
    const order = rows[0]?.app_rail_order_json ? JSON.parse(rows[0].app_rail_order_json) : [];
    res.json({ order: Array.isArray(order) ? order : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/app-rail', teacherOnly, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0 || order.some((id) => typeof id !== 'string' || id.length > 80)) {
    return res.status(400).json({ error: 'order array required' });
  }
  try {
    await pool.execute(`
      INSERT INTO app_preferences (user_id, app_rail_order_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        app_rail_order_json = excluded.app_rail_order_json,
        updated_at = CURRENT_TIMESTAMP
    `, [userIdFor(req), JSON.stringify(order)]);
    res.json({ ok: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
