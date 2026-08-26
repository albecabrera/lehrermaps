import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';

const router = Router();
router.use(auth);
router.use((req, res, next) => {
  if (req.user?.role === 'student') return res.status(403).json({ error: 'Nicht erlaubt' });
  return next();
});

const phaseFields = 'id, lesson_session_id, position, title, duration_seconds, description, teacher_notes, student_instruction, student_responses, status, timer_state, timer_started_at, timer_remaining_seconds';

async function getSession(id, userId = null) {
  const [rows] = await pool.execute(`SELECT * FROM lesson_sessions WHERE id = ?${userId ? ' AND user_id = ?' : ''}`, userId ? [id, userId] : [id]);
  return rows[0] || null;
}

async function withPhases(session) {
  if (!session) return null;
  const [phases] = await pool.execute(`SELECT ${phaseFields} FROM lesson_phases WHERE lesson_session_id = ? ORDER BY position, id`, [session.id]);
  return { ...session, phases };
}

async function ownedPhase(phaseId, userId) {
  const [rows] = await pool.execute('SELECT p.id, p.lesson_session_id FROM lesson_phases p JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE p.id = ? AND s.user_id = ?', [phaseId, userId]);
  return rows[0] || null;
}

async function canvasForPhase(phaseId, create = true) {
  let [rows] = await pool.execute('SELECT * FROM lesson_phase_canvases WHERE phase_id = ? AND is_active = 1 LIMIT 1', [phaseId]);
  if (!rows.length && create) {
    const [result] = await pool.execute("INSERT INTO lesson_phase_canvases (phase_id) VALUES (?)", [phaseId]);
    [rows] = await pool.execute('SELECT * FROM lesson_phase_canvases WHERE id = ?', [result.insertId]);
  }
  if (!rows.length) return null;
  const [elements] = await pool.execute('SELECT * FROM lesson_phase_elements WHERE canvas_id = ? ORDER BY layer, id', [rows[0].id]);
  return { ...rows[0], elements: elements.map((element) => ({ ...element, content: parseJson(element.content_json), position: parseJson(element.position_json), style: parseJson(element.style_json) })) };
}

function parseJson(value) { try { return value ? JSON.parse(value) : {}; } catch { return {}; } }
function json(value) { return JSON.stringify(value ?? {}); }

router.get('/lesson-sessions/:id/canvas', async (req, res) => {
  try {
    const session = await getSession(req.params.id, req.user?.id || 1);
    if (!session) return res.status(404).json({ error: 'Stunde nicht gefunden' });
    const [phases] = await pool.execute('SELECT id FROM lesson_phases WHERE lesson_session_id = ? ORDER BY position, id', [session.id]);
    const phaseId = Number(req.query.phase_id) || phases[0]?.id;
    if (!phaseId || !phases.some((phase) => Number(phase.id) === phaseId)) return res.status(404).json({ error: 'Phase nicht gefunden' });
    res.json(await canvasForPhase(phaseId));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/lesson-sessions/:id/canvas', teacherOnly, async (req, res) => {
  try {
    const session = await getSession(req.params.id, req.user?.id || 1);
    const phase = await ownedPhase(req.body?.phase_id, req.user?.id || 1);
    if (!session || !phase || Number(phase.lesson_session_id) !== Number(session.id)) return res.status(404).json({ error: 'Phase nicht gefunden' });
    const canvas = await canvasForPhase(phase.id);
    const body = req.body || {};
    const [result] = await pool.execute('INSERT INTO lesson_phase_elements (canvas_id, type, content_json, position_json, style_json, visibility, layer, is_live_annotation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [canvas.id, body.type || 'text', json(body.content), json(body.position), json(body.style), ['private', 'ready', 'displayed', 'solution', 'student'].includes(body.visibility) ? body.visibility : 'private', Number(body.layer) || 0, body.is_live_annotation ? 1 : 0]);
    const [rows] = await pool.execute('SELECT * FROM lesson_phase_elements WHERE id = ?', [result.insertId]);
    res.status(201).json({ ...rows[0], content: parseJson(rows[0].content_json), position: parseJson(rows[0].position_json), style: parseJson(rows[0].style_json) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/lesson-canvas-elements/:id', teacherOnly, async (req, res) => {
  try {
    const [owned] = await pool.execute('SELECT e.id FROM lesson_phase_elements e JOIN lesson_phase_canvases c ON c.id = e.canvas_id JOIN lesson_phases p ON p.id = c.phase_id JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE e.id = ? AND s.user_id = ?', [req.params.id, req.user?.id || 1]);
    if (!owned.length) return res.status(404).json({ error: 'Element nicht gefunden' });
    const allowed = ['type', 'visibility', 'layer', 'is_live_annotation'];
    const sets = [];
    const values = [];
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) { sets.push(`${key} = ?`); values.push(key === 'is_live_annotation' ? (req.body[key] ? 1 : 0) : req.body[key]); }
    for (const [key, column] of [['content', 'content_json'], ['position', 'position_json'], ['style', 'style_json']]) if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) { sets.push(`${column} = ?`); values.push(json(req.body[key])); }
    if (!sets.length) return res.status(400).json({ error: 'Keine Änderungen' });
    await pool.execute(`UPDATE lesson_phase_elements SET ${sets.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    const [rows] = await pool.execute('SELECT * FROM lesson_phase_elements WHERE id = ?', [req.params.id]);
    res.json({ ...rows[0], content: parseJson(rows[0].content_json), position: parseJson(rows[0].position_json), style: parseJson(rows[0].style_json) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/lesson-canvas-elements/:id', teacherOnly, async (req, res) => {
  try { const [result] = await pool.execute('DELETE FROM lesson_phase_elements WHERE id = ? AND EXISTS (SELECT 1 FROM lesson_phase_canvases c JOIN lesson_phases p ON p.id = c.phase_id JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE c.id = lesson_phase_elements.canvas_id AND s.user_id = ?)', [req.params.id, req.user?.id || 1]); if (!result.affectedRows) return res.status(404).json({ error: 'Element nicht gefunden' }); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/lesson-canvas-elements/:id/visibility', teacherOnly, async (req, res) => {
  try { const visibility = ['private', 'ready', 'displayed', 'solution', 'student'].includes(req.body?.visibility) ? req.body.visibility : 'private'; const [result] = await pool.execute('UPDATE lesson_phase_elements SET visibility = ? WHERE id = ? AND EXISTS (SELECT 1 FROM lesson_phase_canvases c JOIN lesson_phases p ON p.id = c.phase_id JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE c.id = lesson_phase_elements.canvas_id AND s.user_id = ?)', [visibility, req.params.id, req.user?.id || 1]); if (!result.affectedRows) return res.status(404).json({ error: 'Element nicht gefunden' }); res.json({ ok: true, visibility }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/lesson-phases/:id/live-layer', teacherOnly, async (req, res) => {
  try {
    const phase = await ownedPhase(req.params.id, req.user?.id || 1);
    if (!phase) return res.status(404).json({ error: 'Phase nicht gefunden' });
    const canvas = await canvasForPhase(phase.id);
    const elements = Array.isArray(req.body?.elements) ? req.body.elements : [];
    for (const element of elements) await pool.execute('INSERT INTO lesson_phase_elements (canvas_id, type, content_json, position_json, style_json, visibility, is_live_annotation) VALUES (?, ?, ?, ?, ?, \'private\', 1)', [canvas.id, element.type || 'marker', json(element.content), json(element.position), json(element.style)]);
    res.status(201).json(await canvasForPhase(phase.id));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/lesson-phases/:id/live-layer/save', teacherOnly, async (req, res) => {
  try {
    const phase = await ownedPhase(req.params.id, req.user?.id || 1);
    if (!phase) return res.status(404).json({ error: 'Phase nicht gefunden' });
    await pool.execute('UPDATE lesson_phase_elements SET is_live_annotation = 0 WHERE canvas_id IN (SELECT id FROM lesson_phase_canvases WHERE phase_id = ?)', [phase.id]);
    res.json(await canvasForPhase(phase.id));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/lesson-phases/:id/live-layer', teacherOnly, async (req, res) => {
  try {
    const phase = await ownedPhase(req.params.id, req.user?.id || 1);
    if (!phase) return res.status(404).json({ error: 'Phase nicht gefunden' });
    await pool.execute('DELETE FROM lesson_phase_elements WHERE canvas_id IN (SELECT id FROM lesson_phase_canvases WHERE phase_id = ?) AND is_live_annotation = 1', [phase.id]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/lesson-sessions', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM lesson_sessions WHERE user_id = ? ORDER BY lesson_date DESC, updated_at DESC', [req.user?.id || 1]);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/lesson-sessions', teacherOnly, async (req, res) => {
  const body = req.body || {};
  if (!String(body.title || '').trim()) return res.status(400).json({ error: 'title ist erforderlich' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO lesson_sessions (user_id, folder_id, title, lesson_date, class_name, subject, learning_goal, teacher_notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [req.user?.id || 1, body.folder_id || null, String(body.title).trim(), body.lesson_date || new Date().toISOString().slice(0, 10), body.class_name || null, body.subject || null, body.learning_goal || null, body.teacher_notes || null]
    );
    const phases = Array.isArray(body.phases) ? body.phases : [];
    for (const [index, phase] of phases.entries()) {
      await connection.execute(`INSERT INTO lesson_phases (lesson_session_id, position, title, duration_seconds, description, teacher_notes, student_instruction, student_responses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [result.insertId, index, phase.title || `Phase ${index + 1}`, Math.max(0, Number(phase.duration_seconds) || 300), phase.description || null, phase.teacher_notes || null, phase.student_instruction || null, phase.student_responses || null]);
    }
    await connection.commit();
    res.status(201).json(await withPhases(await getSession(result.insertId)));
  } catch (error) { await connection.rollback(); res.status(500).json({ error: error.message }); } finally { connection.release(); }
});

router.get('/lesson-sessions/:id', async (req, res) => {
  try {
    const session = await withPhases(await getSession(req.params.id, req.user?.id || 1));
    if (!session) return res.status(404).json({ error: 'Stunde nicht gefunden' });
    res.json(session);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/lesson-sessions/:id', teacherOnly, async (req, res) => {
  const allowed = ['title', 'lesson_date', 'class_name', 'subject', 'learning_goal', 'teacher_notes', 'status', 'folder_id'];
  const entries = allowed.filter((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
  if (!entries.length) return res.status(400).json({ error: 'Keine Änderungen' });
  try {
    const values = entries.map((key) => req.body[key] ?? null);
    await pool.execute(`UPDATE lesson_sessions SET ${entries.map((key) => `${key} = ?`).join(', ')} WHERE id = ? AND user_id = ?`, [...values, req.params.id, req.user?.id || 1]);
    res.json(await withPhases(await getSession(req.params.id, req.user?.id || 1)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/lesson-sessions/:id', teacherOnly, async (req, res) => {
  try { await pool.execute('DELETE FROM lesson_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user?.id || 1]); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/lesson-sessions/:id/phases', teacherOnly, async (req, res) => {
  const phase = req.body || {};
  try {
    if (!await getSession(req.params.id, req.user?.id || 1)) return res.status(404).json({ error: 'Stunde nicht gefunden' });
    const [result] = await pool.execute(`INSERT INTO lesson_phases (lesson_session_id, position, title, duration_seconds, description, teacher_notes, student_instruction, student_responses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [req.params.id, Number(phase.position) || 0, phase.title || 'Neue Phase', Math.max(0, Number(phase.duration_seconds) || 300), phase.description || null, phase.teacher_notes || null, phase.student_instruction || null, phase.student_responses || null]);
    const [rows] = await pool.execute(`SELECT ${phaseFields} FROM lesson_phases WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/lesson-phases/:id', teacherOnly, async (req, res) => {
  const allowed = ['position', 'title', 'duration_seconds', 'description', 'teacher_notes', 'student_instruction', 'student_responses', 'status', 'timer_state', 'timer_started_at', 'timer_remaining_seconds'];
  const entries = allowed.filter((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
  if (!entries.length) return res.status(400).json({ error: 'Keine Änderungen' });
  try {
    const [result] = await pool.execute(`UPDATE lesson_phases SET ${entries.map((key) => `${key} = ?`).join(', ')} WHERE id = ? AND EXISTS (SELECT 1 FROM lesson_sessions s WHERE s.id = lesson_phases.lesson_session_id AND s.user_id = ?)`, [...entries.map((key) => req.body[key] ?? null), req.params.id, req.user?.id || 1]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Phase nicht gefunden' });
    const [rows] = await pool.execute(`SELECT ${phaseFields} FROM lesson_phases WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/lesson-phases/:id', teacherOnly, async (req, res) => {
  try { await pool.execute('DELETE FROM lesson_phases WHERE id = ? AND EXISTS (SELECT 1 FROM lesson_sessions s WHERE s.id = lesson_phases.lesson_session_id AND s.user_id = ?)', [req.params.id, req.user?.id || 1]); res.json({ ok: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/lesson-phases/:id/visibility', teacherOnly, async (req, res) => {
  const visibility = ['private', 'ready', 'displayed', 'solution', 'student'].includes(req.body?.visibility) ? req.body.visibility : 'private';
  try {
    const [owned] = await pool.execute(`SELECT p.id, s.folder_id FROM lesson_phases p JOIN lesson_sessions s ON s.id = p.lesson_session_id WHERE p.id = ? AND s.user_id = ?`, [req.params.id, req.user?.id || 1]);
    if (!owned.length) return res.status(404).json({ error: 'Phase nicht gefunden' });
    if (req.body?.file_id) {
      const [files] = await pool.execute('SELECT id FROM files WHERE id = ? AND folder_id = ?', [req.body.file_id, owned[0].folder_id]);
      if (!files.length) return res.status(400).json({ error: 'Material gehört nicht zur Stunde' });
    }
    await pool.execute(`INSERT INTO lesson_phase_materials (phase_id, file_id, folder_id, visibility, position) VALUES (?, ?, ?, ?, ?)`, [req.params.id, req.body?.file_id || null, req.body?.folder_id || null, visibility, Number(req.body?.position) || 0]);
    res.status(201).json({ ok: true, visibility });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/lesson-sessions/:id/display-session', teacherOnly, async (req, res) => {
  try {
    if (!await getSession(req.params.id, req.user?.id || 1)) return res.status(404).json({ error: 'Stunde nicht gefunden' });
    const token = crypto.randomBytes(32).toString('hex');
    await pool.execute("INSERT INTO lesson_display_sessions (lesson_session_id, token, expires_at) VALUES (?, ?, datetime('now', '+12 hours'))", [req.params.id, token]);
    res.status(201).json({ token, url: `/display/${token}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/display/:token', teacherOnly, async (req, res) => {
  try {
    const [result] = await pool.execute(`UPDATE lesson_display_sessions SET active_phase_id = ? WHERE token = ? AND expires_at > CURRENT_TIMESTAMP AND EXISTS (SELECT 1 FROM lesson_sessions s WHERE s.id = lesson_display_sessions.lesson_session_id AND s.user_id = ?)`, [req.body?.active_phase_id || null, req.params.token, req.user?.id || 1]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Anzeigesitzung nicht gefunden' });
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

export async function displaySession(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT d.*, s.title, s.class_name, s.subject, s.learning_goal, p.title AS phase_title, p.description, p.student_instruction, p.duration_seconds, p.timer_state, p.timer_started_at, p.timer_remaining_seconds FROM lesson_display_sessions d JOIN lesson_sessions s ON s.id = d.lesson_session_id LEFT JOIN lesson_phases p ON p.id = d.active_phase_id WHERE d.token = ? AND d.expires_at > NOW()`, [req.params.token]);
    if (!rows.length) return res.status(404).json({ error: 'Anzeigesitzung nicht gefunden' });
    const [materials] = rows[0].active_phase_id ? await pool.execute(`SELECT f.original_name FROM lesson_phase_materials m LEFT JOIN files f ON f.id = m.file_id WHERE m.phase_id = ? AND m.visibility IN ('displayed', 'student') ORDER BY m.position, m.id`, [rows[0].active_phase_id]) : [[]];
    const canvas = rows[0].active_phase_id ? await canvasForPhase(rows[0].active_phase_id, false) : null;
    res.json({ ...rows[0], materials, canvas: canvas ? { ...canvas, elements: canvas.elements.filter((element) => ['displayed', 'student'].includes(element.visibility)) } : null });
  } catch (error) { res.status(500).json({ error: error.message }); }
}

export async function displayPage(req, res) {
  const token = String(req.params.token).replace(/[^a-f0-9]/gi, '');
  res.type('html').send(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LehrerMaps Projektion</title><style>body{margin:0;background:#0b1020;color:#fff;font:16px system-ui;min-height:100vh;display:grid;place-items:center}.card{width:min(90vw,1000px);text-align:center}.eyebrow{color:#93c5fd;text-transform:uppercase;letter-spacing:.16em;font-size:13px}.timer{font-size:clamp(72px,18vw,220px);font-weight:800;line-height:1;margin:24px 0}.instruction{font-size:clamp(24px,4vw,52px);line-height:1.2}.materials{margin-top:28px;color:#cbd5e1;font-size:20px}.muted{color:#aab6d3}</style></head><body><main class="card"><div id="app" class="muted">Projektion wird geladen …</div></main><script>const token='${token}';let state;function esc(v){return String(v||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}async function load(){try{const r=await fetch('/api/display/'+token);if(!r.ok)throw Error();state=await r.json();const remaining=state.timer_state==='running'&&state.timer_started_at?Math.max(0,Number(state.timer_remaining_seconds||state.duration_seconds)-Math.floor((Date.now()-new Date(state.timer_started_at).getTime())/1000)):Number(state.timer_remaining_seconds??state.duration_seconds);const m=String(Math.floor(remaining/60)).padStart(2,'0'),s=String(remaining%60).padStart(2,'0');const materials=(state.materials||[]).map(item=>esc(item.original_name)).join(' · ');document.querySelector('#app').innerHTML='<div class="eyebrow">'+esc(state.subject||'Unterricht')+' · '+esc(state.title)+'</div><div class="timer">'+m+':'+s+'</div><div class="instruction">'+esc(state.student_instruction||state.description||state.learning_goal||'Aktuelle Phase')+'</div>'+(materials?'<div class="materials">'+materials+'</div>':'')}catch{document.querySelector('#app').innerHTML='<div class="muted">Diese Projektion ist abgelaufen.</div>'}}load();setInterval(load,1000)</script></body></html>`);
}

export default router;
