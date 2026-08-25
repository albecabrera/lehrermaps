import { useMemo, useState } from 'react';

const TASKS_KEY = 'lm_today_tasks';
const NOTE_PREFIX = 'lm_today_note_';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch { return []; }
}

export default function TodayDashboard({
  subject, folders = [], recents = [], onRecentClick,
  onOpenSubjects, onOpenSchedule, onOpenSearch, onOpenNotes, onUpload,
}) {
  const [tasks, setTasks] = useState(readTasks);
  const [taskText, setTaskText] = useState('');
  const [note, setNote] = useState(() => localStorage.getItem(NOTE_PREFIX + todayKey()) || '');
  const deadlines = useMemo(() => folders.filter((folder) => folder.due_at).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))).slice(0, 4), [folders]);
  const favorites = folders.filter((folder) => folder.is_favorite).slice(0, 4);

  const persistTasks = (next) => {
    setTasks(next);
    localStorage.setItem(TASKS_KEY, JSON.stringify(next));
  };

  const addTask = () => {
    const text = taskText.trim();
    if (!text) return;
    persistTasks([{ id: `${Date.now()}`, text, done: false }, ...tasks].slice(0, 20));
    setTaskText('');
  };

  const saveNote = (value) => {
    setNote(value);
    localStorage.setItem(NOTE_PREFIX + todayKey(), value);
  };

  const cardStyle = {
    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 14, padding: 18, minWidth: 0,
  };
  const actionStyle = {
    height: 34, padding: '0 12px', border: '1px solid var(--c-border)',
    borderRadius: 8, background: 'var(--c-surface-2)', color: 'var(--c-text-2)',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  };

  return (
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '28px clamp(18px, 4vw, 48px) 40px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Heute</div>
            <h1 style={{ margin: '5px 0 4px', fontSize: 28, letterSpacing: -0.8 }}>Dein Unterrichtsstart</h1>
            <div style={{ color: 'var(--c-text-2)', fontSize: 13 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · {subject.name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onOpenSubjects} style={actionStyle}>📚 Fächer anzeigen</button>
            <button onClick={onOpenSchedule} style={actionStyle}>📅 Stundenplan</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
          {[
            ['Fächerordner', folders.length, subject.color],
            ['Favoriten', favorites.length, '#E8472A'],
            ['Deadlines', deadlines.length, '#D97706'],
            ['Aufgaben offen', tasks.filter((task) => !task.done).length, '#2563EB'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ ...cardStyle, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
              <div style={{ marginTop: 3, fontSize: 11, color: 'var(--c-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: 14, alignItems: 'start' }}>
          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Meine Aufgaben</h2>
              <button onClick={onOpenNotes} style={{ ...actionStyle, height: 28, padding: '0 9px', fontSize: 11 }}>Notizen öffnen</button>
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
              <input value={taskText} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Neue Aufgabe…" style={{ flex: 1, minWidth: 0, height: 34, border: '1px solid var(--c-border)', borderRadius: 8, padding: '0 10px', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 12 }} />
              <button onClick={addTask} style={{ ...actionStyle, background: 'var(--c-text)', color: 'var(--c-surface)' }}>+</button>
            </div>
            {tasks.length === 0 && <div style={{ padding: '18px 0', color: 'var(--c-text-3)', fontSize: 12 }}>Noch keine Aufgaben. Alles bereit. 🎉</div>}
            <div style={{ display: 'grid', gap: 6 }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                  <input type="checkbox" checked={task.done} onChange={() => persistTasks(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} />
                  <span style={{ flex: 1, fontSize: 13, color: task.done ? 'var(--c-text-3)' : 'var(--c-text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
                  <button onClick={() => persistTasks(tasks.filter((item) => item.id !== task.id))} aria-label="Aufgabe löschen" style={{ border: 0, background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Tagesnotiz</h2>
            <textarea value={note} onChange={(e) => saveNote(e.target.value)} placeholder="Was ist heute wichtig?" rows={6} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--c-border)', borderRadius: 8, padding: 10, background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5 }} />
            <div style={{ marginTop: 7, color: 'var(--c-text-3)', fontSize: 10 }}>Wird lokal auf diesem Gerät gespeichert.</div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Deadlines</h2>
            {deadlines.length === 0 ? <div style={{ color: 'var(--c-text-3)', fontSize: 12 }}>Keine anstehenden Deadlines.</div> : deadlines.map((folder) => <button key={folder.id} onClick={() => onRecentClick?.(folder)} style={{ display: 'block', width: '100%', border: 0, borderBottom: '1px solid var(--c-border)', background: 'transparent', padding: '8px 0', textAlign: 'left', cursor: 'pointer', color: 'var(--c-text)' }}><strong style={{ fontSize: 12 }}>{folder.name}</strong><span style={{ display: 'block', color: '#DC2626', fontSize: 11 }}>{new Date(folder.due_at).toLocaleDateString('de-DE')}</span></button>)}
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Schnellzugriff</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <button onClick={onOpenSearch} style={actionStyle}>⌕ Material suchen</button>
              <button onClick={onUpload} style={actionStyle}>↑ Hochladen</button>
              <button onClick={onOpenNotes} style={actionStyle}>✎ Notizen</button>
            </div>
          </section>
        </div>

        {recents.length > 0 && <section style={{ ...cardStyle, marginTop: 14 }}><h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Zuletzt geöffnet</h2><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{recents.map((recent) => <button key={recent.id} onClick={() => onRecentClick?.(recent)} style={{ ...actionStyle, borderRadius: 999, height: 30 }}>{recent.name}</button>)}</div></section>}
      </div>
    </div>
  );
}
