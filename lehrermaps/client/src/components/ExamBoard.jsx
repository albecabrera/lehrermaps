import { useState, useEffect, useCallback } from 'react';
import { getExams, createExam, deleteExam, updateExam } from '../lib/api';

const FAECHER = ['Spanisch', 'Informatik', 'Sport', 'Klassenleitung'];
const KLASSEN = [
  '5a','5b','5c','5d',
  '6a','6b','6c','6d',
  '7a','7b','7c',
  '8a','8b','8c',
  '9a','9b','9c',
  '10a','10b','10c',
  'Q1','Q2',
];

// ── CSS animations ────────────────────────────────────────────────────────────
const ANIM_STYLES = `
  @keyframes eb-boardIn   { from{opacity:0;transform:scale(.98)} to{opacity:1;transform:scale(1)} }
  @keyframes eb-cardIn    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes eb-pulse     { 0%,100%{opacity:1} 50%{opacity:.55} }
  @keyframes eb-shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes eb-spin      { to{transform:rotate(360deg)} }

  .eb-board   { animation: eb-boardIn .3s cubic-bezier(.22,1,.36,1) both }
  .eb-card    { animation: eb-cardIn .36s cubic-bezier(.22,1,.36,1) both;
                transition: transform .22s cubic-bezier(.22,1.3,.36,1), box-shadow .22s ease; }
  .eb-card:hover { transform: translateY(-6px) !important; }

  .eb-btn-primary {
    transition: transform .18s cubic-bezier(.22,1.3,.36,1), box-shadow .18s ease, opacity .15s;
  }
  .eb-btn-primary:hover  { transform: translateY(-2px) scale(1.04); }
  .eb-btn-primary:active { transform: scale(.96) !important; }

  .eb-btn-ghost {
    transition: background .14s, transform .14s cubic-bezier(.22,1.3,.36,1);
  }
  .eb-btn-ghost:hover  { transform: translateY(-1px); }
  .eb-btn-ghost:active { transform: scale(.97); }

  .eb-icon-btn {
    transition: background .1s, color .1s, transform .14s cubic-bezier(.22,1.3,.36,1);
  }
  .eb-icon-btn:hover  { transform: scale(1.15); }
  .eb-icon-btn:active { transform: scale(.9); }

  .eb-pulse   { animation: eb-pulse 1.8s ease-in-out infinite; }
  .eb-shimmer {
    background: linear-gradient(90deg,
      var(--eb-pc) 0%, var(--eb-pc) 40%,
      rgba(255,255,255,.45) 60%, var(--eb-pc) 80%);
    background-size: 250% auto;
    animation: eb-shimmer 2.2s linear infinite;
  }
`;

// ── helpers ───────────────────────────────────────────────────────────────────
function toDate(s) { return s ? s.slice(0, 10) : ''; }
function startOfDay(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

function daysUntil(ds) {
  const today = startOfDay(new Date());
  const exam  = startOfDay(new Date(toDate(ds) + 'T00:00:00'));
  return Math.floor((exam - today) / 86400000);
}

function bucket(ds) {
  const d = daysUntil(ds);
  if (d < 0)   return 'past';
  if (d === 0) return 'today';
  if (d <= 7)  return 'week';
  if (d <= 14) return 'next_week';
  return 'later';
}

function progressPct(createdAt, examDate) {
  const s = new Date(createdAt).getTime();
  const e = startOfDay(new Date(toDate(examDate) + 'T00:00:00')).getTime();
  const n = Date.now();
  if (e <= s) return 100;
  return Math.min(100, Math.max(0, ((n - s) / (e - s)) * 100));
}

function progressColor(pct) {
  if (pct < 50) return '#22c55e';
  if (pct < 75) return '#eab308';
  if (pct < 90) return '#f97316';
  return '#ef4444';
}

function fmtDate(ds) {
  if (!ds) return '—';
  return new Date(toDate(ds) + 'T00:00:00')
    .toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCountdown(ds, ts) {
  const base = `${toDate(ds)}T${ts ? ts.slice(0,5) : '00:00'}:00`;
  const diff = new Date(base).getTime() - Date.now();
  if (diff < 0) return 'Vergangen';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}T ${h}Std`;
  if (h > 0) return `${h}Std ${m}Min`;
  return `${m}Min`;
}

// ── columns ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  { id:'today',     label:'Heute',         color:'#EF4444', glow:'rgba(239,68,68,.35)',   bg:'rgba(239,68,68,.07)',   border:'rgba(239,68,68,.3)',  urgent:true  },
  { id:'week',      label:'Diese Woche',   color:'#F97316', glow:'rgba(249,115,22,.3)',   bg:'rgba(249,115,22,.07)',  border:'rgba(249,115,22,.3)', urgent:true  },
  { id:'next_week', label:'Nächste Woche', color:'#EAB308', glow:'rgba(234,179,8,.25)',   bg:'rgba(234,179,8,.07)',   border:'rgba(234,179,8,.28)', urgent:false },
  { id:'later',     label:'Später',        color:'#3B82F6', glow:'rgba(59,130,246,.25)',  bg:'rgba(59,130,246,.07)', border:'rgba(59,130,246,.28)',urgent:false },
  { id:'past',      label:'Vergangen',     color:'#6B7280', glow:'rgba(107,114,128,.2)',  bg:'rgba(107,114,128,.05)',border:'rgba(107,114,128,.2)',urgent:false },
];

// ── ExamCard ──────────────────────────────────────────────────────────────────
function ExamCard({ exam, onDelete, onEdit, col, index }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n+1), 60000);
    return () => clearInterval(t);
  }, []);

  const pct = progressPct(exam.created_at, exam.exam_date);
  const pc  = progressColor(pct);

  return (
    <div
      className="eb-card"
      style={{
        background: `linear-gradient(145deg, var(--c-bg) 0%, ${col.color}08 100%)`,
        border: `1px solid ${col.border}`,
        borderLeft: `4px solid ${col.color}`,
        borderRadius: 14,
        padding: '20px 18px 18px',
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: `0 4px 24px rgba(0,0,0,.14), 0 1px 4px rgba(0,0,0,.08), 0 0 0 0 ${col.glow}`,
        animationDelay: `${index * 60}ms`,
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* glow accent top */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        background: `linear-gradient(90deg, ${col.color}00, ${col.color}cc, ${col.color}00)`,
        borderRadius:'14px 14px 0 0',
      }}/>

      {/* header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'var(--c-text)', lineHeight:1.25, marginBottom:7 }}>
            {exam.title}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <Tag color={col.color}>{exam.class_name}</Tag>
            {exam.subject && <Tag color="var(--c-text-3)">{exam.subject}</Tag>}
          </div>
        </div>
        <div style={{ display:'flex', gap:3, flexShrink:0 }}>
          <IconBtn title="Bearbeiten" onClick={() => onEdit(exam)}>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M8 1.5l2.5 2.5-6 6H2V7.5l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconBtn>
          <IconBtn title="Löschen" onClick={() => onDelete(exam.id)} danger>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M5 3V2h2v1M4 3v6h4V3H4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconBtn>
        </div>
      </div>

      {/* date */}
      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, color:'var(--c-text-2)' }}>
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ color:col.color, flexShrink:0 }}>
          <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight:600 }}>{fmtDate(exam.exam_date)}</span>
        {exam.exam_time && (
          <span style={{
            fontSize:11, background:`${col.color}18`, color:col.color,
            padding:'2px 8px', borderRadius:20, fontWeight:700,
          }}>
            {exam.exam_time.slice(0,5)} Uhr
          </span>
        )}
      </div>

      {/* countdown */}
      <div style={{
        background: `linear-gradient(135deg, ${col.color}18 0%, ${col.color}0a 100%)`,
        border: `1px solid ${col.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex', justifyContent:'space-between', alignItems:'center',
        boxShadow: `inset 0 1px 0 ${col.color}15`,
      }}>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:col.color, opacity:.7 }}>
            Countdown
          </span>
          <span
            className={col.urgent ? 'eb-pulse' : undefined}
            style={{ fontSize:22, fontWeight:900, color:col.color, fontFamily:'"DM Mono",monospace', lineHeight:1 }}
          >
            {fmtCountdown(exam.exam_date, exam.exam_time)}
          </span>
        </div>
        <div style={{
          width:44, height:44, borderRadius:'50%',
          background: `conic-gradient(${col.color} ${pct * 3.6}deg, ${col.color}20 0deg)`,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: `0 0 12px ${col.glow}`,
        }}>
          <div style={{
            width:32, height:32, borderRadius:'50%',
            background:'var(--c-bg)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:10, fontWeight:800, color:col.color,
          }}>
            {Math.round(pct)}%
          </div>
        </div>
      </div>

      {/* progress bar */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'var(--c-text-3)', letterSpacing:.4, textTransform:'uppercase' }}>
            Fortschritt
          </span>
          <span style={{ fontSize:11, fontWeight:800, color:pc }}>{Math.round(pct)}%</span>
        </div>
        <div style={{ height:9, background:'var(--c-hover)', borderRadius:99, overflow:'hidden', boxShadow:'inset 0 1px 2px rgba(0,0,0,.1)' }}>
          <div
            className="eb-shimmer"
            style={{
              '--eb-pc': pc,
              width:`${pct}%`, height:'100%',
              borderRadius:99,
              boxShadow: `0 0 8px ${pc}88`,
              transition:'width .5s ease',
            }}
          />
        </div>
      </div>

      {/* notes */}
      {exam.notes && (
        <div style={{
          fontSize:13, color:'var(--c-text-3)', lineHeight:1.6,
          borderTop:`1px solid ${col.border}`,
          paddingTop:12,
          fontStyle:'italic',
        }}>
          {exam.notes}
        </div>
      )}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      fontSize:11, fontWeight:700, padding:'3px 10px',
      background:`${color}18`, color, borderRadius:20,
      border:`1px solid ${color}35`,
      letterSpacing:.2,
    }}>
      {children}
    </span>
  );
}

function IconBtn({ onClick, title, danger, children }) {
  return (
    <button
      onClick={onClick} title={title}
      className="eb-icon-btn"
      style={{
        width:28, height:28, borderRadius:7, border:'none',
        background:'transparent',
        color:'var(--c-text-3)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,.15)' : 'var(--c-hover)';
        e.currentTarget.style.color = danger ? '#EF4444' : 'var(--c-text)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--c-text-3)';
      }}
    >
      {children}
    </button>
  );
}

// ── SelectField ───────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options, placeholder, allowCustom }) {
  const s = {
    width:'100%', padding:'9px 12px', borderRadius:9, boxSizing:'border-box',
    border:'1px solid var(--c-border)', background:'var(--c-hover)',
    color:'var(--c-text)', fontSize:14, outline:'none', fontFamily:'inherit', cursor:'pointer',
    transition:'border-color .14s, box-shadow .14s',
  };
  const id = `eb-sel-${label.replace(/\W/g,'')}`;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'var(--c-text-2)', letterSpacing:.5, textTransform:'uppercase' }}>
        {label}
      </label>
      {allowCustom ? (
        <>
          <input list={id} value={value} onChange={onChange} placeholder={placeholder} style={s}/>
          <datalist id={id}>{options.map(o => <option key={o} value={o}/>)}</datalist>
        </>
      ) : (
        <select value={value} onChange={onChange} style={s}>
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type='text', textarea }) {
  const s = {
    width:'100%', padding:'9px 12px', borderRadius:9, boxSizing:'border-box',
    border:'1px solid var(--c-border)', background:'var(--c-hover)',
    color:'var(--c-text)', fontSize:14, outline:'none', fontFamily:'inherit',
    transition:'border-color .14s, box-shadow .14s',
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'var(--c-text-2)', letterSpacing:.5, textTransform:'uppercase' }}>
        {label}
      </label>
      {textarea
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3}
            style={{...s, resize:'vertical', lineHeight:1.6}}/>
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={s}/>
      }
    </div>
  );
}

// ── ExamForm ──────────────────────────────────────────────────────────────────
const EMPTY = { title:'', class_name:'', subject:'', exam_date:'', exam_time:'', notes:'' };

function ExamForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.class_name || !form.exam_date) {
      setErr('Titel, Klasse und Datum sind Pflichtfelder.'); return;
    }
    setSaving(true); setErr('');
    try { await onSave(form); }
    catch { setErr('Fehler beim Speichern.'); setSaving(false); }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:10001,
        background:'rgba(0,0,0,.65)',
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(6px)',
      }}
    >
      <div style={{
        background:'var(--c-bg)', borderRadius:18, padding:32,
        width:480, maxWidth:'calc(100vw - 32px)',
        border:'1px solid var(--c-border)',
        boxShadow:'0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)',
        animation:'eb-boardIn .25s cubic-bezier(.22,1,.36,1) both',
      }}>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:24, color:'var(--c-text)' }}>
          {initial ? '✏️ Prüfung bearbeiten' : '＋ Neue Prüfung'}
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Field label="Titel *" value={form.title} onChange={set('title')} placeholder="z.B. Klassenarbeit Nr. 2"/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <SelectField label="Klasse *" value={form.class_name} onChange={set('class_name')}
              options={KLASSEN} placeholder="Klasse wählen…" allowCustom/>
            <SelectField label="Fach" value={form.subject} onChange={set('subject')}
              options={FAECHER} placeholder="Fach wählen…"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Datum *" type="date" value={form.exam_date} onChange={set('exam_date')}/>
            <Field label="Uhrzeit" type="time" value={form.exam_time} onChange={set('exam_time')}/>
          </div>
          <Field label="Notizen" value={form.notes} onChange={set('notes')} placeholder="Themen, Hinweise…" textarea/>
          {err && <div style={{ fontSize:13, color:'#EF4444', fontWeight:600 }}>{err}</div>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <button type="button" onClick={onClose} className="eb-btn-ghost" style={{
              height:40, padding:'0 20px', border:'1px solid var(--c-border)', borderRadius:10,
              background:'transparent', color:'var(--c-text-2)', fontSize:14, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit',
            }}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="eb-btn-primary" style={{
              height:40, padding:'0 24px', border:'none', borderRadius:10,
              background:'linear-gradient(135deg, #E8472A 0%, #c43520 100%)',
              color:'#fff', fontSize:14, fontWeight:700,
              cursor: saving ? 'wait' : 'pointer', fontFamily:'inherit',
              opacity: saving ? .7 : 1,
              boxShadow:'0 4px 16px rgba(232,71,42,.35)',
            }}>
              {saving ? 'Speichern…' : initial ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ExamBoard ─────────────────────────────────────────────────────────────────
export default function ExamBoard({ onDismiss }) {
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);

  const load = useCallback(async () => {
    try { const d = await getExams(); setExams(d); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onDismiss]);

  const handleCreate = async form => {
    const c = await createExam(form); setExams(p => [...p, c]); setShowForm(false);
  };
  const handleUpdate = async form => {
    const u = await updateExam(editing.id, form);
    setExams(p => p.map(e => e.id === u.id ? u : e)); setEditing(null);
  };
  const handleDelete = async id => {
    await deleteExam(id); setExams(p => p.filter(e => e.id !== id));
  };

  const byBucket = COLUMNS.reduce((acc, col) => {
    acc[col.id] = exams
      .filter(e => bucket(toDate(e.exam_date)) === col.id)
      .sort((a, b) => {
        const da = toDate(a.exam_date) + (a.exam_time || '00:00');
        const db = toDate(b.exam_date) + (b.exam_time || '00:00');
        return da < db ? -1 : da > db ? 1 : 0;
      });
    return acc;
  }, {});

  const upcoming = exams.filter(e => daysUntil(toDate(e.exam_date)) >= 0).length;

  return (
    <>
      <style>{ANIM_STYLES}</style>
      <div className="eb-board" style={{
        position:'fixed', inset:0, zIndex:10000,
        background:'var(--c-bg)',
        display:'flex', flexDirection:'column',
        overflow:'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding:'20px 28px',
          borderBottom:'1px solid var(--c-border)',
          display:'flex', alignItems:'center', gap:16, flexShrink:0,
          background:'var(--c-bg)',
          boxShadow:'0 1px 0 var(--c-border)',
        }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:16 }}>
            <div style={{
              width:46, height:46, borderRadius:12,
              background:'linear-gradient(135deg, #E8472A22 0%, #E8472A11 100%)',
              border:'1px solid rgba(232,71,42,.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="17" rx="2" stroke="#E8472A" strokeWidth="1.8"/>
                <path d="M8 2v4M16 2v4M3 10h18" stroke="#E8472A" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M8 14h3M8 17h5" stroke="#E8472A" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{
                fontSize:22, fontWeight:900, lineHeight:1.1,
                background:'linear-gradient(135deg, var(--c-text) 0%, var(--c-text-2) 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              }}>
                Klassenarbeiten & Prüfungen
              </div>
              <div style={{ fontSize:13, color:'var(--c-text-3)', marginTop:3 }}>
                <span style={{ color:'#E8472A', fontWeight:700 }}>{upcoming}</span> bevorstehend
                &nbsp;·&nbsp;{exams.length} gesamt
              </div>
            </div>
          </div>

          <button onClick={() => setShowForm(true)} className="eb-btn-primary" style={{
            height:40, padding:'0 20px', border:'none', borderRadius:10,
            background:'linear-gradient(135deg, #E8472A 0%, #c43520 100%)',
            color:'#fff', fontSize:13, fontWeight:700,
            cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:7,
            boxShadow:'0 4px 16px rgba(232,71,42,.35)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Neue Prüfung
          </button>

          <button onClick={onDismiss} className="eb-btn-ghost" style={{
            height:40, padding:'0 18px', border:'1px solid var(--c-border)', borderRadius:10,
            background:'transparent', color:'var(--c-text-2)',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:7,
          }}>
            Weiter zu LehrerMaps
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ── Board ── */}
        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, color:'var(--c-text-3)' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation:'eb-spin 1s linear infinite' }}>
              <circle cx="9" cy="9" r="7" stroke="var(--c-border)" strokeWidth="2"/>
              <path d="M9 2a7 7 0 0 1 7 7" stroke="var(--c-text-3)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Lädt…
          </div>
        ) : (
          <div style={{
            flex:1, display:'flex', gap:18,
            padding:'24px 28px', overflowX:'auto', overflowY:'hidden',
            alignItems:'flex-start',
          }}>
            {COLUMNS.map(col => {
              const items = byBucket[col.id] || [];
              return (
                <div key={col.id} style={{
                  minWidth:350, width:350, flexShrink:0,
                  display:'flex', flexDirection:'column', gap:12,
                  height:'100%',
                }}>
                  {/* column header */}
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'11px 16px',
                    background:`linear-gradient(135deg, ${col.bg} 0%, transparent 100%)`,
                    border:`1px solid ${col.border}`,
                    borderRadius:12,
                    boxShadow:`0 2px 12px ${col.glow}`,
                  }}>
                    <div style={{
                      width:10, height:10, borderRadius:'50%',
                      background:col.color,
                      boxShadow:`0 0 8px ${col.color}`,
                      flexShrink:0,
                    }}/>
                    <span style={{ fontSize:13, fontWeight:800, color:col.color, flex:1, letterSpacing:.3 }}>
                      {col.label}
                    </span>
                    <span style={{
                      fontSize:12, fontWeight:800,
                      background:col.color, color:'#fff',
                      padding:'2px 10px', borderRadius:20,
                      boxShadow:`0 2px 8px ${col.glow}`,
                      minWidth:24, textAlign:'center',
                    }}>
                      {items.length}
                    </span>
                  </div>

                  {/* cards */}
                  <div style={{ display:'flex', flexDirection:'column', gap:12, overflowY:'auto', flex:1, paddingBottom:4 }}>
                    {items.length === 0 ? (
                      <div style={{
                        border:`2px dashed ${col.border}`,
                        borderRadius:12, padding:'28px 0',
                        textAlign:'center', fontSize:13, color:'var(--c-text-3)',
                        opacity:.6,
                      }}>
                        Keine Prüfungen
                      </div>
                    ) : items.map((exam, i) => (
                      <ExamCard
                        key={exam.id} exam={exam} col={col} index={i}
                        onDelete={handleDelete}
                        onEdit={e => setEditing(e)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showForm && <ExamForm onSave={handleCreate} onClose={() => setShowForm(false)}/>}
        {editing  && <ExamForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)}/>}
      </div>
    </>
  );
}
