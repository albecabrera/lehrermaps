import { Router } from 'express';
import pool from '../db.js';
import auth from '../middleware/auth.js';

const router = Router();
router.use(auth);

function getUserId(req) {
  if (Number.isInteger(req.user?.user_id)) return req.user.user_id;
  if (req.user?.role === 'lehrer') return 1;
  if (req.user?.role === 'student') return 2;
  return 0;
}

router.get('/notebooks', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM notebooks WHERE user_id = ? ORDER BY position ASC, title ASC',
      [getUserId(req)]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/notebooks', async (req, res) => {
  const { title, color = '#3B82F6' } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  try {
    const [max] = await pool.execute('SELECT COALESCE(MAX(position), -1) AS p FROM notebooks WHERE user_id = ?', [getUserId(req)]);
    const position = Number(max?.[0]?.p ?? -1) + 1;
    const [result] = await pool.execute(
      'INSERT INTO notebooks (user_id, title, color, position) VALUES (?, ?, ?, ?)',
      [getUserId(req), title.trim(), color, position]
    );
    const [rows] = await pool.execute('SELECT * FROM notebooks WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/notebooks/:id', async (req, res) => {
  const { title, color, position } = req.body || {};
  const notebookId = Number(req.params.id);
  try {
    const [rows] = await pool.execute('SELECT * FROM notebooks WHERE id = ? AND user_id = ?', [notebookId, getUserId(req)]);
    if (!rows.length) return res.status(404).json({ error: 'notebook not found' });
    const nextTitle = title?.trim() || rows[0].title;
    const nextColor = color || rows[0].color;
    const nextPosition = Number.isFinite(Number(position)) ? Number(position) : rows[0].position;
    await pool.execute('UPDATE notebooks SET title = ?, color = ?, position = ? WHERE id = ?', [nextTitle, nextColor, nextPosition, notebookId]);
    const [updated] = await pool.execute('SELECT * FROM notebooks WHERE id = ?', [notebookId]);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/notebooks/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM notebooks WHERE id = ? AND user_id = ?', [req.params.id, getUserId(req)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/sections/:notebookId', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.* FROM sections s
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE s.notebook_id = ? AND n.user_id = ?
       ORDER BY s.position ASC, s.title ASC`,
      [req.params.notebookId, getUserId(req)]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/sections', async (req, res) => {
  const { notebook_id, title, color = '#64748B' } = req.body || {};
  if (!notebook_id || !title?.trim()) return res.status(400).json({ error: 'notebook_id and title required' });
  try {
    const [owns] = await pool.execute('SELECT id FROM notebooks WHERE id = ? AND user_id = ?', [notebook_id, getUserId(req)]);
    if (!owns.length) return res.status(404).json({ error: 'notebook not found' });
    const [max] = await pool.execute('SELECT COALESCE(MAX(position), -1) AS p FROM sections WHERE notebook_id = ?', [notebook_id]);
    const position = Number(max?.[0]?.p ?? -1) + 1;
    const [result] = await pool.execute(
      'INSERT INTO sections (notebook_id, title, color, position) VALUES (?, ?, ?, ?)',
      [notebook_id, title.trim(), color, position]
    );
    const [rows] = await pool.execute('SELECT * FROM sections WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/sections/:id', async (req, res) => {
  const { title, color, position } = req.body || {};
  try {
    const [rows] = await pool.execute(
      `SELECT s.* FROM sections s
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE s.id = ? AND n.user_id = ?`,
      [req.params.id, getUserId(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'section not found' });
    const cur = rows[0];
    await pool.execute(
      'UPDATE sections SET title = ?, color = ?, position = ? WHERE id = ?',
      [title?.trim() || cur.title, color || cur.color, Number.isFinite(Number(position)) ? Number(position) : cur.position, req.params.id]
    );
    const [updated] = await pool.execute('SELECT * FROM sections WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    await pool.execute(
      `DELETE s FROM sections s
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE s.id = ? AND n.user_id = ?`,
      [req.params.id, getUserId(req)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/pages/:sectionId', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.* FROM pages p
       INNER JOIN sections s ON s.id = p.section_id
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE p.section_id = ? AND n.user_id = ?
       ORDER BY p.position ASC, p.title ASC`,
      [req.params.sectionId, getUserId(req)]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/pages', async (req, res) => {
  const { section_id, title, template_id = null } = req.body || {};
  if (!section_id || !title?.trim()) return res.status(400).json({ error: 'section_id and title required' });
  try {
    const [owns] = await pool.execute(
      `SELECT s.id FROM sections s
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE s.id = ? AND n.user_id = ?`,
      [section_id, getUserId(req)]
    );
    if (!owns.length) return res.status(404).json({ error: 'section not found' });
    const [max] = await pool.execute('SELECT COALESCE(MAX(position), -1) AS p FROM pages WHERE section_id = ?', [section_id]);
    const position = Number(max?.[0]?.p ?? -1) + 1;
    const [result] = await pool.execute(
      'INSERT INTO pages (section_id, title, template_id, position) VALUES (?, ?, ?, ?)',
      [section_id, title.trim(), template_id, position]
    );
    const [rows] = await pool.execute('SELECT * FROM pages WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/pages/:id', async (req, res) => {
  const { title, template_id, position } = req.body || {};
  try {
    const [rows] = await pool.execute(
      `SELECT p.* FROM pages p
       INNER JOIN sections s ON s.id = p.section_id
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE p.id = ? AND n.user_id = ?`,
      [req.params.id, getUserId(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'page not found' });
    const cur = rows[0];
    await pool.execute(
      'UPDATE pages SET title = ?, template_id = ?, position = ? WHERE id = ?',
      [title?.trim() || cur.title, template_id ?? cur.template_id, Number.isFinite(Number(position)) ? Number(position) : cur.position, req.params.id]
    );
    const [updated] = await pool.execute('SELECT * FROM pages WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/pages/:id', async (req, res) => {
  try {
    await pool.execute(
      `DELETE p FROM pages p
       INNER JOIN sections s ON s.id = p.section_id
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE p.id = ? AND n.user_id = ?`,
      [req.params.id, getUserId(req)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/blocks/:pageId', async (req, res) => {
  try {
    const [owns] = await pool.execute(
      `SELECT p.id FROM pages p
       INNER JOIN sections s ON s.id = p.section_id
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE p.id = ? AND n.user_id = ?`,
      [req.params.pageId, getUserId(req)]
    );
    if (!owns.length) return res.status(404).json({ error: 'page not found' });
    const [rows] = await pool.execute(
      'SELECT * FROM blocks WHERE page_id = ? ORDER BY z_index ASC, id ASC',
      [req.params.pageId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/blocks/:pageId', async (req, res) => {
  const { blocks } = req.body || {};
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks array required' });
  const pageId = Number(req.params.pageId);
  const conn = await pool.getConnection();
  try {
    const [owns] = await conn.execute(
      `SELECT p.id FROM pages p
       INNER JOIN sections s ON s.id = p.section_id
       INNER JOIN notebooks n ON n.id = s.notebook_id
       WHERE p.id = ? AND n.user_id = ?`,
      [pageId, getUserId(req)]
    );
    if (!owns.length) return res.status(404).json({ error: 'page not found' });

    await conn.beginTransaction();
    await conn.execute('DELETE FROM blocks WHERE page_id = ?', [pageId]);
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i] || {};
      await conn.execute(
        'INSERT INTO blocks (page_id, type, content, pos_x, pos_y, width, z_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          pageId,
          String(b.type || 'text'),
          JSON.stringify(b.content || {}),
          Number(b.pos_x || 0),
          Number(b.pos_y || 0),
          Number(b.width || 420),
          Number.isFinite(Number(b.z_index)) ? Number(b.z_index) : (i + 1),
        ]
      );
    }
    await conn.commit();
    const [rows] = await conn.execute('SELECT * FROM blocks WHERE page_id = ? ORDER BY z_index ASC, id ASC', [pageId]);
    res.json(rows);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

router.get('/quicknotes', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM quick_notes WHERE user_id = ? ORDER BY created_at DESC',
      [getUserId(req)]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/quicknotes', async (req, res) => {
  const { content = '' } = req.body || {};
  try {
    const [result] = await pool.execute(
      'INSERT INTO quick_notes (user_id, content) VALUES (?, ?)',
      [getUserId(req), content]
    );
    const [rows] = await pool.execute('SELECT * FROM quick_notes WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/quicknotes/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM quick_notes WHERE id = ? AND user_id = ?', [req.params.id, getUserId(req)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
