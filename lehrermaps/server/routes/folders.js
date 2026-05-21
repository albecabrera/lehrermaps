import { Router } from 'express';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

const FOLDER_WITH_COUNT = `
  SELECT f.*, COUNT(fi.id) AS file_count
  FROM folders f
  LEFT JOIN files fi ON fi.folder_id = f.id
  WHERE f.id = ?
  GROUP BY f.id
`;

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT f.*, COUNT(fi.id) AS file_count, COALESCE(SUM(fi.size_bytes), 0) AS total_size_bytes,
        (SELECT fi2.id FROM files fi2 WHERE fi2.folder_id = f.id AND fi2.mime_type LIKE 'image/%' ORDER BY fi2.uploaded_at DESC LIMIT 1) AS thumbnail_file_id
      FROM folders f
      LEFT JOIN files fi ON fi.folder_id = f.id
      GROUP BY f.id
      ORDER BY f.subject, f.group_name, f.parent_id, f.sort_order, f.name
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { subject, group_name, name, parent_id } = req.body;
  if (!subject || !group_name || !name) {
    return res.status(400).json({ error: 'subject, group_name und name erforderlich' });
  }
  const pid = parent_id ? Number(parent_id) : null;
  try {
    if (pid) {
      const [check] = await pool.execute('SELECT id FROM folders WHERE id = ?', [pid]);
      if (!check.length) return res.status(400).json({ error: 'Überordner nicht gefunden' });
    }
    const [result] = await pool.execute(
      'INSERT INTO folders (subject, group_name, name, parent_id) VALUES (?, ?, ?, ?)',
      [subject, group_name, name, pid]
    );
    const [rows] = await pool.execute(
      'SELECT *, 0 AS file_count, 0 AS total_size_bytes FROM folders WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Must come before /:id
router.put('/reorder', async (req, res) => {
  const { items } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { id, sort_order } of items) {
      await conn.execute('UPDATE folders SET sort_order = ? WHERE id = ?', [sort_order, id]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

router.put('/:id/favorite', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE folders SET is_favorite = IF(is_favorite=1, 0, 1) WHERE id = ?',
      [req.params.id]
    );
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name erforderlich' });
  try {
    await pool.execute('UPDATE folders SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/notes', async (req, res) => {
  const { content } = req.body;
  try {
    await pool.execute('UPDATE folders SET notes = ? WHERE id = ?', [content ?? '', req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/color', async (req, res) => {
  const { color } = req.body;
  try {
    await pool.execute('UPDATE folders SET color = ? WHERE id = ?', [color || null, req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/deadline', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  const { due_at } = req.body;
  try {
    await pool.execute('UPDATE folders SET due_at = ? WHERE id = ?', [due_at || null, req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM folders WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
