import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';
import { safeFileName, validateFileContent } from '../lib/fileValidation.js';

const router = Router();
router.use(auth, teacherOnly);
// The Apache document root is httpdocs; keep private uploads outside it.
const storageRoot = process.env.HUB_STORAGE_DIR
  ? path.resolve(process.env.HUB_STORAGE_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../private-hub-uploads');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
const types = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt']);
const categories = new Set(['accounts', 'school', 'emergency', 'parents', 'responsibilities', 'other']);
const userId = (req) => Number.isInteger(req.user?.user_id) ? req.user.user_id : (Number.isInteger(req.user?.id) ? req.user.id : 1);
const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const fail = (res, error, status = 400) => res.status(status).json({ error });

function contactInput(body) {
  if (!categories.has(body?.category) || !text(body?.name, 160)) throw new Error('Name und gültige Kategorie erforderlich');
  const phone = text(body.phone, 80);
  const email = text(body.email, 254);
  if (phone && !/^[+\d\s()./-]{3,80}$/.test(phone)) throw new Error('Ungültige Telefonnummer');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ungültige E-Mail-Adresse');
  return [body.category, text(body.name, 160), phone, email, text(body.class_name, 100), text(body.notes, 1000), body.is_favorite ? 1 : 0];
}

router.get('/contacts', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM hub_contacts WHERE user_id = ? ORDER BY is_favorite DESC, last_used_at DESC, name COLLATE NOCASE', [userId(req)]);
    res.set('Cache-Control', 'private, no-store').json(rows);
  } catch { fail(res, 'Kontakte konnten nicht geladen werden', 500); }
});
router.post('/contacts', async (req, res) => {
  try {
    const values = contactInput(req.body);
    const [created] = await pool.execute('INSERT INTO hub_contacts (user_id, category, name, phone, email, class_name, notes, is_favorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userId(req), ...values]);
    const [rows] = await pool.execute('SELECT * FROM hub_contacts WHERE id = ? AND user_id = ?', [created.insertId, userId(req)]);
    res.status(201).json(rows[0]);
  } catch (error) { fail(res, error.message); }
});
router.put('/contacts/:id', async (req, res) => {
  if (!validId(req.params.id)) return fail(res, 'Ungültige ID');
  try {
    const values = contactInput(req.body);
    const [result] = await pool.execute('UPDATE hub_contacts SET category = ?, name = ?, phone = ?, email = ?, class_name = ?, notes = ?, is_favorite = ? WHERE id = ? AND user_id = ?', [...values, Number(req.params.id), userId(req)]);
    if (!result.affectedRows) return fail(res, 'Kontakt nicht gefunden', 404);
    const [rows] = await pool.execute('SELECT * FROM hub_contacts WHERE id = ? AND user_id = ?', [Number(req.params.id), userId(req)]);
    res.json(rows[0]);
  } catch (error) { fail(res, error.message); }
});
router.post('/contacts/:id/used', async (req, res) => {
  if (!validId(req.params.id)) return fail(res, 'Ungültige ID');
  const [result] = await pool.execute('UPDATE hub_contacts SET last_used_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [Number(req.params.id), userId(req)]);
  if (!result.affectedRows) return fail(res, 'Kontakt nicht gefunden', 404);
  res.json({ ok: true });
});
router.delete('/contacts/:id', async (req, res) => {
  if (!validId(req.params.id)) return fail(res, 'Ungültige ID');
  const [result] = await pool.execute('DELETE FROM hub_contacts WHERE id = ? AND user_id = ?', [Number(req.params.id), userId(req)]);
  res.status(result.affectedRows ? 204 : 404).end();
});

function checkUpload(file, expectedName) {
  if (!file?.buffer) throw new Error('Datei erforderlich');
  const name = safeFileName(expectedName || file.originalname);
  const extension = path.extname(name).slice(1).toLowerCase();
  if (!types.has(extension) || name !== (expectedName || file.originalname)
    || (expectedName && path.extname(file.originalname).toLowerCase() !== path.extname(name).toLowerCase())) throw new Error('Dateityp oder Dateiname nicht erlaubt');
  if (!(file.buffer.length === 0 && ['txt', 'csv'].includes(extension))) validateFileContent(name, file.buffer, 20 * 1024 * 1024);
  return { name, mime: extension === 'txt' ? 'text/plain; charset=utf-8' : extension === 'csv' ? 'text/csv; charset=utf-8' : ({ pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })[extension] };
}
async function ownedDocument(req) {
  if (!validId(req.params.id)) return null;
  const [rows] = await pool.execute('SELECT * FROM hub_documents WHERE id = ? AND user_id = ?', [Number(req.params.id), userId(req)]);
  return rows[0] || null;
}
router.get('/documents', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT d.*, v.mime_type, v.size_bytes FROM hub_documents d JOIN hub_document_versions v ON v.document_id = d.id AND v.version_number = d.current_version WHERE d.user_id = ? ORDER BY d.created_at DESC, d.id DESC`, [userId(req)]);
    res.set('Cache-Control', 'private, no-store').json(rows);
  } catch { fail(res, 'Dokumente konnten nicht geladen werden', 500); }
});
router.post('/documents', upload.single('file'), async (req, res) => {
  let storedName;
  try {
    const { name, mime } = checkUpload(req.file);
    const category = text(req.body.category, 100);
    storedName = randomUUID();
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    await writeFile(path.join(storageRoot, storedName), req.file.buffer, { flag: 'wx', mode: 0o600 });
    const id = pool.transaction((connection) => {
      const [created] = connection.execute('INSERT INTO hub_documents (user_id, name, category) VALUES (?, ?, ?)', [userId(req), name, category]);
      connection.execute('INSERT INTO hub_document_versions (document_id, version_number, stored_name, mime_type, size_bytes) VALUES (?, 1, ?, ?, ?)', [created.insertId, storedName, mime, req.file.size]);
      return created.insertId;
    });
    res.status(201).json({ id });
  } catch (error) {
    if (storedName) await rm(path.join(storageRoot, storedName), { force: true }).catch(() => {});
    fail(res, error.message, /Datei|Dateityp|Dateiname|Dateigröße|stimmt/.test(error.message) ? 400 : 500);
  }
});
router.patch('/documents/:id', async (req, res) => {
  const doc = await ownedDocument(req);
  if (!doc) return fail(res, 'Dokument nicht gefunden', 404);
  const category = text(req.body.category, 100);
  await pool.execute('UPDATE hub_documents SET category = ? WHERE id = ? AND user_id = ?', [category, doc.id, userId(req)]);
  res.json({ ...doc, category });
});
router.get('/documents/:id/versions', async (req, res) => {
  const doc = await ownedDocument(req);
  if (!doc) return fail(res, 'Dokument nicht gefunden', 404);
  const [rows] = await pool.execute('SELECT id, version_number, mime_type, size_bytes, created_at FROM hub_document_versions WHERE document_id = ? ORDER BY version_number DESC', [doc.id]);
  res.set('Cache-Control', 'private, no-store').json(rows);
});
router.get('/documents/:id/content', async (req, res) => {
  const doc = await ownedDocument(req);
  if (!doc) return fail(res, 'Dokument nicht gefunden', 404);
  const version = req.query.version ? Number(req.query.version) : doc.current_version;
  if (!Number.isSafeInteger(version) || version < 1) return fail(res, 'Ungültige Version');
  const [rows] = await pool.execute('SELECT * FROM hub_document_versions WHERE document_id = ? AND version_number = ?', [doc.id, version]);
  if (!rows.length) return fail(res, 'Version nicht gefunden', 404);
  try {
    const buffer = await readFile(path.join(storageRoot, rows[0].stored_name));
    const inline = rows[0].mime_type === 'application/pdf' && req.query.download !== '1';
    res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': inline ? 'application/pdf' : 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.name)}` }).send(buffer);
  } catch { fail(res, 'Datei nicht gefunden', 404); }
});
router.post('/documents/:id/versions', upload.single('file'), async (req, res) => {
  let storedName;
  try {
    const doc = await ownedDocument(req);
    if (!doc) return fail(res, 'Dokument nicht gefunden', 404);
    let buffer = req.file?.buffer;
    if (!buffer && typeof req.body?.content === 'string' && /\.(txt|csv)$/i.test(doc.name)) {
      buffer = Buffer.from(req.body.content, 'utf8');
      if (buffer.length > 20 * 1024 * 1024) throw new Error('Ungültige Dateigröße');
    }
    const source = req.file || (buffer ? { originalname: doc.name, buffer, size: buffer.length } : null);
    const { mime } = checkUpload(source, doc.name);
    storedName = randomUUID();
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    await writeFile(path.join(storageRoot, storedName), buffer, { flag: 'wx', mode: 0o600 });
    const version = pool.transaction((connection) => {
      const [[current]] = connection.execute('SELECT current_version FROM hub_documents WHERE id = ? AND user_id = ?', [doc.id, userId(req)]);
      const next = current.current_version + 1;
      connection.execute('INSERT INTO hub_document_versions (document_id, version_number, stored_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)', [doc.id, next, storedName, mime, buffer.length]);
      connection.execute('UPDATE hub_documents SET current_version = ? WHERE id = ? AND user_id = ?', [next, doc.id, userId(req)]);
      return next;
    });
    res.status(201).json({ version_number: version });
  } catch (error) {
    if (storedName) await rm(path.join(storageRoot, storedName), { force: true }).catch(() => {});
    fail(res, error.message, /Datei|Dateityp|Dateiname|Dateigröße|stimmt/.test(error.message) ? 400 : 500);
  }
});
router.delete('/documents/:id', async (req, res) => {
  const doc = await ownedDocument(req);
  if (!doc) return fail(res, 'Dokument nicht gefunden', 404);
  const [versions] = await pool.execute('SELECT stored_name FROM hub_document_versions WHERE document_id = ?', [doc.id]);
  await pool.execute('DELETE FROM hub_documents WHERE id = ? AND user_id = ?', [doc.id, userId(req)]);
  await Promise.all(versions.map(({ stored_name }) => rm(path.join(storageRoot, stored_name), { force: true }).catch(() => {})));
  res.status(204).end();
});
router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) return fail(res, error.code === 'LIMIT_FILE_SIZE' ? 'Datei überschreitet 20 MB' : 'Upload fehlgeschlagen', 400);
  next(error);
});
export default router;
