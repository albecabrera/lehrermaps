import { useState, useEffect, useCallback } from 'react';
import { getExams, createExam, deleteExam, updateExam } from '../lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function toDate(s) { return s ? s.slice(0, 10) : ''; }

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function daysUntil(dateStr) {
  const today = startOfDay(new Date());
  const exam  = startOfDay(new Date(toDate(dateStr) + 'T00:00:00'));
  return Math.floor((exam - today) / 86400000);
}

function bucket(dateStr) {
  const d = daysUntil(toDate(dateStr));
  if (d < 0)  return 'past';
  if (d === 0) return 'today';
  if (d <= 7)  return 'week';
  if (d <= 14) return 'next_week';
  return 'later';
}

function progressPct(createdAt, examDate) {
  const start = new Date(createdAt).getTime();
  const end   = startOfDay(new Date(toDate(examDate) + 'T00:00:00')).getTime();
  const now   = Date.now();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

function progressColor(pct) {
  if (pct < 50)  return '#22c55e';
  if (pct < 75)  return '#eab308';
  if (pct < 90)  return '#f97316';
  return '#ef4444';
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(toDate(dateStr) + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCountdown(dateStr, timeStr) {
  const ds = toDate(dateStr);
  const t = timeStr ? timeStr.slice(0, 5) : '00:00';
  const base = `${ds}T${t}:00`;
  const diff = new Date(base).getTime() - Date.now();
  if (diff < 0) return 'Vergangen';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}T ${h}Std`;
  if (h > 0) return `${h}Std ${m}Min`;
  return `${m}Min`;
}

// ── column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'today',     label: 'Heute',          color: '#EF4444', bg: 'rgba(239,68,68,.08)',   border: 'rgba(239,68,68,.25)' },
  { id: 'week',      label: 'Diese Woche',    color: '#F97316', bg: 'rgba(249,115,22,.08)',  border: 'rgba(249,115,22,.25)' },
  { id: 'next_week', label: 'Nächste Woche',  color: '#EAB308', bg: 'rgba(234,179,8,.08)',   border: 'rgba(234,179,8,.25)' },
  { id: 'later',     label: 'Später',         color: '#3B82F6', bg: 'rgba(59,130,246,.08)',  border: 'rgba(59,130,246,.25)' },
  { id: 'past',      label: 'Vergangen',      color: '#6B7280', bg: 'rgba(107,114,128,.08)', border: 'rgba(107,114,128,.25)' },
];

// ── ExamCard ──────────────────────────────────────────────────────────────────

function ExamCard({ exam, onDelete, onEdit, col }) {
  const [tick, setTick] = useState(0);
  const pct = progressPct(exam.created_at, exam.exam_date);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: 'var(--c-bg)',
      border: `1px solid ${col.border}`,
      borderRadius: 10,
      padding: '14px 14px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,.12)',
    }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3 }}>
            {exam.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <Tag color={col.color}>{exam.class_name}</Tag>
            {exam.subject && <Tag color="var(--c-text-3)">{exam.subject}</Tag>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <IconBtn title="Bearbeiten" onClick={() => onEdit(exam)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 1.5l2.5 2.5-6 6H2V7.5l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconBtn>
          <IconBtn title="Löschen" onClick={() => onDelete(exam.id)} danger>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M5 3V2h2v1M4 3v6h4V3H4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconBtn>
        </div>
      </div>

      {/* date */}
      <div style={{ fontSize: 12, color: 'var(--c-text-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {fmtDate(exam.exam_date)}
        {exam.exam_time && <span style={{ color: 'var(--c-text-3)' }}> · {exam.exam_time.slice(0, 5)} Uhr</span>}
      </div>

      {/* countdown */}
      <div style={{
        background: `${col.color}14`,
        border: `1px solid ${col.border}`,
        borderRadius: 6, padding: '6px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Countdown</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: col.color, fontFamily: '"DM Mono", monospace' }}>
          {fmtCountdown(exam.exam_date, exam.exam_time)}
        </span>
      </div>

      {/* progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>Fortschritt</span>
          <span style={{ fontSize: 10, color: progressColor(pct), fontWeight: 600 }}>
            {Math.round(pct)}%
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--c-hover)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: progressColor(pct),
            borderRadius: 4,
            transition: 'width .4s ease',
          }} />
        </div>
      </div>

      {/* notes */}
      {exam.notes && (
        <div style={{
          fontSize: 11, color: 'var(--c-text-3)',
          borderTop: '1px solid var(--c-border)',
          paddingTop: 8, lineHeight: 1.5,
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
      fontSize: 10, fontWeight: 600, padding: '2px 7px',
      background: `${color}18`, color, borderRadius: 4,
      border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  );
}

function IconBtn({ onClick, title, danger, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24, height: 24, borderRadius: 5, border: 'none',
        background: hover ? (danger ? '#EF444420' : 'var(--c-hover)') : 'transparent',
        color: hover && danger ? '#EF4444' : 'var(--c-text-3)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .1s, color .1s',
      }}
    >
      {children}
    </button>
  );
}

// ── ExamForm (add / edit) ─────────────────────────────────────────────────────

const EMPTY = { title: '', class_name: '', subject: '', exam_date: '', exam_time: '', notes: '' };

function ExamForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.class_name || !form.exam_date) {
      setErr('Titel, Klasse und Datum sind Pflichtfelder.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onSave(form);
    } catch {
      setErr('Fehler beim Speichern.');
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--c-bg)', borderRadius: 14, padding: 28,
        width: 440, maxWidth: 'calc(100vw - 32px)',
        border: '1px solid var(--c-border)',
        boxShadow: '0 24px 64px rgba(0,0,0,.4)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
          {initial ? 'Prüfung bearbeiten' : 'Neue Prüfung'}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Titel *" value={form.title} onChange={set('title')} placeholder="z.B. Klassenarbeit Nr. 2" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Klasse *" value={form.class_name} onChange={set('class_name')} placeholder="z.B. 10b" />
            <Field label="Fach" value={form.subject} onChange={set('subject')} placeholder="z.B. Spanisch" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Datum *" type="date" value={form.exam_date} onChange={set('exam_date')} />
            <Field label="Uhrzeit" type="time" value={form.exam_time} onChange={set('exam_time')} />
          </div>
          <Field label="Notizen" value={form.notes} onChange={set('notes')} placeholder="Themen, Hinweise…" textarea />
          {err && <div style={{ fontSize: 12, color: '#EF4444' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={btnStyle('var(--c-text-2)', 'var(--c-hover)')}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving} style={btnStyle('#fff', '#E8472A', saving)}>
              {saving ? 'Speichern…' : initial ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', textarea }) {
  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 7, boxSizing: 'border-box',
    border: '1px solid var(--c-border)', background: 'var(--c-hover)',
    color: 'var(--c-text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)' }}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
      }
    </div>
  );
}

// ── ExamBoard (main) ──────────────────────────────────────────────────────────

export default function ExamBoard({ onDismiss }) {
  const [exams, setExams]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getExams();
      setExams(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const handleCreate = async (form) => {
    const created = await createExam(form);
    setExams((prev) => [...prev, created]);
    setShowForm(false);
  };

  const handleUpdate = async (form) => {
    const updated = await updateExam(editing.id, form);
    setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await deleteExam(id);
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  const byBucket = COLUMNS.reduce((acc, col) => {
    acc[col.id] = exams.filter((e) => bucket(toDate(e.exam_date)) === col.id);
    return acc;
  }, {});

  const upcoming = exams.filter((e) => daysUntil(toDate(e.exam_date)) >= 0).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--c-bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        background: 'var(--c-bg)',
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="17" rx="2" stroke="#E8472A" strokeWidth="1.8"/>
            <path d="M8 2v4M16 2v4M3 10h18" stroke="#E8472A" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M8 14h3M8 17h5" stroke="#E8472A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1 }}>
              Klassenarbeiten & Prüfungen
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 3 }}>
              {upcoming} bevorstehend · {exams.length} gesamt
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            ...btnStyle('#fff', '#E8472A'),
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v9M1 5.5h9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Neue Prüfung
        </button>
        <button
          onClick={onDismiss}
          style={{
            ...btnStyle('var(--c-text-2)', 'var(--c-hover)'),
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Weiter zu LehrerMaps
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Board ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)', fontSize: 13 }}>
          Lädt…
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', gap: 16,
          padding: '20px 24px', overflowX: 'auto', overflowY: 'hidden',
          alignItems: 'flex-start',
        }}>
          {COLUMNS.map((col) => {
            const items = byBucket[col.id] || [];
            return (
              <div key={col.id} style={{
                minWidth: 280, width: 280, flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: 10,
                height: '100%',
              }}>
                {/* column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: col.bg,
                  border: `1px solid ${col.border}`,
                  borderRadius: 8,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: col.color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color, flex: 1 }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: `${col.color}20`, color: col.color,
                    padding: '1px 7px', borderRadius: 10,
                  }}>
                    {items.length}
                  </span>
                </div>

                {/* cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
                  {items.length === 0 ? (
                    <div style={{
                      border: `1px dashed ${col.border}`,
                      borderRadius: 8, padding: '20px 0',
                      textAlign: 'center', fontSize: 12, color: 'var(--c-text-3)',
                    }}>
                      Keine Prüfungen
                    </div>
                  ) : (
                    items.map((exam) => (
                      <ExamCard
                        key={exam.id}
                        exam={exam}
                        col={col}
                        onDelete={handleDelete}
                        onEdit={(e) => setEditing(e)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Forms ── */}
      {showForm && (
        <ExamForm onSave={handleCreate} onClose={() => setShowForm(false)} />
      )}
      {editing && (
        <ExamForm
          initial={editing}
          onSave={handleUpdate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function btnStyle(color, bg, disabled) {
  return {
    height: 34, padding: '0 16px', border: 'none', borderRadius: 8,
    background: bg, color, fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'wait' : 'pointer', fontFamily: 'inherit',
    opacity: disabled ? 0.7 : 1, transition: 'opacity .15s',
  };
}
