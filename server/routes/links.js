import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/:folder_id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT li.* FROM links li JOIN folders fo ON fo.id = li.folder_id WHERE li.folder_id = ? AND fo.is_archived = 0 ORDER BY li.created_at DESC', [req.params.folder_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', teacherOnly, async (req, res) => {
  const { folder_id, title, url } = req.body;
  if (!folder_id || !title || !url) return res.status(400).json({ error: 'folder_id, title und url erforderlich' });
  try {
    const [folders] = await pool.execute('SELECT id FROM folders WHERE id = ? AND is_archived = 0', [folder_id]);
    if (!folders.length) return res.status(404).json({ error: 'Zielordner nicht gefunden' });
    const [result] = await pool.execute(
      'INSERT INTO links (folder_id, title, url) VALUES (?, ?, ?)',
      [folder_id, title, url]
    );
    const [rows] = await pool.execute('SELECT * FROM links WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
