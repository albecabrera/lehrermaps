import { Router } from 'express';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
} from 'docx';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const router = Router();
router.use(auth);

const FOLDER_WITH_COUNT = `
  SELECT f.*, COUNT(fi.id) AS file_count
  FROM folders f
  LEFT JOIN files fi ON fi.folder_id = f.id
  WHERE f.id = ?
  GROUP BY f.id
`;

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT f.*, COUNT(fi.id) AS file_count, COALESCE(SUM(fi.size_bytes), 0) AS total_size_bytes,
        (SELECT fi2.id FROM files fi2 WHERE fi2.folder_id = f.id AND fi2.mime_type LIKE 'image/%' ORDER BY fi2.uploaded_at DESC LIMIT 1) AS thumbnail_file_id
      FROM folders f
      LEFT JOIN files fi ON fi.folder_id = f.id
      GROUP BY f.id
      ORDER BY f.subject, f.group_name, f.parent_id, f.sort_order, f.name
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { subject, group_name, name, parent_id } = req.body;
  if (!subject || !group_name || !name) {
    return res.status(400).json({ error: 'subject, group_name und name erforderlich' });
  }
  const pid = parent_id ? Number(parent_id) : null;
  try {
    if (pid) {
      const [check] = await pool.execute('SELECT id FROM folders WHERE id = ?', [pid]);
      if (!check.length) return res.status(400).json({ error: 'Überordner nicht gefunden' });
    }
    const [result] = await pool.execute(
      'INSERT INTO folders (subject, group_name, name, parent_id) VALUES (?, ?, ?, ?)',
      [subject, group_name, name, pid]
    );
    const [rows] = await pool.execute(
      'SELECT *, 0 AS file_count, 0 AS total_size_bytes FROM folders WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Must come before /:id
router.put('/reorder', async (req, res) => {
  const { items } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { id, sort_order } of items) {
      await conn.execute('UPDATE folders SET sort_order = ? WHERE id = ?', [sort_order, id]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

router.put('/:id/favorite', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE folders SET is_favorite = IF(is_favorite=1, 0, 1) WHERE id = ?',
      [req.params.id]
    );
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/move', async (req, res) => {
  const folderId = Number(req.params.id);
  const { parent_id } = req.body;
  const newParentId = parent_id ? Number(parent_id) : null;

  if (newParentId === folderId) return res.status(400).json({ error: 'Zirkelreferenz' });

  try {
    if (newParentId) {
      const [all] = await pool.execute('SELECT id, parent_id FROM folders');
      // Walk up from newParentId to detect cycle
      let cur = newParentId;
      while (cur !== null) {
        if (cur === folderId) return res.status(400).json({ error: 'Zirkelreferenz' });
        const found = all.find((f) => f.id === cur);
        cur = found ? (found.parent_id ?? null) : null;
      }
      const [target] = await pool.execute('SELECT group_name FROM folders WHERE id = ?', [newParentId]);
      if (!target.length) return res.status(404).json({ error: 'Zielordner nicht gefunden' });
      await pool.execute(
        'UPDATE folders SET parent_id = ?, group_name = ? WHERE id = ?',
        [newParentId, target[0].group_name, folderId]
      );
    } else {
      await pool.execute('UPDATE folders SET parent_id = NULL WHERE id = ?', [folderId]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name erforderlich' });
  try {
    await pool.execute('UPDATE folders SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/notes', async (req, res) => {
  const { content } = req.body;
  try {
    await pool.execute('UPDATE folders SET notes = ? WHERE id = ?', [content ?? '', req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/color', async (req, res) => {
  const { color } = req.body;
  try {
    await pool.execute('UPDATE folders SET color = ? WHERE id = ?', [color || null, req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/deadline', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nicht erlaubt' });
  const { due_at } = req.body;
  try {
    await pool.execute('UPDATE folders SET due_at = ? WHERE id = ?', [due_at || null, req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM folders WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/init-unterrichtsreihe', async (req, res) => {
  const folderId = Number(req.params.id);
  if (!folderId) return res.status(400).json({ error: 'id inválido' });
  try {
    const [parentRows] = await pool.execute('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (!parentRows.length) return res.status(404).json({ error: 'Ordner nicht gefunden' });
    const parent = parentRows[0];

    const [existing] = await pool.execute(
      'SELECT id FROM folders WHERE parent_id = ? AND name = ?',
      [folderId, 'Unterrichtsreihe']
    );

    let subId;
    if (existing.length) {
      subId = existing[0].id;
    } else {
      const [ins] = await pool.execute(
        'INSERT INTO folders (subject, group_name, name, parent_id) VALUES (?, ?, ?, ?)',
        [parent.subject, parent.group_name, 'Unterrichtsreihe', folderId]
      );
      subId = ins.insertId;
    }

    const docBuffer = await buildUnterrichtsreiheDok(parent.name);
    await mkdir(UPLOADS_DIR, { recursive: true });
    const storedName = randomUUID();
    await writeFile(path.join(UPLOADS_DIR, storedName), docBuffer);

    const safeName = parent.name.replace(/[^\wäöüÄÖÜß\s\-]/g, '').trim();
    const originalName = `Planung_Unterrichtsreihe_${safeName}.docx`;

    const [fileIns] = await pool.execute(
      'INSERT INTO files (folder_id, original_name, stored_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)',
      [subId, originalName, storedName,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        docBuffer.length]
    );

    res.status(201).json({ subfolder_id: subId, file_id: fileIns.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function buildUnterrichtsreiheDok(folderName) {
  const HEADER_FILL = '1E3A5F';
  const ALT_FILL   = 'EEF2FF';

  const COLS = [
    { label: 'Nr.',                  pct: 5  },
    { label: 'Datum',                pct: 9  },
    { label: 'Thema / Schwerpunkt',  pct: 24 },
    { label: 'Lernziele',            pct: 20 },
    { label: 'Methoden',             pct: 16 },
    { label: 'Materialien',          pct: 16 },
    { label: 'HA / Notizen',         pct: 10 },
  ];

  const border = {
    top:    { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
    left:   { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
    right:  { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: COLS.map((c) => new TableCell({
      width: { size: c.pct, type: WidthType.PERCENTAGE },
      borders: border,
      shading: { type: ShadingType.SOLID, fill: HEADER_FILL },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: c.label, bold: true, color: 'FFFFFF', size: 18 })],
      })],
    })),
  });

  const dataRows = Array.from({ length: 14 }, (_, i) => new TableRow({
    children: COLS.map((c, j) => new TableCell({
      width: { size: c.pct, type: WidthType.PERCENTAGE },
      borders: border,
      shading: i % 2 === 0
        ? undefined
        : { type: ShadingType.SOLID, fill: ALT_FILL },
      children: [new Paragraph({
        children: [new TextRun({
          text: j === 0 ? String(i + 1) : '',
          size: 18,
          color: '374151',
        })],
      })],
    })),
  }));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
          size: { orientation: 'landscape' },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Planung der Unterrichtsreihe', bold: true, size: 36, color: '1E3A5F' })],
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: folderName, bold: true, size: 28, color: '374151' })],
          spacing: { after: 240 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Fach: ', bold: true, size: 20 }),
            new TextRun({ text: '____________________    ', size: 20 }),
            new TextRun({ text: 'Klasse: ', bold: true, size: 20 }),
            new TextRun({ text: '____________________    ', size: 20 }),
            new TextRun({ text: 'Schuljahr: ', bold: true, size: 20 }),
            new TextRun({ text: '____________________', size: 20 }),
          ],
          spacing: { after: 360 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

export default router;
