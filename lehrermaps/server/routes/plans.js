import { Router } from 'express';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

const ENTRY_TYPES = new Set(['lesson', 'holiday', 'exam', 'classwork', 'presentation', 'school_event', 'other']);

function teacherOnly(req, res, next) {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte' });
  return next();
}

function validDate(value, nullable = true) {
  if (nullable && (value === undefined || value === null || value === '')) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function validateRange(start, end) {
  if (!validDate(start, false) || !validDate(end)) return 'Ungültiges Datum';
  if (end && String(end) < String(start)) return 'Enddatum darf nicht vor dem Startdatum liegen';
  return null;
}

function materialIds(body = {}) {
  const files = Array.isArray(body.file_ids)
    ? body.file_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 100)
    : [];
  const folders = Array.isArray(body.folder_ids)
    ? body.folder_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 100)
    : [];
  return { files: [...new Set(files)], folders: [...new Set(folders)] };
}

async function getPlan(planId) {
  const [rows] = await pool.execute(`
    SELECT p.*, f.subject, f.group_name, f.name AS folder_name
    FROM annual_plans p
    INNER JOIN folders f ON f.id = p.root_folder_id
    WHERE p.id = ?
  `, [planId]);
  return rows[0] || null;
}

async function getEntries(planId) {
  const [entries] = await pool.execute(
    'SELECT * FROM annual_plan_entries WHERE plan_id = ? ORDER BY entry_date ASC, sort_order ASC, id ASC',
    [planId]
  );
  if (!entries.length) return [];
  const ids = entries.map((entry) => entry.id);
  const placeholders = ids.map(() => '?').join(',');
  const [materials] = await pool.execute(
    `SELECT entry_id, file_id, folder_id FROM annual_plan_materials WHERE entry_id IN (${placeholders})`,
    ids
  );
  const byEntry = new Map(entries.map((entry) => [entry.id, { ...entry, file_ids: [], folder_ids: [] }]));
  for (const material of materials) {
    const entry = byEntry.get(material.entry_id);
    if (material.file_id) entry.file_ids.push(material.file_id);
    if (material.folder_id) entry.folder_ids.push(material.folder_id);
  }
  return [...byEntry.values()];
}

async function replaceMaterials(connection, entryId, body) {
  const { files, folders } = materialIds(body);
  await connection.execute('DELETE FROM annual_plan_materials WHERE entry_id = ?', [entryId]);
  for (const fileId of files) {
    await connection.execute('INSERT IGNORE INTO annual_plan_materials (entry_id, file_id) VALUES (?, ?)', [entryId, fileId]);
  }
  for (const folderId of folders) {
    await connection.execute('INSERT IGNORE INTO annual_plan_materials (entry_id, folder_id) VALUES (?, ?)', [entryId, folderId]);
  }
}

router.get('/materials', teacherOnly, async (req, res) => {
  const rootId = Number(req.query.root_folder_id);
  const query = String(req.query.q || '').trim();
  if (!rootId) return res.status(400).json({ error: 'root_folder_id erforderlich' });
  try {
    const [roots] = await pool.execute('SELECT subject, group_name FROM folders WHERE id = ? AND parent_id IS NULL', [rootId]);
    if (!roots.length) return res.status(404).json({ error: 'Stammordner nicht gefunden' });
    const { subject, group_name: groupName } = roots[0];
    const pattern = `%${query}%`;
    const [folders] = await pool.execute(
      'SELECT id, name, parent_id FROM folders WHERE subject = ? AND group_name = ? AND name LIKE ? ORDER BY parent_id, sort_order, name LIMIT 100',
      [subject, groupName, pattern]
    );
    const [allFolderIds] = await pool.execute('SELECT id FROM folders WHERE subject = ? AND group_name = ?', [subject, groupName]);
    const ids = allFolderIds.map((folder) => folder.id);
    let files = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      [files] = await pool.execute(
        `SELECT id, folder_id, original_name FROM files WHERE folder_id IN (${placeholders}) AND original_name LIKE ? AND is_current_version = 1 ORDER BY original_name LIMIT 100`,
        [...ids, pattern]
      );
    }
    res.json({ folders, files });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/', teacherOnly, async (req, res) => {
  const folderId = Number(req.query.folder_id);
  const schoolYear = String(req.query.school_year || '').trim();
  if (!folderId || !schoolYear) return res.status(400).json({ error: 'folder_id und school_year erforderlich' });
  try {
    const [plans] = await pool.execute(
      'SELECT p.*, f.subject, f.group_name, f.name AS folder_name FROM annual_plans p INNER JOIN folders f ON f.id = p.root_folder_id WHERE p.root_folder_id = ? AND p.school_year = ?',
      [folderId, schoolYear]
    );
    if (!plans.length) return res.json({ plan: null, entries: [] });
    res.json({ plan: plans[0], entries: await getEntries(plans[0].id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', teacherOnly, async (req, res) => {
  const { root_folder_id, school_year, start_date = null, end_date = null } = req.body || {};
  const folderId = Number(root_folder_id);
  if (!folderId || !String(school_year || '').trim()) return res.status(400).json({ error: 'root_folder_id und school_year erforderlich' });
  if (start_date && !validDate(start_date) || end_date && !validDate(end_date)) return res.status(400).json({ error: 'Ungültiges Planungsdatum' });
  if (start_date && end_date && end_date < start_date) return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen' });
  try {
    const [folders] = await pool.execute('SELECT id FROM folders WHERE id = ? AND parent_id IS NULL', [folderId]);
    if (!folders.length) return res.status(400).json({ error: 'Nur ein Stammordner kann eine Jahresplanung besitzen' });
    const [result] = await pool.execute(
      'INSERT INTO annual_plans (root_folder_id, school_year, start_date, end_date) VALUES (?, ?, ?, ?)',
      [folderId, String(school_year).trim(), start_date || null, end_date || null]
    );
    res.status(201).json(await getPlan(result.insertId));
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Diese Jahresplanung existiert bereits' : error.message });
  }
});

router.patch('/:id', teacherOnly, async (req, res) => {
  const plan = await getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Jahresplanung nicht gefunden' });
  const schoolYear = String(req.body?.school_year ?? plan.school_year).trim();
  const startDate = req.body?.start_date ?? plan.start_date;
  const endDate = req.body?.end_date ?? plan.end_date;
  if (startDate && endDate && endDate < startDate) return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen' });
  try {
    await pool.execute('UPDATE annual_plans SET school_year = ?, start_date = ?, end_date = ? WHERE id = ?', [schoolYear, startDate || null, endDate || null, req.params.id]);
    res.json(await getPlan(req.params.id));
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.message });
  }
});

router.delete('/:id', teacherOnly, async (req, res) => {
  try { await pool.execute('DELETE FROM annual_plans WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/entries', teacherOnly, async (req, res) => {
  const plan = await getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Jahresplanung nicht gefunden' });
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const type = String(body.entry_type || 'lesson');
  const rangeError = validateRange(body.entry_date, body.end_date);
  if (!title || rangeError || !ENTRY_TYPES.has(type)) return res.status(400).json({ error: rangeError || 'Titel und gültiger Eintragstyp erforderlich' });
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        'INSERT INTO annual_plan_entries (plan_id, entry_date, end_date, entry_type, lesson_number, title, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [plan.id, body.entry_date, body.end_date || null, type, body.lesson_number || null, title, body.notes || null, Number(body.sort_order) || 0]
      );
      await replaceMaterials(connection, result.insertId, body);
      await connection.commit();
      const entries = await getEntries(plan.id);
      res.status(201).json(entries.find((entry) => entry.id === result.insertId));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/entries/:id', teacherOnly, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM annual_plan_entries WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Planungseintrag nicht gefunden' });
  const current = rows[0];
  const body = req.body || {};
  const nextDate = body.entry_date ?? current.entry_date;
  const nextEnd = body.end_date ?? current.end_date;
  const rangeError = validateRange(nextDate, nextEnd);
  if (rangeError) return res.status(400).json({ error: rangeError });
  const type = String(body.entry_type ?? current.entry_type);
  if (!ENTRY_TYPES.has(type)) return res.status(400).json({ error: 'Ungültiger Eintragstyp' });
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'UPDATE annual_plan_entries SET entry_date = ?, end_date = ?, entry_type = ?, lesson_number = ?, title = ?, notes = ?, sort_order = ? WHERE id = ?',
        [nextDate, nextEnd || null, type, body.lesson_number ?? current.lesson_number, String(body.title ?? current.title).trim(), body.notes ?? current.notes, Number(body.sort_order ?? current.sort_order) || 0, req.params.id]
      );
      if (body.file_ids !== undefined || body.folder_ids !== undefined) await replaceMaterials(connection, req.params.id, body);
      await connection.commit();
      const entries = await getEntries(current.plan_id);
      res.json(entries.find((entry) => entry.id === Number(req.params.id)));
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/entries/:id/duplicate', teacherOnly, async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM annual_plan_entries WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Planungseintrag nicht gefunden' });
  const entry = rows[0];
  try {
    const [result] = await pool.execute(
      'INSERT INTO annual_plan_entries (plan_id, entry_date, end_date, entry_type, lesson_number, title, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [entry.plan_id, entry.entry_date, entry.end_date, entry.entry_type, entry.lesson_number, entry.title, entry.notes, entry.sort_order]
    );
    const [materials] = await pool.execute('SELECT file_id, folder_id FROM annual_plan_materials WHERE entry_id = ?', [entry.id]);
    for (const material of materials) await pool.execute('INSERT IGNORE INTO annual_plan_materials (entry_id, file_id, folder_id) VALUES (?, ?, ?)', [result.insertId, material.file_id, material.folder_id]);
    const entries = await getEntries(entry.plan_id);
    res.status(201).json(entries.find((item) => item.id === result.insertId));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/entries/:id', teacherOnly, async (req, res) => {
  try { await pool.execute('DELETE FROM annual_plan_entries WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id/export.csv', teacherOnly, async (req, res) => {
  const plan = await getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Jahresplanung nicht gefunden' });
  const entries = await getEntries(plan.id);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ['Datum', 'Bis', 'Typ', 'Stunde', 'Titel', 'Notizen', 'Dateien', 'Ordner'].map(escape).join(';'),
    ...entries.map((entry) => [entry.entry_date, entry.end_date, entry.entry_type, entry.lesson_number, entry.title, entry.notes, entry.file_ids.join(','), entry.folder_ids.join(',')].map(escape).join(';')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Jahresplanung-${plan.school_year.replaceAll('/', '-')}.csv"`);
  res.send(`\uFEFF${lines.join('\n')}`);
});

export default router;
