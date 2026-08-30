import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';
import { MIME_BY_EXTENSION, safeFileName, validateDeclaredMime, validateFileContent } from '../lib/fileValidation.js';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');
const execFileAsync = promisify(execFile);
const router = Router();
router.use(auth, teacherOnly);

const serverDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const uploadsDir = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR, 'uploads') : path.join(serverDir, 'uploads');
const importDir = path.join(os.tmpdir(), 'lehrermaps-plan-imports');
mkdirSync(importDir, { recursive: true });
const previews = new Map();
const MAX_ARCHIVE = 400 * 1024 * 1024;
const MAX_FILE = 300 * 1024 * 1024;
const MAX_FILES = 500;

const upload = multer({ dest: importDir, limits: { fileSize: MAX_ARCHIVE, files: 1 } });
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

function validArchivePath(name) {
  return name && !name.includes('\\') && !name.startsWith('/') && !name.split('/').includes('..') && !name.includes('\0');
}

function validDate(value, optional = true) {
  if (optional && !value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

async function archiveEntries(zipPath) {
  const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const names = stdout.split(/\r?\n/).filter(Boolean);
  if (names.length > MAX_FILES + 3) throw new Error('Archiv enthält zu viele Dateien');
  if (new Set(names).size !== names.length || names.some((name) => !validArchivePath(name))) throw new Error('Archiv enthält ungültige oder doppelte Pfade');
  return names;
}

async function readZipEntry(zipPath, name) {
  const { stdout } = await execFileAsync('unzip', ['-p', zipPath, name], { encoding: 'buffer', maxBuffer: MAX_FILE + 1 });
  return stdout;
}

function csv(entries) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const fields = ['entry_date', 'end_date', 'entry_type', 'lesson_number', 'title', 'notes', 'content', 'learning_objectives', 'activities', 'homework'];
  return `\uFEFF${[fields.map(quote).join(';'), ...entries.map((entry) => fields.map((field) => quote(entry[field])).join(';'))].join('\n')}`;
}

async function planData(planId, mode = 'linked') {
  const [plans] = await pool.execute(`SELECT p.*, f.subject, f.group_name, f.name AS folder_name FROM annual_plans p JOIN folders f ON f.id=p.root_folder_id WHERE p.id=?`, [planId]);
  if (!plans.length) return null;
  const plan = plans[0];
  const [entries] = await pool.execute('SELECT * FROM annual_plan_entries WHERE plan_id=? ORDER BY entry_date, sort_order, id', [planId]);
  const [links] = await pool.execute('SELECT m.entry_id,m.file_id,m.folder_id FROM annual_plan_materials m JOIN annual_plan_entries e ON e.id=m.entry_id WHERE e.plan_id=?', [planId]);
  const [folderFiles] = await pool.execute(`
    WITH RECURSIVE linked_folders(entry_id, folder_id) AS (
      SELECT m.entry_id, m.folder_id FROM annual_plan_materials m JOIN annual_plan_entries e ON e.id=m.entry_id WHERE e.plan_id=? AND m.folder_id IS NOT NULL
      UNION ALL SELECT lf.entry_id, f.id FROM folders f JOIN linked_folders lf ON f.parent_id=lf.folder_id
    )
    SELECT DISTINCT lf.entry_id, fi.id AS file_id FROM linked_folders lf JOIN files fi ON fi.folder_id=lf.folder_id WHERE fi.is_current_version=1
  `, [planId]);
  let files;
  if (mode === 'all') [files] = await pool.execute('SELECT fi.* FROM files fi WHERE fi.is_current_version=1 ORDER BY fi.id');
  else if (mode === 'class') [files] = await pool.execute('SELECT fi.* FROM files fi JOIN folders f ON f.id=fi.folder_id WHERE fi.is_current_version=1 AND f.subject=? AND f.group_name=? ORDER BY fi.id', [plan.subject, plan.group_name]);
  else [files] = await pool.execute(`SELECT DISTINCT fi.* FROM files fi WHERE fi.is_current_version=1 AND (fi.id IN (SELECT m.file_id FROM annual_plan_materials m JOIN annual_plan_entries e ON e.id=m.entry_id WHERE e.plan_id=? AND m.file_id IS NOT NULL) OR fi.id IN (${folderFiles.length ? folderFiles.map(() => '?').join(',') : 'NULL'})) ORDER BY fi.id`, [planId, ...folderFiles.map((item) => item.file_id)]);
  return { plan, entries, links, folderFiles, files };
}

router.get('/:id/export.zip', async (req, res) => {
  try {
    const mode = ['linked', 'class', 'all'].includes(req.query.materials) ? req.query.materials : 'linked';
    const data = await planData(req.params.id, mode);
    if (!data) return res.status(404).json({ error: 'Jahresplanung nicht gefunden' });
    const attachments = [];
    for (const file of data.files) {
      const source = path.join(uploadsDir, file.stored_name);
      if (!existsSync(source)) throw new Error(`Datei fehlt auf dem Server: ${file.original_name}`);
      const name = safeFileName(file.original_name) || `material-${file.id}`;
      attachments.push({ file, source, archive_path: `attachments/${file.id}-${name}` });
    }
    const attachmentById = new Map(attachments.map((item) => [item.file.id, item]));
    const manifest = {
      format: 'lehrermaps-annual-plan', version: 1, exported_at: new Date().toISOString(), material_scope: mode,
      plan: { school_year: data.plan.school_year, start_date: data.plan.start_date, end_date: data.plan.end_date, subject: data.plan.subject, group_name: data.plan.group_name },
      entries: data.entries.map((entry) => ({
        id: `entry-${entry.id}`, entry_date: entry.entry_date, end_date: entry.end_date, entry_type: entry.entry_type,
        lesson_number: entry.lesson_number, title: entry.title, notes: entry.notes, sort_order: entry.sort_order,
        content: entry.content, learning_objectives: entry.learning_objectives, activities: entry.activities, homework: entry.homework,
        materials: [...new Set([
          ...data.links.filter((link) => link.entry_id === entry.id && link.file_id).map((link) => link.file_id),
          ...data.folderFiles.filter((link) => link.entry_id === entry.id).map((link) => link.file_id),
        ])].map((fileId) => ({ type: 'file', archive_path: attachmentById.get(fileId)?.archive_path || null })).filter((item) => item.archive_path),
      })),
      attachments: [],
    };
    for (const item of attachments) {
      const buffer = await readFile(item.source);
      const originalName = safeFileName(item.file.original_name) || `material-${item.file.id}`;
      const ext = path.extname(originalName).slice(1).toLowerCase();
      manifest.attachments.push({ archive_path: item.archive_path, original_name: originalName, size: buffer.length, sha256: digest(buffer), mime_type: MIME_BY_EXTENSION[ext] || item.file.mime_type });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Jahresplanung-${data.plan.school_year.replaceAll('/', '-')}.zip"`);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', (error) => res.destroy(error));
    archive.pipe(res);
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(csv(data.entries), { name: 'planning.csv' });
    for (const item of attachments) archive.file(item.source, { name: item.archive_path });
    await archive.finalize();
  } catch (error) { if (!res.headersSent) res.status(500).json({ error: error.message }); }
});

router.post('/import/preview', upload.single('archive'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ZIP-Archiv erforderlich' });
  try {
    const rootFolderId = Number(req.body.root_folder_id);
    const [roots] = await pool.execute('SELECT * FROM folders WHERE id=?', [rootFolderId]);
    if (!roots.length) throw new Error('Zielordner nicht gefunden');
    const names = await archiveEntries(req.file.path);
    if (!names.includes('manifest.json')) throw new Error('manifest.json fehlt');
    const manifest = JSON.parse((await readZipEntry(req.file.path, 'manifest.json')).toString('utf8'));
    if (manifest.format !== 'lehrermaps-annual-plan' || manifest.version !== 1 || !Array.isArray(manifest.entries) || !Array.isArray(manifest.attachments)) throw new Error('Nicht unterstütztes Archivformat');
    if (manifest.entries.length > 2000) throw new Error('Archiv enthält zu viele Planungseinträge');
    for (const entry of manifest.entries) {
      if (!validDate(entry.entry_date, false) || !validDate(entry.end_date) || (entry.end_date && entry.end_date < entry.entry_date)) throw new Error('Archiv enthält ungültige Planungsdaten');
      if (!['lesson', 'holiday', 'exam', 'classwork', 'presentation', 'school_event', 'other'].includes(entry.entry_type || 'lesson')) throw new Error('Archiv enthält einen ungültigen Eintragstyp');
    }
    const schoolYear = String(req.body.school_year || manifest.plan?.school_year || '').trim();
    if (!/^\d{4}\/\d{2}$/.test(schoolYear)) throw new Error('Ungültiges Schuljahr');
    const attachmentPaths = new Set();
    let total = 0;
    for (const attachment of manifest.attachments) {
      if (!validArchivePath(attachment.archive_path) || !names.includes(attachment.archive_path) || attachmentPaths.has(attachment.archive_path)) throw new Error('Ungültige Anlage im Manifest');
      attachmentPaths.add(attachment.archive_path);
      const buffer = await readZipEntry(req.file.path, attachment.archive_path);
      total += buffer.length;
      if (total > MAX_ARCHIVE) throw new Error('Entpacktes Archiv ist zu groß');
      validateFileContent(attachment.original_name, buffer, MAX_FILE);
      validateDeclaredMime(attachment.original_name, attachment.mime_type);
      if (buffer.length !== Number(attachment.size) || digest(buffer) !== attachment.sha256) throw new Error(`${attachment.original_name}: Größe oder Prüfsumme stimmt nicht`);
    }
    const token = randomUUID();
    previews.set(token, { path: req.file.path, manifest, rootFolderId, schoolYear, expires: Date.now() + 15 * 60_000 });
    res.json({ token, school_year: schoolYear, entries: manifest.entries.length, attachments: manifest.attachments.length, expires_in_seconds: 900 });
  } catch (error) { await rm(req.file.path, { force: true }); res.status(400).json({ error: error.message }); }
});

router.post('/import/commit', async (req, res) => {
  const preview = previews.get(String(req.body?.token || ''));
  if (!preview || preview.expires < Date.now()) return res.status(400).json({ error: 'Importvorschau ist abgelaufen' });
  const staged = [];
  try {
    const [existingPlans] = await pool.execute('SELECT id FROM annual_plans WHERE root_folder_id=? AND school_year=?', [preview.rootFolderId, preview.schoolYear]);
    if (existingPlans.length) return res.status(409).json({ error: 'Diese Jahresplanung existiert bereits; es wurde nichts überschrieben' });
    await mkdir(uploadsDir, { recursive: true });
    for (const attachment of preview.manifest.attachments) {
      const buffer = await readZipEntry(preview.path, attachment.archive_path);
      if (digest(buffer) !== attachment.sha256) throw new Error('Archiv wurde nach der Vorschau verändert');
      const storedName = randomUUID();
      const temporary = path.join(uploadsDir, `.import-${storedName}`);
      await writeFile(temporary, buffer, { flag: 'wx' });
      staged.push({ attachment, temporary, storedName, size: buffer.length });
    }
    const result = pool.transaction((connection) => {
      const [existing] = connection.execute('SELECT id FROM annual_plans WHERE root_folder_id=? AND school_year=?', [preview.rootFolderId, preview.schoolYear]);
      if (existing.length) throw Object.assign(new Error('Diese Jahresplanung existiert bereits; es wurde nichts überschrieben'), { status: 409 });
      const [planResult] = connection.execute('INSERT INTO annual_plans (root_folder_id,school_year,start_date,end_date) VALUES (?,?,?,?)', [preview.rootFolderId, preview.schoolYear, preview.manifest.plan?.start_date || null, preview.manifest.plan?.end_date || null]);
      const fileIdByPath = new Map();
      for (const item of staged) {
        const [fileResult] = connection.execute('INSERT INTO files (folder_id,original_name,stored_name,mime_type,size_bytes,version_group_id) VALUES (?,?,?,?,?,?)', [preview.rootFolderId, item.attachment.original_name, item.storedName, item.attachment.mime_type || 'application/octet-stream', item.size, randomUUID().replaceAll('-', '')]);
        fileIdByPath.set(item.attachment.archive_path, fileResult.insertId);
      }
      for (const entry of preview.manifest.entries) {
        const [entryResult] = connection.execute(`INSERT INTO annual_plan_entries (plan_id,entry_date,end_date,entry_type,lesson_number,title,notes,sort_order,content,learning_objectives,activities,homework) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [planResult.insertId, entry.entry_date, entry.end_date || null, entry.entry_type || 'lesson', entry.lesson_number || null, entry.title || '', entry.notes || null, Number(entry.sort_order) || 0, entry.content || null, entry.learning_objectives || null, entry.activities || null, entry.homework || null]);
        for (const material of entry.materials || []) {
          const fileId = fileIdByPath.get(material.archive_path);
          if (fileId) connection.execute('INSERT OR IGNORE INTO annual_plan_materials (entry_id,file_id) VALUES (?,?)', [entryResult.insertId, fileId]);
        }
      }
      for (const item of staged) {
        item.finalPath = path.join(uploadsDir, item.storedName);
        renameSync(item.temporary, item.finalPath);
      }
      return { planId: planResult.insertId };
    });
    previews.delete(String(req.body.token));
    await rm(preview.path, { force: true });
    res.status(201).json({ plan_id: result.planId, school_year: preview.schoolYear });
  } catch (error) {
    for (const item of staged) await rm(item.temporary, { force: true }).catch(() => {});
    for (const item of staged) if (item.finalPath) await rm(item.finalPath, { force: true }).catch(() => {});
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
  return res.status(400).json({ error: error.message });
});

export default router;
