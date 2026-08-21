import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, symlinkSync, unlinkSync, mkdirSync } from 'fs';
import { copyFile, unlink, mkdir, stat } from 'fs/promises';
import os from 'os';
import { exec, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');
import pool from '../db.js';
import auth from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PREVIEWS_DIR = path.join(__dirname, '..', 'previews');
const EDITS_DIR = path.join(__dirname, '..', 'edit-copies');

const CONVERTIBLE_EXTS = new Set(['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods']);
const converting = new Set();
const MATERIAL_ROLES = new Set(['starter', 'work', 'secure', 'homework', 'solution', 'exam', 'other']);

async function convertToPdf(storedName, ext) {
  const tmpName = `${storedName}.${ext}`;
  const tmpPath = path.join(PREVIEWS_DIR, tmpName);
  const pdfPath = path.join(PREVIEWS_DIR, `${storedName}.pdf`);

  await mkdir(PREVIEWS_DIR, { recursive: true });
  await copyFile(path.join(UPLOADS_DIR, storedName), tmpPath);

  await new Promise((resolve, reject) => {
    execFile(
      'soffice',
      [
        '--headless',
        '--norestore',
        '--nofirststartwizard',
        `-env:UserInstallation=file:///tmp/lehrermaps-libreoffice-${storedName}`,
        '--convert-to', 'pdf',
        '--outdir', PREVIEWS_DIR,
        tmpPath,
      ],
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


function safeOriginalName(name = 'material') {
  return String(name).replace(/[\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'material';
}

async function getFileById(id) {
  const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [id]);
  return rows[0] || null;
}

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
      mp4: 'VLC', mov: 'QuickTime Player', m4v: 'VLC', avi: 'VLC', mkv: 'VLC',
    };
    const requestedApp = req.query.app;
    const resolvedApp = requestedApp || appMap[ext];
    const appFlag = resolvedApp ? `-a "${resolvedApp}"` : '';

    // Symlink with original name so apps (VLC etc.) detect format via extension
    const tmpDir = path.join(os.tmpdir(), 'lehrermaps-open');
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
    const tmpPath = path.join(tmpDir, file.original_name);
    try { unlinkSync(tmpPath); } catch {}
    try { symlinkSync(filePath, tmpPath); } catch {}
    const openPath = existsSync(tmpPath) ? tmpPath : filePath;

    exec(`open ${appFlag} "${openPath}"`, { timeout: 8000 }, (err) => {
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

    const archive = new ZipArchive({ zlib: { level: 6 } });
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
    const archive = new ZipArchive({ zlib: { level: 9 } });
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
  if (!q) return res.json({
    files: [], folders: [], links: [],
    hasMoreFiles: false, hasMoreFolders: false, hasMoreLinks: false,
    totalFiles: 0, totalFolders: 0, totalLinks: 0,
  });
  const fileOffset = Math.max(0, Number(req.query.fileOffset) || 0);
  const folderOffset = Math.max(0, Number(req.query.folderOffset) || 0);
  const linkOffset = Math.max(0, Number(req.query.linkOffset) || 0);
  const FILE_LIMIT = 25;
  const FOLDER_LIMIT = 15;
  const LINK_LIMIT = 25;
  const norm = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = norm.split(' ').filter(Boolean).slice(0, 6);
  const normalizedSql = (field) => `
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      LOWER(${field}),
      'á','a'),'à','a'),'ä','a'),'â','a'),
      'é','e'),'è','e'),'ë','e'),'ê','e'),
      'í','i'),'ì','i')
  `;
  const normalizedSql2 = (field) => `
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      ${normalizedSql(field)},
      'ï','i'),'î','i'),
      'ó','o'),'ò','o'),'ö','o'),'ô','o'),
      'ú','u'),'ù','u'),'ü','u')
  `;
  const normalizedSql3 = (field) => `
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      ${normalizedSql2(field)},
      'û','u'),'ñ','n'),
      '.', ''), ',', ''), '-', ''), '_', '')
  `;
  const buildTokenWhere = (fields) => tokens.map(() =>
    `(${fields.map((f) => `${normalizedSql3(f)} LIKE ?`).join(' OR ')})`
  ).join(' AND ');
  const fileFields = ['fi.original_name', 'fo.name', 'fo.group_name', 'fo.subject'];
  const folderFields = ['name', 'group_name', 'subject', 'notes'];
  const linkFields = ['li.title', 'li.url', 'fo.name', 'fo.group_name', 'fo.subject'];
  const fileWhere = tokens.length ? buildTokenWhere(fileFields) : `${normalizedSql3('fi.original_name')} LIKE ?`;
  const folderWhere = tokens.length ? buildTokenWhere(folderFields) : `(${normalizedSql3('name')} LIKE ? OR ${normalizedSql3('notes')} LIKE ?)`;
  const linkWhere = tokens.length ? buildTokenWhere(linkFields) : `(${normalizedSql3('li.title')} LIKE ? OR ${normalizedSql3('li.url')} LIKE ?)`;
  const fileParams = tokens.length
    ? tokens.flatMap((t) => fileFields.map(() => `%${t}%`))
    : [`%${norm}%`];
  const folderParams = tokens.length
    ? tokens.flatMap((t) => folderFields.map(() => `%${t}%`))
    : [`%${norm}%`, `%${norm}%`];
  const linkParams = tokens.length
    ? tokens.flatMap((t) => linkFields.map(() => `%${t}%`))
    : [`%${norm}%`, `%${norm}%`];
  try {
    const [[files], [folders], [links], [[{ totalFiles }]], [[{ totalFolders }]], [[{ totalLinks }]]] = await Promise.all([
      pool.execute(`
        SELECT fi.id, fi.original_name AS name, fi.mime_type, fi.size_bytes, fi.uploaded_at,
               fo.id AS folder_id, fo.name AS folder_name, fo.subject, fo.group_name
        FROM files fi
        JOIN folders fo ON fo.id = fi.folder_id
        WHERE ${fileWhere}
        ORDER BY fi.uploaded_at DESC
        LIMIT ? OFFSET ?
      `, [...fileParams, FILE_LIMIT + 1, fileOffset]),
      pool.execute(`
        SELECT
          id, name, subject, group_name, is_favorite,
          CASE WHEN ${normalizedSql3('notes')} LIKE ? THEN 1 ELSE 0 END AS notes_match
        FROM folders
        WHERE ${folderWhere}
        ORDER BY notes_match DESC, name
        LIMIT ? OFFSET ?
      `, [`%${norm}%`, ...folderParams, FOLDER_LIMIT + 1, folderOffset]),
      pool.execute(`
        SELECT li.id, li.title, li.url, li.created_at,
               fo.id AS folder_id, fo.name AS folder_name, fo.subject, fo.group_name
        FROM links li
        JOIN folders fo ON fo.id = li.folder_id
        WHERE ${linkWhere}
        ORDER BY li.created_at DESC
        LIMIT ? OFFSET ?
      `, [...linkParams, LINK_LIMIT + 1, linkOffset]),
      pool.execute(`SELECT COUNT(*) AS totalFiles FROM files fi JOIN folders fo ON fo.id = fi.folder_id WHERE ${fileWhere}`, fileParams),
      pool.execute(`SELECT COUNT(*) AS totalFolders FROM folders WHERE ${folderWhere}`, folderParams),
      pool.execute(`SELECT COUNT(*) AS totalLinks FROM links li JOIN folders fo ON fo.id = li.folder_id WHERE ${linkWhere}`, linkParams),
    ]);
    const hasMoreFiles = files.length > FILE_LIMIT;
    const hasMoreFolders = folders.length > FOLDER_LIMIT;
    const hasMoreLinks = links.length > LINK_LIMIT;
    res.json({
      files: files.slice(0, FILE_LIMIT),
      folders: folders.slice(0, FOLDER_LIMIT),
      links: links.slice(0, LINK_LIMIT),
      hasMoreFiles,
      hasMoreFolders,
      hasMoreLinks,
      totalFiles: Number(totalFiles),
      totalFolders: Number(totalFolders),
      totalLinks: Number(totalLinks),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:folder_id', async (req, res) => {
  try {
    const isStudent = req.user?.role === 'student';
    const query = isStudent
      ? 'SELECT * FROM files WHERE folder_id = ? AND is_shared = 1 AND is_current_version = 1 ORDER BY uploaded_at DESC'
      : 'SELECT * FROM files WHERE folder_id = ? AND is_current_version = 1 ORDER BY uploaded_at DESC';
    const [rows] = await pool.execute(query, [req.params.folder_id]);

    const parseLeadingNumber = (name = '') => {
      const m = String(name).trim().match(/^(\d+)[.)\-\s]?/);
      return m ? Number(m[1]) : null;
    };

    rows.sort((a, b) => {
      const na = parseLeadingNumber(a.original_name);
      const nb = parseLeadingNumber(b.original_name);

      if (na !== null && nb !== null && na !== nb) return na - nb;
      if (na !== null && nb === null) return -1;
      if (na === null && nb !== null) return 1;
      return String(a.original_name || '').localeCompare(String(b.original_name || ''), 'es', {
        numeric: true,
        sensitivity: 'base',
      });
    });

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
      'INSERT INTO files (folder_id, original_name, stored_name, mime_type, size_bytes, version_group_id) VALUES (?, ?, ?, ?, ?, ?)',
      [folder_id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, randomUUID().replace(/-/g, '')]
    );
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


router.put('/roles/bulk', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200) : [];
  const role = req.body.material_role;
  if (!ids.length || !MATERIAL_ROLES.has(role)) return res.status(400).json({ error: 'Ungültige Rolle oder Auswahl' });
  try {
    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(`UPDATE files SET material_role = ? WHERE id IN (${placeholders})`, [role, ...ids]);
    const [rows] = await pool.execute(`SELECT * FROM files WHERE id IN (${placeholders})`, ids);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/versions', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  try {
    const file = await getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const [rows] = await pool.execute(
      'SELECT id, original_name, size_bytes, uploaded_at, version_number, is_current_version FROM files WHERE version_group_id = ? ORDER BY version_number DESC, uploaded_at DESC',
      [file.version_group_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/edit-copy', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  try {
    const file = await getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const sourcePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!existsSync(sourcePath)) return res.status(404).json({ error: 'Datei nicht auf Disk' });

    await mkdir(EDITS_DIR, { recursive: true });
    const copyName = `${file.id}-${Date.now()}-${safeOriginalName(file.original_name)}`;
    const copyPath = path.join(EDITS_DIR, copyName);
    await copyFile(sourcePath, copyPath);
    await pool.execute('INSERT INTO file_edit_copies (file_id, copy_name) VALUES (?, ?)', [file.id, copyName]);

    // Automated clients and containerized deployments can create the copy
    // without trying to launch a desktop application.
    if (req.body?.open === false) {
      return res.json({ ok: true, copy_name: copyName });
    }

    exec(`open "${copyPath}"`, { timeout: 8000 }, (err) => {
      if (err) return res.status(500).json({ error: 'Arbeitskopie konnte nicht geöffnet werden' });
      res.json({ ok: true, copy_name: copyName });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/versions/commit', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  try {
    const file = await getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Datei nicht gefunden' });
    const [copies] = await pool.execute('SELECT * FROM file_edit_copies WHERE file_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [file.id]);
    if (!copies.length) return res.status(404).json({ error: 'Keine Arbeitskopie gefunden' });

    const copyPath = path.join(EDITS_DIR, copies[0].copy_name);
    if (!existsSync(copyPath)) return res.status(404).json({ error: 'Arbeitskopie nicht auf Disk' });
    const info = await stat(copyPath);
    const storedName = randomUUID();
    await copyFile(copyPath, path.join(UPLOADS_DIR, storedName));

    const [[{ nextVersion }]] = await pool.execute(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS nextVersion FROM files WHERE version_group_id = ?',
      [file.version_group_id]
    );
    await pool.execute('UPDATE files SET is_current_version = 0 WHERE version_group_id = ?', [file.version_group_id]);
    const [result] = await pool.execute(
      `INSERT INTO files (folder_id, original_name, stored_name, mime_type, size_bytes, is_shared, due_at, is_public, public_token, material_role, version_group_id, version_number, is_current_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, 1)`,
      [file.folder_id, file.original_name, storedName, file.mime_type, info.size, file.is_shared || 0, file.due_at || null, file.material_role || 'other', file.version_group_id, nextVersion]
    );
    await pool.execute('DELETE FROM file_edit_copies WHERE id = ?', [copies[0].id]);
    const [rows] = await pool.execute('SELECT * FROM files WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { original_name, folder_id, material_role } = req.body;
  const hasRole = typeof material_role === 'string' && MATERIAL_ROLES.has(material_role);
  const hasName = typeof original_name === 'string' && original_name.trim();
  const hasFolder = Number.isInteger(Number(folder_id)) && Number(folder_id) > 0;
  if (!hasName && !hasFolder && !hasRole) {
    return res.status(400).json({ error: 'original_name, folder_id oder material_role erforderlich' });
  }
  try {
    if (hasName) {
      await pool.execute('UPDATE files SET original_name = ? WHERE id = ?', [original_name.trim(), req.params.id]);
    }
    if (hasRole) {
      await pool.execute('UPDATE files SET material_role = ? WHERE id = ?', [material_role, req.params.id]);
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
