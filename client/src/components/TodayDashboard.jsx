import { useState } from 'react';
import { getTodayDashboard, saveTodayDashboardNote, saveTodayDashboardTasks } from '../lib/api';
import { usePendingSync } from '../lib/pendingSync';

const LEGACY_TASKS_KEY = 'lm_today_tasks';
const LEGACY_NOTE_PREFIX = 'lm_today_note_';

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const readLegacyTasks = () => {
  try { const tasks = JSON.parse(localStorage.getItem(LEGACY_TASKS_KEY) || '[]'); return Array.isArray(tasks) && tasks.length ? tasks : undefined; } catch { return undefined; }
};
const readLegacyNote = (date) => {
  try { const note = localStorage.getItem(LEGACY_NOTE_PREFIX + date); return note ? note : undefined; } catch { return undefined; }
};

export default function TodayDashboard({
  subject, folders = [], onOpenSubjects, onOpenSchedule, onOpenSearch, onOpenNotes, onUpload,
}) {
  const date = todayKey();
  const [tasks, setTasks, tasksSync] = usePendingSync({
    storageKey: 'lm_pending_today_tasks', initialValue: [],
    load: () => getTodayDashboard(date).then((dashboard) => Array.isArray(dashboard.tasks) ? dashboard.tasks : []),
    save: saveTodayDashboardTasks, isBackendEmpty: (value) => value.length === 0, isValid: Array.isArray,
    confirm: (response, value) => JSON.stringify(response?.tasks) === JSON.stringify(value),
    readLegacy: readLegacyTasks, clearLegacy: () => localStorage.removeItem(LEGACY_TASKS_KEY),
  });
  const [note, setNote, noteSync] = usePendingSync({
    storageKey: `lm_pending_today_note_${date}`, initialValue: '',
    load: () => getTodayDashboard(date).then((dashboard) => typeof dashboard.note === 'string' ? dashboard.note : ''),
    save: (value) => saveTodayDashboardNote(date, value), isBackendEmpty: (value) => value === '', isValid: (value) => typeof value === 'string',
    confirm: (response, value) => response?.date === date && response?.content === value,
    saveDelay: 400,
    readLegacy: () => readLegacyNote(date), clearLegacy: () => localStorage.removeItem(LEGACY_NOTE_PREFIX + date),
  });
  const [taskText, setTaskText] = useState('');
  const loaded = tasksSync.hydrated && noteSync.hydrated;
  const saveStatus = tasksSync.status === 'error' || noteSync.status === 'error'
    ? 'error'
    : (tasksSync.status === 'pending' || noteSync.status === 'pending' ? 'pending' : 'saved');
  const favorites = folders.filter((folder) => folder.is_favorite).slice(0, 4);

  const addTask = () => {
    const text = taskText.trim();
    if (!text) return;
    setTasks([{ id: `${Date.now()}`, text, done: false }, ...tasks].slice(0, 20));
    setTaskText('');
  };

  const saveNote = (value) => {
    setNote(value);
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
    <div className="lm-today-view" style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '28px clamp(18px, 4vw, 48px) 40px' }}>
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

        <div className="lm-today-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
          {[
            ['Fächerordner', folders.length, subject.color],
            ['Favoriten', favorites.length, '#E8472A'],
            ['Aufgaben offen', tasks.filter((task) => !task.done).length, '#2563EB'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ ...cardStyle, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
              <div style={{ marginTop: 3, fontSize: 11, color: 'var(--c-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="lm-today-content" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: 14, alignItems: 'start' }}>
          <section style={cardStyle} aria-busy={!loaded}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Meine Aufgaben</h2>
              <button onClick={onOpenNotes} style={{ ...actionStyle, height: 28, padding: '0 9px', fontSize: 11 }}>Notizen öffnen</button>
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
              <input value={taskText} disabled={!loaded} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Neue Aufgabe…" style={{ flex: 1, minWidth: 0, height: 34, border: '1px solid var(--c-border)', borderRadius: 8, padding: '0 10px', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 12 }} />
              <button disabled={!loaded} onClick={addTask} style={{ ...actionStyle, background: 'var(--c-text)', color: 'var(--c-surface)' }}>+</button>
            </div>
            {tasks.length === 0 && <div style={{ padding: '18px 0', color: 'var(--c-text-3)', fontSize: 12 }}>Noch keine Aufgaben. Alles bereit. 🎉</div>}
            <div style={{ display: 'grid', gap: 6 }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                  <input type="checkbox" disabled={!loaded} checked={task.done} onChange={() => setTasks(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} />
                  <span style={{ flex: 1, fontSize: 13, color: task.done ? 'var(--c-text-3)' : 'var(--c-text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
                  <button disabled={!loaded} onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))} aria-label="Aufgabe löschen" style={{ border: 0, background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle} aria-busy={!loaded}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Tagesnotiz</h2>
            <textarea value={note} disabled={!loaded} onChange={(e) => saveNote(e.target.value)} placeholder="Was ist heute wichtig?" rows={6} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--c-border)', borderRadius: 8, padding: 10, background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5 }} />
            <div style={{ marginTop: 7, color: saveStatus === 'error' ? 'var(--c-danger-text)' : 'var(--c-text-3)', fontSize: 10 }}>
              {saveStatus === 'error'
                ? 'Nicht in der Datenbank gespeichert. Bitte prüfe die Verbindung und versuche es erneut.'
                : (saveStatus === 'pending' ? 'Wird gespeichert…' : 'In deinem Konto gespeichert.')}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Schnellzugriff</h2>
            <div className="lm-today-quick-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <button onClick={onOpenSearch} style={actionStyle}>⌕ Material suchen</button>
              <button onClick={onUpload} style={actionStyle}>↑ Hochladen</button>
              <button onClick={onOpenNotes} style={actionStyle}>✎ Notizen</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
