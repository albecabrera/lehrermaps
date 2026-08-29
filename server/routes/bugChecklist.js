import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
const USER_ID = 1;
const MAX_ITEMS = 100;
const MAX_ID_LENGTH = 128;
const MAX_TEXT_LENGTH = 1000;

router.use(auth);
router.use(teacherOnly);

function normalizeItems(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).length !== 1 || !Object.hasOwn(payload, 'items')
    || !Array.isArray(payload.items) || payload.items.length > MAX_ITEMS) return null;

  const ids = new Set();
  const items = [];
  for (const item of payload.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).length !== 3
      || !Object.hasOwn(item, 'id') || !Object.hasOwn(item, 'text') || !Object.hasOwn(item, 'completed')
      || typeof item.id !== 'string' || !item.id.trim() || item.id.length > MAX_ID_LENGTH
      || typeof item.text !== 'string' || item.text.length > MAX_TEXT_LENGTH
      || typeof item.completed !== 'boolean' || ids.has(item.id)) return null;
    ids.add(item.id);
    items.push({ id: item.id, text: item.text, completed: item.completed });
  }
  return items;
}

router.get('/bug-checklist', async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT items_json FROM bug_checklists WHERE user_id = ?', [USER_ID]);
    let items = [];
    try { items = normalizeItems({ items: JSON.parse(rows[0]?.items_json || '[]') }) || []; } catch {}
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/bug-checklist', async (req, res) => {
  const items = normalizeItems(req.body);
  if (!items) return res.status(400).json({ error: 'Invalid bug checklist payload' });

  try {
    await pool.execute(
      `INSERT INTO bug_checklists (user_id, items_json) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET items_json = excluded.items_json, updated_at = CURRENT_TIMESTAMP`,
      [USER_ID, JSON.stringify(items)]
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
