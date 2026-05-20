import { Router } from 'express';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/:folder_id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM links WHERE folder_id = ? ORDER BY created_at DESC',
      [req.params.folder_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { folder_id, title, url } = req.body;
  if (!folder_id || !title || !url) return res.status(400).json({ error: 'folder_id, title und url erforderlich' });
  try {
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

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM links WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
