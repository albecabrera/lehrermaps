import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);

const userIdFor = (req) => Number(req.user?.id) || 1;

router.get('/app-rail', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT app_rail_order_json FROM app_preferences WHERE user_id = ?',
      [userIdFor(req)]
    );
    const order = rows[0]?.app_rail_order_json ? JSON.parse(rows[0].app_rail_order_json) : [];
    res.json({ order: Array.isArray(order) ? order : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/app-rail', teacherOnly, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0 || order.some((id) => typeof id !== 'string' || id.length > 80)) {
    return res.status(400).json({ error: 'order array required' });
  }
  try {
    await pool.execute(`
      INSERT INTO app_preferences (user_id, app_rail_order_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        app_rail_order_json = excluded.app_rail_order_json,
        updated_at = CURRENT_TIMESTAMP
    `, [userIdFor(req), JSON.stringify(order)]);
    res.json({ ok: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/randomizer', async (req, res) => {
  try {
    const [rosters] = await pool.execute('SELECT id, name, kind, last_groups_json FROM randomizer_rosters WHERE user_id = ? ORDER BY sort_order, id', [userIdFor(req)]);
    const result = [];
    for (const roster of rosters) {
      const [students] = await pool.execute('SELECT id, name FROM randomizer_students WHERE roster_id = ? ORDER BY sort_order, id', [roster.id]);
      let groups = [];
      try { groups = JSON.parse(roster.last_groups_json || '[]'); } catch {}
      result.push({ id: roster.id, name: roster.name, kind: roster.kind, students: students.map((student) => ({ id: student.id, name: student.name })), groups: Array.isArray(groups) ? groups : [] });
    }
    res.json({ rosters: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/randomizer', teacherOnly, async (req, res) => {
  const rosters = req.body?.rosters;
  if (!Array.isArray(rosters) || rosters.length > 50) return res.status(400).json({ error: 'rosters array required' });
  const normalized = rosters.map((roster, rosterIndex) => ({
    name: String(roster?.name || '').trim().slice(0, 120) || `Gruppe ${rosterIndex + 1}`,
    kind: roster?.kind === 'course' ? 'course' : 'class',
    groups: Array.isArray(roster?.groups) ? roster.groups.slice(0, 50).map((group) => Array.isArray(group) ? group.map((name) => String(name || '').trim().slice(0, 120)).filter(Boolean).slice(0, 200) : []) : [],
    students: Array.isArray(roster?.students) ? [...new Map(roster.students.map((student) => String(student?.name || '').trim().slice(0, 120)).filter(Boolean).map((name) => [name.toLocaleLowerCase(), name])).values()].slice(0, 200) : [],
  }));
  try {
    const userId = userIdFor(req);
    const persisted = [];
    pool.transaction((connection) => {
      connection.execute('DELETE FROM randomizer_rosters WHERE user_id = ?', [userId]);
      for (const [rosterIndex, roster] of normalized.entries()) {
        const [created] = connection.execute('INSERT INTO randomizer_rosters (user_id, name, kind, last_groups_json, sort_order) VALUES (?, ?, ?, ?, ?)', [userId, roster.name, roster.kind, JSON.stringify(roster.groups), rosterIndex]);
        const students = [];
        for (const [studentIndex, name] of roster.students.entries()) {
          const [student] = connection.execute('INSERT INTO randomizer_students (roster_id, name, sort_order) VALUES (?, ?, ?)', [created.insertId, name, studentIndex]);
          students.push({ id: student.insertId, name });
        }
        persisted.push({ id: created.insertId, name: roster.name, kind: roster.kind, students, groups: roster.groups });
      }
    });
    res.json({ ok: true, rosters: persisted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
