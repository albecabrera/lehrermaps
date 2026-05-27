import { Router } from 'express';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM exams ORDER BY exam_date ASC, exam_time ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { title, class_name, subject, exam_date, exam_time, notes } = req.body;
  if (!title || !class_name || !exam_date) {
    return res.status(400).json({ error: 'title, class_name und exam_date sind erforderlich' });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO exams (title, class_name, subject, exam_date, exam_time, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, class_name, subject || null, exam_date, exam_time || null, notes || null]
    );
    const [rows] = await pool.execute(`SELECT * FROM exams WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { title, class_name, subject, exam_date, exam_time, notes } = req.body;
  try {
    await pool.execute(
      `UPDATE exams SET title=?, class_name=?, subject=?, exam_date=?, exam_time=?, notes=?
       WHERE id=?`,
      [title, class_name, subject || null, exam_date, exam_time || null, notes || null, req.params.id]
    );
    const [rows] = await pool.execute(`SELECT * FROM exams WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute(`DELETE FROM exams WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
