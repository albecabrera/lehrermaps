import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/:folder_id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      req.user?.role === 'student'
        ? 'SELECT id, folder_id, title, url FROM links WHERE folder_id = ? AND is_shared = 1 ORDER BY created_at DESC'
        : 'SELECT * FROM links WHERE folder_id = ? ORDER BY created_at DESC',
      [req.params.folder_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', teacherOnly, async (req, res) => {
  const { folder_id, title, url, is_shared = false } = req.body;
  if (!folder_id || !title || !url) return res.status(400).json({ error: 'folder_id, title und url erforderlich' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO links (folder_id, title, url, is_shared) VALUES (?, ?, ?, ?)',
      [folder_id, title, url, is_shared ? 1 : 0]
    );
    const [rows] = await pool.execute('SELECT * FROM links WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/share', teacherOnly, async (req, res) => {
  try {
    const [result] = await pool.execute('UPDATE links SET is_shared = IF(is_shared = 1, 0, 1) WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Link nicht gefunden' });
    const [rows] = await pool.execute('SELECT * FROM links WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', teacherOnly, async (req, res) => {
  try {
    await pool.execute('DELETE FROM links WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
