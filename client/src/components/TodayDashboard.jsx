import { useEffect, useRef, useState } from 'react';
import { getTodayDashboard, saveTodayDashboardNote, saveTodayDashboardTasks } from '../lib/api';

const LEGACY_TASKS_KEY = 'lm_today_tasks';
const LEGACY_NOTE_PREFIX = 'lm_today_note_';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readLegacy(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

export default function TodayDashboard({
  subject, folders = [], onOpenSubjects, onOpenSchedule, onOpenSearch, onOpenNotes, onUpload,
}) {
  const date = todayKey();
  const [tasks, setTasks] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [note, setNote] = useState('');
  const [saveError, setSaveError] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const noteTimer = useRef(null);
  const noteRef = useRef('');
  const noteDirty = useRef(false);
  const userChanged = useRef(false);
  const favorites = folders.filter((folder) => folder.is_favorite).slice(0, 4);

  const queueSave = (save) => {
    saveQueue.current = saveQueue.current.catch(() => {}).then(save);
    return saveQueue.current;
  };

  const persistTasks = (next) => {
    userChanged.current = true;
    setTasks(next);
    queueSave(() => saveTodayDashboardTasks(next))
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  };

  const persistNote = (value) => {
    noteDirty.current = false;
    queueSave(() => saveTodayDashboardNote(date, value))
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  };

  useEffect(() => {
    let cancelled = false;
    const legacyTasks = readLegacy(LEGACY_TASKS_KEY, []);
    const legacyNote = localStorage.getItem(LEGACY_NOTE_PREFIX + date) || '';

    getTodayDashboard(date).then((dashboard) => {
      if (cancelled || userChanged.current) return;
      const serverTasks = Array.isArray(dashboard.tasks) ? dashboard.tasks : [];
      const serverNote = typeof dashboard.note === 'string' ? dashboard.note : '';
      setTasks(serverTasks);
      setNote(serverNote);
      noteRef.current = serverNote;

      // Keep existing device-only entries when the authenticated account is first upgraded.
      if (serverTasks.length === 0 && legacyTasks.length > 0) {
        setTasks(legacyTasks);
        queueSave(() => saveTodayDashboardTasks(legacyTasks))
          .then(() => { localStorage.removeItem(LEGACY_TASKS_KEY); setSaveError(false); })
          .catch(() => setSaveError(true));
      }
      if (!serverNote && legacyNote) {
        setNote(legacyNote);
        noteRef.current = legacyNote;
        queueSave(() => saveTodayDashboardNote(date, legacyNote))
          .then(() => { localStorage.removeItem(LEGACY_NOTE_PREFIX + date); setSaveError(false); })
          .catch(() => setSaveError(true));
      }
    }).catch(() => {
      if (!cancelled) setSaveError(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(noteTimer.current);
      if (noteDirty.current) persistNote(noteRef.current);
    };
  }, [date]);

  const addTask = () => {
    const text = taskText.trim();
    if (!text) return;
    persistTasks([{ id: `${Date.now()}`, text, done: false }, ...tasks].slice(0, 20));
    setTaskText('');
  };

  const saveNote = (value) => {
    userChanged.current = true;
    setNote(value);
    noteRef.current = value;
    noteDirty.current = true;
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => persistNote(value), 400);
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
            <div style={{ marginTop: 7, color: saveError ? 'var(--c-danger-text)' : 'var(--c-text-3)', fontSize: 10 }}>
              {saveError ? 'Änderungen konnten nicht gespeichert werden.' : 'Wird in deinem Konto gespeichert.'}
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
