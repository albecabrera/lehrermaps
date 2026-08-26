import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

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
    if (req.user?.role === 'student') {
      // Return only folders that lead to shared material.  The projection is
      // deliberately small so private notes, deadlines and usage metadata
      // never cross the API boundary.
      const [allFolders] = await pool.execute('SELECT id, subject, group_name, name, parent_id, sort_order FROM folders');
      const [visibleRows] = await pool.execute(`
        SELECT DISTINCT f.id FROM folders f
        WHERE EXISTS (SELECT 1 FROM files fi WHERE fi.folder_id = f.id AND fi.is_shared = 1 AND fi.is_current_version = 1)
           OR EXISTS (SELECT 1 FROM links li WHERE li.folder_id = f.id AND li.is_shared = 1)
      `);
      const byId = new Map(allFolders.map((folder) => [Number(folder.id), folder]));
      const visible = new Set(visibleRows.map((row) => Number(row.id)));
      for (const id of [...visible]) {
        let parent = byId.get(id)?.parent_id;
        while (parent != null && byId.has(Number(parent))) {
          visible.add(Number(parent));
          parent = byId.get(Number(parent)).parent_id;
        }
      }
      return res.json(allFolders.filter((folder) => visible.has(Number(folder.id))));
    }
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

router.post('/', teacherOnly, async (req, res) => {
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
router.put('/reorder', teacherOnly, async (req, res) => {
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

router.put('/:id/favorite', teacherOnly, async (req, res) => {
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

router.put('/:id/move', teacherOnly, async (req, res) => {
  const folderId = Number(req.params.id);
  const { parent_id } = req.body;
  const placement = ['before', 'after', 'inside'].includes(req.body.placement)
    ? req.body.placement
    : 'inside';
  const newParentId = parent_id ? Number(parent_id) : null;

  if (newParentId === folderId) return res.status(400).json({ error: 'Zirkelreferenz' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [selected] = await conn.execute(
      'SELECT id, subject, group_name, parent_id FROM folders WHERE id IN (?, ?)',
      [folderId, newParentId || 0]
    );
    const source = selected.find((folder) => folder.id === folderId);
    const target = newParentId ? selected.find((folder) => folder.id === newParentId) : null;
    if (!source) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ordner nicht gefunden' });
    }

    if (placement !== 'inside' && !target) {
      await conn.rollback();
      return res.status(404).json({ error: 'Zielordner nicht gefunden' });
    }

    if (placement === 'inside' && newParentId) {
      const [all] = await conn.execute('SELECT id, parent_id FROM folders');
      // Walk up from newParentId to detect cycle
      let cur = newParentId;
      while (cur !== null) {
        if (cur === folderId) {
          await conn.rollback();
          return res.status(400).json({ error: 'Zirkelreferenz' });
        }
        const found = all.find((f) => f.id === cur);
        cur = found ? (found.parent_id ?? null) : null;
      }
      await conn.execute(
        'UPDATE folders SET parent_id = ?, group_name = ? WHERE id = ?',
        [newParentId, target.group_name, folderId]
      );
    } else if (placement === 'inside') {
      await conn.execute('UPDATE folders SET parent_id = NULL WHERE id = ?', [folderId]);
    } else {
      if (source.subject !== target.subject) {
        await conn.rollback();
        return res.status(400).json({ error: 'Ordner müssen derselben Fachstruktur angehören' });
      }

      const destinationParentId = target.parent_id ?? null;
      const [all] = await conn.execute('SELECT id, parent_id FROM folders');
      let cur = destinationParentId;
      while (cur !== null) {
        if (cur === folderId) {
          await conn.rollback();
          return res.status(400).json({ error: 'Zirkelreferenz' });
        }
        const found = all.find((folder) => folder.id === cur);
        cur = found ? (found.parent_id ?? null) : null;
      }
      const [siblings] = await conn.execute(
        `SELECT id FROM folders
         WHERE subject = ? AND parent_id <=> ?
         ORDER BY sort_order ASC, name ASC`,
        [target.subject, destinationParentId]
      );
      const orderedIds = siblings.map((folder) => folder.id).filter((id) => id !== folderId);
      const targetIndex = orderedIds.indexOf(target.id);
      const insertAt = placement === 'after' ? targetIndex + 1 : targetIndex;
      orderedIds.splice(Math.max(insertAt, 0), 0, folderId);

      await conn.execute(
        'UPDATE folders SET parent_id = ? WHERE id = ?',
        [destinationParentId, folderId]
      );
      for (const [index, id] of orderedIds.entries()) {
        await conn.execute('UPDATE folders SET sort_order = ? WHERE id = ?', [index, id]);
      }
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

router.put('/:id', teacherOnly, async (req, res) => {
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

router.put('/:id/notes', teacherOnly, async (req, res) => {
  const { content } = req.body;
  try {
    await pool.execute('UPDATE folders SET notes = ? WHERE id = ?', [content ?? '', req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/color', teacherOnly, async (req, res) => {
  const { color } = req.body;
  try {
    await pool.execute('UPDATE folders SET color = ? WHERE id = ?', [color || null, req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/deadline', teacherOnly, async (req, res) => {
  const { due_at } = req.body;
  try {
    await pool.execute('UPDATE folders SET due_at = ? WHERE id = ?', [due_at || null, req.params.id]);
    const [rows] = await pool.execute(FOLDER_WITH_COUNT, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', teacherOnly, async (req, res) => {
  try {
    await pool.execute('DELETE FROM folders WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
