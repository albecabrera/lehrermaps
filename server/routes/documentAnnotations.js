import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

const parse = (value) => { try { return value ? JSON.parse(value) : {}; } catch { return {}; } };
const json = (value) => JSON.stringify(value ?? {});

async function existingFile(fileId) {
  const [rows] = await pool.execute('SELECT id FROM files WHERE id = ?', [fileId]);
  return rows[0] || null;
}

function serialize(row) {
  return { ...row, data: parse(row.data_json), style: parse(row.style_json) };
}

router.get('/files/:fileId/annotations', teacherOnly, async (req, res) => {
  try {
    if (!await existingFile(req.params.fileId)) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const [rows] = await pool.execute('SELECT * FROM document_annotations WHERE file_id = ? AND user_id = ? ORDER BY page_number, id', [req.params.fileId, req.user?.id || 1]);
    res.json(rows.map(serialize));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/files/:fileId/annotation-history', teacherOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM document_annotation_history WHERE file_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [req.params.fileId, req.user?.id || 1]);
    res.json(rows.map(serialize));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/files/:fileId/annotations', teacherOnly, async (req, res) => {
  try {
    if (!await existingFile(req.params.fileId)) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const body = req.body || {};
    const page = Math.max(1, Number(body.page_number) || 1);
    const allowed = ['ink', 'highlight', 'rectangle', 'text', 'eraser'];
    const type = allowed.includes(body.type) ? body.type : 'ink';
    const [result] = await pool.execute('INSERT INTO document_annotations (file_id, user_id, page_number, type, data_json, style_json) VALUES (?, ?, ?, ?, ?, ?)', [req.params.fileId, req.user?.id || 1, page, type, json(body.data), json(body.style)]);
    const [rows] = await pool.execute('SELECT * FROM document_annotations WHERE id = ?', [result.insertId]);
    res.status(201).json(serialize(rows[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/document-annotations/:id', teacherOnly, async (req, res) => {
  try {
    const [owned] = await pool.execute('SELECT * FROM document_annotations WHERE id = ? AND user_id = ?', [req.params.id, req.user?.id || 1]);
    if (!owned.length) return res.status(404).json({ error: 'Annotation nicht gefunden' });
    await pool.execute('INSERT INTO document_annotation_history (annotation_id, file_id, user_id, page_number, type, data_json, style_json, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [owned[0].id, owned[0].file_id, owned[0].user_id, owned[0].page_number, owned[0].type, owned[0].data_json, owned[0].style_json, 'update']);
    const sets = [];
    const values = [];
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'data')) { sets.push('data_json = ?'); values.push(json(req.body.data)); }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'style')) { sets.push('style_json = ?'); values.push(json(req.body.style)); }
    if (!sets.length) return res.status(400).json({ error: 'Keine Änderungen' });
    await pool.execute(`UPDATE document_annotations SET ${sets.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    const [rows] = await pool.execute('SELECT * FROM document_annotations WHERE id = ?', [req.params.id]);
    res.json(serialize(rows[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/document-annotations/:id', teacherOnly, async (req, res) => {
  try {
    const [owned] = await pool.execute('SELECT * FROM document_annotations WHERE id = ? AND user_id = ?', [req.params.id, req.user?.id || 1]);
    if (!owned.length) return res.status(404).json({ error: 'Annotation nicht gefunden' });
    await pool.execute('INSERT INTO document_annotation_history (annotation_id, file_id, user_id, page_number, type, data_json, style_json, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [owned[0].id, owned[0].file_id, owned[0].user_id, owned[0].page_number, owned[0].type, owned[0].data_json, owned[0].style_json, 'delete']);
    await pool.execute('DELETE FROM document_annotations WHERE id = ? AND user_id = ?', [req.params.id, req.user?.id || 1]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;
