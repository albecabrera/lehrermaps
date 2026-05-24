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

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ groups: [] });
  const like = `%${q}%`;
  const uid = getUserId(req);
  try {
    const [rows] = await pool.execute(
      `SELECT
         n.id AS notebook_id, n.title AS notebook_title,
         s.id AS section_id, s.title AS section_title,
         p.id AS page_id, p.title AS page_title,
         b.id AS block_id,
         CASE
           WHEN JSON_UNQUOTE(JSON_EXTRACT(b.content, '$.text')) IS NOT NULL
             THEN JSON_UNQUOTE(JSON_EXTRACT(b.content, '$.text'))
           ELSE CAST(b.content AS CHAR)
         END AS snippet
       FROM notebooks n
       INNER JOIN sections s ON s.notebook_id = n.id
       INNER JOIN pages p ON p.section_id = s.id
       LEFT JOIN blocks b ON b.page_id = p.id
       WHERE n.user_id = ? AND (
         n.title LIKE ? OR s.title LIKE ? OR p.title LIKE ? OR CAST(b.content AS CHAR) LIKE ?
       )
       ORDER BY n.position ASC, s.position ASC, p.position ASC, b.z_index ASC
       LIMIT 200`,
      [uid, like, like, like, like]
    );

    const grouped = new Map();
    for (const r of rows) {
      if (!grouped.has(r.notebook_id)) {
        grouped.set(r.notebook_id, { notebook_id: r.notebook_id, notebook_title: r.notebook_title, results: [] });
      }
      grouped.get(r.notebook_id).results.push({
        page_id: r.page_id,
        page_title: r.page_title,
        section_id: r.section_id,
        section_title: r.section_title,
        snippet: String(r.snippet || '').replace(/\s+/g, ' ').slice(0, 80),
      });
    }

    res.json({ groups: Array.from(grouped.values()) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
