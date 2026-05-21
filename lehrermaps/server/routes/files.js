import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { copyFile, unlink, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import pool from '../db.js';
import auth from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PREVIEWS_DIR = path.join(__dirname, '..', 'previews');

const CONVERTIBLE_EXTS = new Set(['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods']);
const converting = new Set();

async function convertToPdf(storedName, ext) {
  const tmpName = `${storedName}.${ext}`;
  const tmpPath = path.join(PREVIEWS_DIR, tmpName);
  const pdfPath = path.join(PREVIEWS_DIR, `${storedName}.pdf`);

  await mkdir(PREVIEWS_DIR, { recursive: true });
  await copyFile(path.join(UPLOADS_DIR, storedName), tmpPath);

  await new Promise((resolve, reject) => {
    exec(
      `soffice --headless --convert-to pdf --outdir "${PREVIEWS_DIR}" "${tmpPath}"`,
      { timeout: 45000 },
      (err) => { unlink(tmpPath).catch(() => {}); err ? reject(err) : resolve(); }
    );
  });

  return pdfPath;
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, __, cb) => cb(null, `${randomUUID()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('text/') ||
      file.mimetype.startsWith('application/')
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Dateityp ${file.mimetype} nicht erlaubt`));
    }
  },
});

const router = Router();

router.get('/public/:token', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM files WHERE public_token = ? AND is_public = 1 LIMIT 1',
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const file = rows[0];
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht auf Disk' });
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(auth);

// ── View / Preview / Download must come BEFORE /:folder_id ──

router.get('/open/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    const file = rows[0];
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht auf Disk' });

    const ext = file.original_name.split('.').pop().toLowerCase();
    const appMap = {
      pptx: 'Microsoft PowerPoint', ppt: 'Microsoft PowerPoint', odp: 'LibreOffice Impress',
      doc: 'Microsoft Word', docx: 'Microsoft Word', odc: 'Microsoft Word', odt: 'LibreOffice Writer',
      pdf: 'Preview',
    };
    const appFlag = appMap[ext] ? `-a "${appMap[ext]}"` : '';

    exec(`open ${appFlag} "${filePath}"`, { timeout: 8000 }, (err) => {
      if (err) return res.status(500).json({ error: 'App nicht gefunden oder konnte nicht geöffnet werden' });
      res.json({ ok: true });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/preview/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    const file = rows[0];

    const ext = file.original_name.split('.').pop().toLowerCase();
    if (!CONVERTIBLE_EXTS.has(ext)) return res.status(415).json({ error: 'Nicht konvertierbar' });

    const pdfPath = path.join(PREVIEWS_DIR, `${file.stored_name}.pdf`);

    if (!existsSync(pdfPath)) {
      if (converting.has(file.stored_name)) {
        await new Promise((r) => { const t = setInterval(() => { if (!converting.has(file.stored_name)) { clearInterval(t); r(); } }, 300); });
      } else {
        converting.add(file.stored_name);
        try { await convertToPdf(file.stored_name, ext); }
        finally { converting.delete(file.stored_name); }
      }
    }

    if (!existsSync(pdfPath)) return res.status(500).json({ error: 'Konvertierung fehlgeschlagen' });

    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.original_name.replace(/\.[^.]+$/, '.pdf'))}`);
    res.setHeader('Content-Type', 'application/pdf');
    createReadStream(pdfPath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── View + Download must come BEFORE /:folder_id to avoid param capture ──

router.get('/view/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const file = rows[0];
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht auf Disk' });
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/download/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });

    const file = rows[0];
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht auf Disk' });

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/zip/:folder_id', async (req, res) => {
  try {
    const [folders] = await pool.execute('SELECT * FROM folders WHERE id = ?', [req.params.folder_id]);
    if (!folders.length) return res.status(404).json({ error: 'Ordner nicht gefunden' });
    const folder = folders[0];
    const [files] = await pool.execute('SELECT * FROM files WHERE folder_id = ?', [req.params.folder_id]);

    const safeName = folder.name.replace(/[^\w\s-]/g, '').trim() || 'ordner';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.zip`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { if (!res.headersSent) res.status(500).end(); else res.end(); console.error(err); });
    archive.pipe(res);
    for (const file of files) {
      const fp = path.join(UPLOADS_DIR, file.stored_name);
      if (existsSync(fp)) archive.file(fp, { name: file.original_name });
    }
    await archive.finalize();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

router.get('/zip-selected', async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 200);
    if (!ids.length) return res.status(400).json({ error: 'Keine Dateien ausgewählt' });

    const placeholders = ids.map(() => '?').join(',');
    const [files] = await pool.execute(
      `SELECT * FROM files WHERE id IN (${placeholders}) ORDER BY uploaded_at DESC`,
      ids
    );
    if (!files.length) return res.status(404).json({ error: 'Keine Dateien gefunden' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('selected-files.zip')}`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (e) => { throw e; });
    archive.pipe(res);
    for (const file of files) {
      const fp = path.join(UPLOADS_DIR, file.stored_name);
      if (existsSync(fp)) archive.file(fp, { name: file.original_name });
    }
    await archive.finalize();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ files: [], folders: [], hasMoreFiles: false, hasMoreFolders: false });
  const like = `%${q}%`;
  const fileOffset = Math.max(0, Number(req.query.fileOffset) || 0);
  const folderOffset = Math.max(0, Number(req.query.folderOffset) || 0);
  const FILE_LIMIT = 25;
  const FOLDER_LIMIT = 15;
  try {
    const [[files], [folders], [[{ totalFiles }]], [[{ totalFolders }]]] = await Promise.all([
      pool.execute(`
        SELECT fi.id, fi.original_name AS name, fi.mime_type, fi.size_bytes, fi.uploaded_at,
               fo.id AS folder_id, fo.name AS folder_name, fo.subject, fo.group_name
        FROM files fi
        JOIN folders fo ON fo.id = fi.folder_id
        WHERE fi.original_name LIKE ?
        ORDER BY fi.uploaded_at DESC
        LIMIT ? OFFSET ?
      `, [like, FILE_LIMIT + 1, fileOffset]),
      pool.execute(`
        SELECT
          id, name, subject, group_name, is_favorite,
          CASE WHEN notes LIKE ? THEN 1 ELSE 0 END AS notes_match
        FROM folders
        WHERE name LIKE ? OR notes LIKE ?
        ORDER BY notes_match DESC, name
        LIMIT ? OFFSET ?
      `, [like, like, like, FOLDER_LIMIT + 1, folderOffset]),
      pool.execute('SELECT COUNT(*) AS totalFiles FROM files fi JOIN folders fo ON fo.id = fi.folder_id WHERE fi.original_name LIKE ?', [like]),
      pool.execute('SELECT COUNT(*) AS totalFolders FROM folders WHERE name LIKE ? OR notes LIKE ?', [like, like]),
    ]);
    const hasMoreFiles = files.length > FILE_LIMIT;
    const hasMoreFolders = folders.length > FOLDER_LIMIT;
    res.json({
      files: files.slice(0, FILE_LIMIT),
      folders: folders.slice(0, FOLDER_LIMIT),
      hasMoreFiles,
      hasMoreFolders,
      totalFiles: Number(totalFiles),
      totalFolders: Number(totalFolders),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:folder_id', async (req, res) => {
  try {
    const isStudent = req.user?.role === 'student';
    const query = isStudent
      ? 'SELECT * FROM files WHERE folder_id = ? AND is_shared = 1 ORDER BY uploaded_at DESC'
      : 'SELECT * FROM files WHERE folder_id = ? ORDER BY uploaded_at DESC';
    const [rows] = await pool.execute(query, [req.params.folder_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/share', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE files SET is_shared = IF(is_shared=1, 0, 1) WHERE id = ?',
      [req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/public', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  try {
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const current = rows[0];
    const nextPublic = current.is_public ? 0 : 1;
    const token = current.public_token || randomUUID().replace(/-/g, '');
    await pool.execute(
      'UPDATE files SET is_public = ?, public_token = ? WHERE id = ?',
      [nextPublic, token, req.params.id]
    );
    const [updatedRows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    res.json(updatedRows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/deadline', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  const { due_at } = req.body;
  try {
    await pool.execute('UPDATE files SET due_at = ? WHERE id = ?', [due_at || null, req.params.id]);
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei übermittelt' });
  const { folder_id } = req.body;
  if (!folder_id) return res.status(400).json({ error: 'folder_id fehlt' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO files (folder_id, original_name, stored_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)',
      [folder_id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]
    );
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { original_name, folder_id } = req.body;
  const hasName = typeof original_name === 'string' && original_name.trim();
  const hasFolder = Number.isInteger(Number(folder_id)) && Number(folder_id) > 0;
  if (!hasName && !hasFolder) {
    return res.status(400).json({ error: 'original_name oder folder_id erforderlich' });
  }
  try {
    if (hasName) {
      await pool.execute('UPDATE files SET original_name = ? WHERE id = ?', [original_name.trim(), req.params.id]);
    }
    if (hasFolder) {
      const [target] = await pool.execute('SELECT id FROM folders WHERE id = ? LIMIT 1', [Number(folder_id)]);
      if (!target.length) return res.status(404).json({ error: 'Zielordner nicht gefunden' });
      await pool.execute('UPDATE files SET folder_id = ? WHERE id = ?', [Number(folder_id), req.params.id]);
    }
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT stored_name FROM files WHERE id = ?', [req.params.id]);
    if (rows.length) {
      const { stored_name } = rows[0];
      const filePath = path.join(UPLOADS_DIR, stored_name);
      const pdfPath = path.join(PREVIEWS_DIR, `${stored_name}.pdf`);
      if (existsSync(filePath)) await unlink(filePath).catch(() => {});
      if (existsSync(pdfPath)) await unlink(pdfPath).catch(() => {});
    }
    await pool.execute('DELETE FROM files WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Multer error handler ──
router.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Datei zu groß — max. 300 MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  _next();
});

export default router;
