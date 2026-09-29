import { Router } from 'express';
import PDFDocument from 'pdfkit';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);
router.use(teacherOnly);

const CATEGORIES = new Set(['koffer', 'muellkorb', 'unklar']);
const MAX_CONTENT_LENGTH = 2000;
const REFLECTION_BOARD_ERROR = 'Unable to process the reflection board request';

function sendReflectionBoardError(res, error, context) {
  console.error(`[reflection-board] ${context}`, error);
  if (!res.headersSent) res.status(500).json({ error: REFLECTION_BOARD_ERROR });
}

function getUserId(req) {
  return Number.isInteger(req.user?.user_id) ? req.user.user_id : (Number.isInteger(req.user?.id) ? req.user.id : 1);
}

function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeMetadata(body = {}) {
  const metadata = {
    subject: cleanText(body.subject, 120),
    className: cleanText(body.className, 120),
    topic: cleanText(body.topic, 240),
    date: cleanText(body.date, 10),
  };
  return validDate(metadata.date) ? metadata : null;
}

async function ensureBoard(userId) {
  await pool.execute('INSERT OR IGNORE INTO reflection_boards (user_id) VALUES (?)', [userId]);
  const [rows] = await pool.execute('SELECT * FROM reflection_boards WHERE user_id = ?', [userId]);
  return rows[0];
}

async function readBoard(userId) {
  const board = await ensureBoard(userId);
  const [items] = await pool.execute(
    'SELECT id, category, content, likes, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM reflection_items WHERE board_id = ? ORDER BY sort_order, id',
    [board.id]
  );
  return {
    id: board.id,
    metadata: { subject: board.subject, className: board.class_name, topic: board.topic, date: board.reflection_date },
    question: board.current_question,
    items,
    updatedAt: board.updated_at,
  };
}

function boardAndItemQuery(itemId, userId) {
  return pool.execute(
    'SELECT i.id, i.board_id FROM reflection_items i JOIN reflection_boards b ON b.id = i.board_id WHERE i.id = ? AND b.user_id = ?',
    [itemId, userId]
  );
}

router.get('/reflection-board', async (req, res) => {
  try { res.json(await readBoard(getUserId(req))); }
  catch (error) { sendReflectionBoardError(res, error, 'load failed'); }
});

router.put('/reflection-board', async (req, res) => {
  const userId = getUserId(req);
  const metadata = req.body?.metadata ? normalizeMetadata(req.body.metadata) : null;
  const question = req.body?.question === undefined ? undefined : cleanText(req.body.question, 500);
  if (req.body?.metadata && !metadata) return res.status(400).json({ error: 'Invalid reflection metadata' });
  if (question === undefined && !metadata) return res.status(400).json({ error: 'Empty reflection update' });
  try {
    const board = await ensureBoard(userId);
    if (metadata) await pool.execute('UPDATE reflection_boards SET subject = ?, class_name = ?, topic = ?, reflection_date = ? WHERE id = ? AND user_id = ?', [metadata.subject, metadata.className, metadata.topic, metadata.date, board.id, userId]);
    if (question !== undefined) await pool.execute('UPDATE reflection_boards SET current_question = ? WHERE id = ? AND user_id = ?', [question, board.id, userId]);
    res.json(await readBoard(userId));
  } catch (error) { sendReflectionBoardError(res, error, 'update failed'); }
});

router.post('/reflection-board/items', async (req, res) => {
  const category = String(req.body?.category || '');
  const content = cleanText(req.body?.content, MAX_CONTENT_LENGTH);
  if (!CATEGORIES.has(category) || !content) return res.status(400).json({ error: 'A category and content are required' });
  try {
    const board = await ensureBoard(getUserId(req));
    const [last] = await pool.execute('SELECT COALESCE(MAX(sort_order), -1) AS sortOrder FROM reflection_items WHERE board_id = ? AND category = ?', [board.id, category]);
    const [result] = await pool.execute('INSERT INTO reflection_items (board_id, category, content, sort_order) VALUES (?, ?, ?, ?)', [board.id, category, content, Number(last[0]?.sortOrder || -1) + 1]);
    const [rows] = await pool.execute('SELECT id, category, content, likes, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM reflection_items WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) { sendReflectionBoardError(res, error, 'create item failed'); }
});

router.patch('/reflection-board/items/:id', async (req, res) => {
  const category = req.body?.category === undefined ? undefined : String(req.body.category);
  const content = req.body?.content === undefined ? undefined : cleanText(req.body.content, MAX_CONTENT_LENGTH);
  const sortOrder = req.body?.sortOrder === undefined ? undefined : Number(req.body.sortOrder);
  if (category !== undefined && !CATEGORIES.has(category)) return res.status(400).json({ error: 'Invalid category' });
  if (content !== undefined && !content) return res.status(400).json({ error: 'Content is required' });
  if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000)) return res.status(400).json({ error: 'Invalid sort order' });
  try {
    const userId = getUserId(req);
    const [owned] = await boardAndItemQuery(req.params.id, userId);
    if (!owned.length) return res.status(404).json({ error: 'Reflection item not found' });
    const updates = [];
    const values = [];
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(sortOrder); }
    if (updates.length) await pool.execute(`UPDATE reflection_items SET ${updates.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    const [rows] = await pool.execute('SELECT id, category, content, likes, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM reflection_items WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) { sendReflectionBoardError(res, error, 'update item failed'); }
});

router.delete('/reflection-board/items/:id', async (req, res) => {
  try {
    const [owned] = await boardAndItemQuery(req.params.id, getUserId(req));
    if (!owned.length) return res.status(404).json({ error: 'Reflection item not found' });
    await pool.execute('DELETE FROM reflection_items WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) { sendReflectionBoardError(res, error, 'delete item failed'); }
});

router.post('/reflection-board/items/:id/like', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'UPDATE reflection_items SET likes = likes + 1 WHERE id = ? AND board_id IN (SELECT id FROM reflection_boards WHERE user_id = ?)',
      [req.params.id, getUserId(req)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Reflection item not found' });
    const [rows] = await pool.execute('SELECT id, likes FROM reflection_items WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) { sendReflectionBoardError(res, error, 'like item failed'); }
});

router.post('/reflection-board/reset', async (req, res) => {
  const preserveMetadata = req.body?.preserveMetadata !== false;
  const metadata = req.body?.metadata ? normalizeMetadata(req.body.metadata) : null;
  if (req.body?.metadata && !metadata) return res.status(400).json({ error: 'Invalid reflection metadata' });
  try {
    const userId = getUserId(req);
    const board = await ensureBoard(userId);
    pool.transaction((connection) => {
      connection.execute('DELETE FROM reflection_items WHERE board_id = ?', [board.id]);
      if (preserveMetadata && metadata) connection.execute('UPDATE reflection_boards SET subject = ?, class_name = ?, topic = ?, reflection_date = ?, current_question = ? WHERE id = ? AND user_id = ?', [metadata.subject, metadata.className, metadata.topic, metadata.date, '', board.id, userId]);
      else if (preserveMetadata) connection.execute("UPDATE reflection_boards SET current_question = '' WHERE id = ? AND user_id = ?", [board.id, userId]);
      else connection.execute("UPDATE reflection_boards SET subject = '', class_name = '', topic = '', reflection_date = '', current_question = '' WHERE id = ? AND user_id = ?", [board.id, userId]);
    });
    res.json(await readBoard(userId));
  } catch (error) { sendReflectionBoardError(res, error, 'reset failed'); }
});

router.get('/reflection-board/export.pdf', async (req, res) => {
  try {
    const board = await readBoard(getUserId(req));
    const labels = { koffer: 'Koffer · Das nehme ich mit', muellkorb: 'Müllkorb · Das können wir verbessern', unklar: 'Noch unklar' };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="koffer-oder-muellkorb.pdf"');
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Koffer oder Müllkorb?', Author: 'Lehrermaps' } });
    doc.pipe(res);
    doc.fontSize(22).fillColor('#173b66').text('Koffer oder Müllkorb?', { continued: false });
    doc.fontSize(11).fillColor('#52677b').text('Was nehmen wir aus der heutigen Stunde mit?');
    const meta = Object.entries({ Fach: board.metadata.subject, Klasse: board.metadata.className, Thema: board.metadata.topic, Datum: board.metadata.date }).filter(([, value]) => value);
    if (meta.length) doc.moveDown(.8).fontSize(10).fillColor('#13283d').text(meta.map(([key, value]) => `${key}: ${value}`).join('   '));
    if (board.question) doc.moveDown(.8).fontSize(12).fillColor('#087f7c').text(`Reflexionsfrage: ${board.question}`);
    for (const category of ['koffer', 'muellkorb', 'unklar']) {
      const items = board.items.filter((item) => item.category === category);
      if (!items.length) continue;
      doc.moveDown(1).fontSize(15).fillColor('#173b66').text(labels[category]);
      items.forEach((item) => doc.fontSize(10.5).fillColor('#13283d').text(`• ${item.content}   (${item.likes} ${item.likes === 1 ? 'Unterstützung' : 'Unterstützungen'})`, { indent: 10, paragraphGap: 4 }));
    }
    doc.end();
  } catch (error) { sendReflectionBoardError(res, error, 'export failed'); }
});

export default router;
