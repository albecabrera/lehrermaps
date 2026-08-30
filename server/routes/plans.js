import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);
router.use(teacherOnly);

const ENTRY_TYPES = new Set(['lesson', 'holiday', 'exam', 'classwork', 'presentation', 'school_event', 'other']);

function validDate(value, nullable = true) {
  if (nullable && (value === undefined || value === null || value === '')) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

const isUniqueConflict = (error) => error?.errcode === 2067 || /UNIQUE constraint failed/i.test(error?.message || '');
const ENTRY_TEXT_FIELDS = ['content', 'learning_objectives', 'activities', 'homework'];

function validateRange(start, end) {
  if (!validDate(start, false) || !validDate(end)) return 'Ungültiges Datum';
  if (end && String(end) < String(start)) return 'Enddatum darf nicht vor dem Startdatum liegen';
  return null;
}

function validatePlanBounds(start, end, plan) {
  if (plan.start_date && start < plan.start_date) return 'Datum liegt vor dem Planungszeitraum';
  if (plan.end_date && (end || start) > plan.end_date) return 'Datum liegt nach dem Planungszeitraum';
  return null;
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
  const [entries] = await pool.execute(`
    SELECT e.*, s.status AS lesson_session_status,
      COUNT(DISTINCT p.id) AS lesson_phase_count,
      COUNT(DISTINCT lpm.id) AS lesson_material_count
    FROM annual_plan_entries e
    LEFT JOIN lesson_sessions s ON s.id = e.lesson_session_id
    LEFT JOIN lesson_phases p ON p.lesson_session_id = s.id
    LEFT JOIN lesson_phase_materials lpm ON lpm.phase_id = p.id
    WHERE e.plan_id = ?
    GROUP BY e.id
    ORDER BY e.entry_date ASC, e.sort_order ASC, e.id ASC
  `, [planId]);
  if (!entries.length) return [];
  const ids = entries.map((entry) => entry.id);
  const placeholders = ids.map(() => '?').join(',');
  const [materials] = await pool.execute(
    `SELECT entry_id, file_id, folder_id FROM annual_plan_materials WHERE entry_id IN (${placeholders})`,
    ids
  );
  const byEntry = new Map(entries.map((entry) => [entry.id, {
    ...entry,
    lesson_session: entry.lesson_session_id ? {
      id: entry.lesson_session_id,
      status: entry.lesson_session_status,
      phase_count: Number(entry.lesson_phase_count || 0),
      material_count: Number(entry.lesson_material_count || 0),
    } : null,
    file_ids: [], folder_ids: [],
  }]));
  for (const material of materials) {
    const entry = byEntry.get(material.entry_id);
    if (material.file_id) entry.file_ids.push(material.file_id);
    if (material.folder_id) entry.folder_ids.push(material.folder_id);
  }
  return [...byEntry.values()];
}

async function getEntry(entryId) {
  const [rows] = await pool.execute('SELECT plan_id FROM annual_plan_entries WHERE id = ?', [entryId]);
  if (!rows.length) return null;
  return (await getEntries(rows[0].plan_id)).find((entry) => Number(entry.id) === Number(entryId)) || null;
}

async function materialContext(entryId) {
  const [rows] = await pool.execute(`
    SELECT e.id, root.subject, root.group_name
    FROM annual_plan_entries e
    JOIN annual_plans p ON p.id = e.plan_id
    JOIN folders root ON root.id = p.root_folder_id
    WHERE e.id = ?
  `, [entryId]);
  return rows[0] || null;
}

async function validateMaterial(entryId, kind, materialId) {
  const context = await materialContext(entryId);
  if (!context) return { error: 'Planungseintrag nicht gefunden', status: 404 };
  const sql = kind === 'file'
    ? `SELECT fi.id FROM files fi JOIN folders f ON f.id = fi.folder_id
       WHERE fi.id = ? AND fi.is_current_version = 1 AND f.subject = ? AND f.group_name = ?`
    : 'SELECT id FROM folders WHERE id = ? AND subject = ? AND group_name = ?';
  const [rows] = await pool.execute(sql, [materialId, context.subject, context.group_name]);
  return rows.length ? { context } : { error: 'Material nicht gefunden oder gehört zu einer anderen Klasse', status: 400 };
}

router.get('/materials', teacherOnly, async (req, res) => {
  const rootId = Number(req.query.root_folder_id);
  const query = String(req.query.q || '').trim();
  if (!rootId) return res.status(400).json({ error: 'root_folder_id erforderlich' });
  try {
    // The client can open Jahresplanung from a nested folder. Material search
    // is scoped by subject/group, so requiring parent_id IS NULL here caused
    // a misleading 404 even though the active folder was valid.
    const [foldersForScope] = await pool.execute('SELECT subject, group_name FROM folders WHERE id = ?', [rootId]);
    if (!foldersForScope.length) return res.status(404).json({ error: 'Ordner nicht gefunden' });
    const { subject, group_name: groupName } = foldersForScope[0];
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
    res.status(isUniqueConflict(error) ? 409 : 500).json({ error: isUniqueConflict(error) ? 'Diese Jahresplanung existiert bereits' : error.message });
  }
});

router.patch('/:id', teacherOnly, async (req, res) => {
  const plan = await getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Jahresplanung nicht gefunden' });
  const schoolYear = String(req.body?.school_year ?? plan.school_year).trim();
  const startDate = req.body?.start_date ?? plan.start_date;
  const endDate = req.body?.end_date ?? plan.end_date;
  if (!validDate(startDate) || !validDate(endDate)) return res.status(400).json({ error: 'Ungültiges Planungsdatum' });
  if (startDate && endDate && endDate < startDate) return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen' });
  try {
    await pool.execute('UPDATE annual_plans SET school_year = ?, start_date = ?, end_date = ? WHERE id = ?', [schoolYear, startDate || null, endDate || null, req.params.id]);
    res.json(await getPlan(req.params.id));
  } catch (error) {
    res.status(isUniqueConflict(error) ? 409 : 500).json({ error: isUniqueConflict(error) ? 'Diese Jahresplanung existiert bereits' : error.message });
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
  const boundsError = !rangeError && validatePlanBounds(body.entry_date, body.end_date, plan);
  if (rangeError || boundsError || !ENTRY_TYPES.has(type)) return res.status(400).json({ error: rangeError || boundsError || 'Gültiger Eintragstyp erforderlich' });
  try {
    const result = pool.transaction((connection) => {
      const [inserted] = connection.execute(
        'INSERT INTO annual_plan_entries (plan_id, entry_date, end_date, entry_type, lesson_number, title, notes, sort_order, content, learning_objectives, activities, homework) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [plan.id, body.entry_date, body.end_date || null, type, body.lesson_number || null, title, body.notes || null, Number(body.sort_order) || 0, ...ENTRY_TEXT_FIELDS.map((field) => body[field] || null)]
      );
      return inserted;
    });
    const entries = await getEntries(plan.id);
    res.status(201).json(entries.find((entry) => entry.id === result.insertId));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/entries/:id', teacherOnly, async (req, res) => {
  const [rows] = await pool.execute('SELECT e.*, p.start_date AS plan_start_date, p.end_date AS plan_end_date FROM annual_plan_entries e JOIN annual_plans p ON p.id=e.plan_id WHERE e.id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Planungseintrag nicht gefunden' });
  const current = rows[0];
  const body = req.body || {};
  const nextDate = body.entry_date ?? current.entry_date;
  const nextEnd = Object.prototype.hasOwnProperty.call(body, 'end_date') ? body.end_date : current.end_date;
  const rangeError = validateRange(nextDate, nextEnd);
  const boundsError = !rangeError && validatePlanBounds(nextDate, nextEnd, { start_date: current.plan_start_date, end_date: current.plan_end_date });
  if (rangeError || boundsError) return res.status(400).json({ error: rangeError || boundsError });
  const type = String(body.entry_type ?? current.entry_type);
  if (!ENTRY_TYPES.has(type)) return res.status(400).json({ error: 'Ungültiger Eintragstyp' });
  const title = Object.prototype.hasOwnProperty.call(body, 'title') ? String(body.title || '').trim() : current.title;
  try {
    const values = [nextDate, nextEnd || null, type,
        Object.prototype.hasOwnProperty.call(body, 'lesson_number') ? body.lesson_number || null : current.lesson_number,
        title,
        Object.prototype.hasOwnProperty.call(body, 'notes') ? body.notes || null : current.notes,
        Object.prototype.hasOwnProperty.call(body, 'sort_order') ? Number(body.sort_order) || 0 : current.sort_order,
        ...ENTRY_TEXT_FIELDS.map((field) => Object.prototype.hasOwnProperty.call(body, field) ? body[field] || null : current[field]),
        req.params.id];
    pool.transaction((connection) => {
      connection.execute(
        'UPDATE annual_plan_entries SET entry_date = ?, end_date = ?, entry_type = ?, lesson_number = ?, title = ?, notes = ?, sort_order = ?, content = ?, learning_objectives = ?, activities = ?, homework = ? WHERE id = ?',
        values
      );
    });
    const entries = await getEntries(current.plan_id);
    res.json(entries.find((entry) => entry.id === Number(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/entries/:id/materials', teacherOnly, async (req, res) => {
  const kind = req.body?.kind;
  const materialId = Number(req.body?.id);
  if (!['file', 'folder'].includes(kind) || !Number.isInteger(materialId) || materialId < 1) {
    return res.status(400).json({ error: 'Materialtyp und ID erforderlich' });
  }
  try {
    const validation = await validateMaterial(req.params.id, kind, materialId);
    if (validation.error) return res.status(validation.status).json({ error: validation.error });
    const column = kind === 'file' ? 'file_id' : 'folder_id';
    await pool.execute(`INSERT OR IGNORE INTO annual_plan_materials (entry_id, ${column}) VALUES (?, ?)`, [req.params.id, materialId]);
    res.json(await getEntry(req.params.id));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/entries/:id/materials/:kind/:materialId', teacherOnly, async (req, res) => {
  const kind = req.params.kind;
  const materialId = Number(req.params.materialId);
  if (!['file', 'folder'].includes(kind) || !Number.isInteger(materialId) || materialId < 1) {
    return res.status(400).json({ error: 'Ungültiges Material' });
  }
  try {
    if (!await materialContext(req.params.id)) return res.status(404).json({ error: 'Planungseintrag nicht gefunden' });
    const column = kind === 'file' ? 'file_id' : 'folder_id';
    await pool.execute(`DELETE FROM annual_plan_materials WHERE entry_id = ? AND ${column} = ?`, [req.params.id, materialId]);
    res.json(await getEntry(req.params.id));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/entries/:id/lesson-session', teacherOnly, async (req, res) => {
  const userId = req.user?.id || 1;
  try {
    const result = pool.transaction((connection) => {
      const [rows] = connection.execute(`
        SELECT e.*, p.root_folder_id, f.subject, f.group_name
        FROM annual_plan_entries e
        JOIN annual_plans p ON p.id = e.plan_id
        JOIN folders f ON f.id = p.root_folder_id
        WHERE e.id = ?
      `, [req.params.id]);
      const entry = rows[0];
      if (!entry) return { status: 404, error: 'Planungseintrag nicht gefunden' };
      if (entry.entry_type !== 'lesson') return { status: 400, error: 'Nur Unterrichtseinträge können gestartet werden' };

      let sessionId = entry.lesson_session_id;
      if (sessionId) {
        const [existing] = connection.execute('SELECT id FROM lesson_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (!existing.length) sessionId = null;
      }
      if (!sessionId) {
        const [created] = connection.execute(
        `INSERT INTO lesson_sessions (user_id, folder_id, title, lesson_date, class_name, subject, learning_goal, teacher_notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [userId, entry.root_folder_id, entry.title || 'Unterricht', entry.entry_date, entry.group_name || null, entry.subject || null, entry.content || null, null]
        );
        sessionId = created.insertId;
        const phaseDefinitions = [['Einstieg', 300], ['Erarbeitung', 900], ['Partnerarbeit', 600], ['Sicherung', 600], ['Abschluss', 300]];
        let firstPhaseId;
        for (const [position, [phaseTitle, duration]] of phaseDefinitions.entries()) {
          const [phase] = connection.execute(
            'INSERT INTO lesson_phases (lesson_session_id, position, title, duration_seconds) VALUES (?, ?, ?, ?)',
            [sessionId, position, phaseTitle, duration]
          );
          if (position === 0) firstPhaseId = phase.insertId;
        }
        const [materials] = connection.execute('SELECT file_id, folder_id FROM annual_plan_materials WHERE entry_id = ?', [entry.id]);
        for (const material of materials) {
          connection.execute(
            `INSERT OR IGNORE INTO lesson_phase_materials (phase_id, file_id, folder_id, visibility, position) VALUES (?, ?, ?, 'private', 0)`,
            [firstPhaseId, material.file_id || null, material.folder_id || null]
          );
        }
        connection.execute('UPDATE annual_plan_entries SET lesson_session_id = ? WHERE id = ?', [sessionId, entry.id]);
      } else {
        // Planning remains the source of truth only for these general fields.
        // Phase content, timers, teacher notes and student responses are never touched.
        connection.execute(
          'UPDATE lesson_sessions SET lesson_date = ?, title = ?, learning_goal = ? WHERE id = ? AND user_id = ?',
          [entry.entry_date, entry.title || 'Unterricht', entry.content || null, sessionId, userId]
        );
      }
      const [sessions] = connection.execute('SELECT * FROM lesson_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
      return { session: sessions[0], entryId: entry.id };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    const entryWithSession = await getEntry(result.entryId);
    res.status(200).json({ session: result.session, entry: entryWithSession });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/entries/:id/duplicate', teacherOnly, async (req, res) => {
  try {
    const duplicated = pool.transaction((connection) => {
      const [rows] = connection.execute('SELECT * FROM annual_plan_entries WHERE id = ?', [req.params.id]);
      if (!rows.length) return null;
      const entry = rows[0];
      const [result] = connection.execute(
        `INSERT INTO annual_plan_entries
          (plan_id, entry_date, end_date, entry_type, lesson_number, title, notes, sort_order, content, learning_objectives, activities, homework, lesson_session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [entry.plan_id, entry.entry_date, entry.end_date, entry.entry_type, entry.lesson_number, entry.title, entry.notes, entry.sort_order, ...ENTRY_TEXT_FIELDS.map((field) => entry[field])]
      );
      const [materials] = connection.execute('SELECT file_id, folder_id FROM annual_plan_materials WHERE entry_id = ?', [entry.id]);
      for (const material of materials) connection.execute('INSERT OR IGNORE INTO annual_plan_materials (entry_id, file_id, folder_id) VALUES (?, ?, ?)', [result.insertId, material.file_id, material.folder_id]);
      return { id: result.insertId, planId: entry.plan_id };
    });
    if (!duplicated) return res.status(404).json({ error: 'Planungseintrag nicht gefunden' });
    const entries = await getEntries(duplicated.planId);
    res.status(201).json(entries.find((item) => item.id === duplicated.id));
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
    ['Datum', 'Bis', 'Typ', 'Stunde', 'Titel', 'Notizen', 'Inhalt', 'Lernziele', 'Aktivitäten', 'Hausaufgaben', 'Dateien', 'Ordner'].map(escape).join(';'),
    ...entries.map((entry) => [entry.entry_date, entry.end_date, entry.entry_type, entry.lesson_number, entry.title, entry.notes, entry.content, entry.learning_objectives, entry.activities, entry.homework, entry.file_ids.join(','), entry.folder_ids.join(',')].map(escape).join(';')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Jahresplanung-${plan.school_year.replaceAll('/', '-')}.csv"`);
  res.send(`\uFEFF${lines.join('\n')}`);
});

export default router;
