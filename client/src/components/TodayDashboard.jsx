import { useState } from 'react';
import { getTodayDashboard, saveTodayDashboardTasks } from '../lib/api';
import { usePendingSync } from '../lib/pendingSync';

const LEGACY_TASKS_KEY = 'lm_today_tasks';

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const readLegacyTasks = () => {
  try {
    const tasks = normalizeTasks(JSON.parse(localStorage.getItem(LEGACY_TASKS_KEY) || '[]'));
    return tasks.length ? tasks : undefined;
  } catch { return undefined; }
};

// Keep legacy and pending client data in the exact API shape. The checklist
// already does this; without it an old numeric task id could be accepted by
// SQLite but returned as a string, making confirmation look like a network
// failure even after a successful save.
function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  const tasks = [];
  for (const task of value) {
    const id = String(task?.id ?? '').trim();
    const text = typeof task?.text === 'string' ? task.text.trim() : '';
    if (!id || id.length > 100 || !text || ids.has(id) || typeof task?.done !== 'boolean') continue;
    ids.add(id);
    tasks.push({ id, text: text.slice(0, 500), done: task.done });
    if (tasks.length === 20) break;
  }
  return tasks;
}

function pendingTaskIsNewer(pending, backendTasks, dashboard) {
  if (JSON.stringify(pending.value) === JSON.stringify(backendTasks)) return false;
  const pendingAt = Number(pending.updatedAt);
  const storedTimestamp = typeof dashboard?.tasksUpdatedAt === 'string'
    ? dashboard.tasksUpdatedAt.replace(' ', 'T')
    : '';
  const storedAt = storedTimestamp
    ? Date.parse(storedTimestamp.endsWith('Z') ? storedTimestamp : `${storedTimestamp}Z`)
    : NaN;
  // A legacy pending record has no reliable ordering information. SQLite is
  // the shared source of truth unless that record is the only available data.
  if (!Number.isFinite(pendingAt)) return backendTasks.length === 0;
  return !Number.isFinite(storedAt) || pendingAt > storedAt;
}

export default function TodayDashboard({ onOpenSchedule, onOpenSearch }) {
  const date = todayKey();
  const [tasks, setTasks, tasksSync, retryTasksSync] = usePendingSync({
    storageKey: 'lm_pending_today_tasks', initialValue: [],
    load: () => getTodayDashboard(date),
    save: saveTodayDashboardTasks, isBackendEmpty: (value) => value.length === 0, isValid: Array.isArray,
    // Pending values are already task arrays, while API reads are dashboard
    // objects. Normalise both shapes; treating a local array as a dashboard
    // silently turned every newly typed task into an empty list.
    normalizeValue: (value) => normalizeTasks(Array.isArray(value) ? value : value?.tasks),
    createPending: (value) => ({ value, updatedAt: Date.now() }),
    shouldUsePending: pendingTaskIsNewer,
    confirm: (response, value) => JSON.stringify(response?.tasks) === JSON.stringify(value),
    saveDelay: 150,
    readLegacy: readLegacyTasks, clearLegacy: () => localStorage.removeItem(LEGACY_TASKS_KEY),
    refreshInterval: 1_000,
  });
  const [taskText, setTaskText] = useState('');
  const loaded = tasksSync.hydrated;
  const saveStatus = tasksSync.status;

  const addTask = () => {
    const text = taskText.trim();
    if (!text) return;
    setTasks([{ id: `${Date.now()}`, text, done: false }, ...tasks].slice(0, 20));
    setTaskText('');
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
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onOpenSchedule} style={actionStyle}>📅 Stundenplan</button>
          </div>
        </div>

        <div className="lm-today-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
          {[
            ['Arbeitsbereich', 'Bereit', '#0F766E'],
            ['Heute', new Date().getDate(), '#E8472A'],
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
            <div style={{ marginTop: 9, color: saveStatus === 'error' ? 'var(--c-danger-text)' : 'var(--c-text-3)', fontSize: 10 }}>
              {saveStatus === 'error'
                ? <><span>{tasksSync.errorKind === 'rejected' ? 'Die Aufgaben konnten nicht gespeichert werden. Bitte prüfe sie und versuche es erneut.' : 'Nicht in der Datenbank gespeichert. Bitte prüfe die Verbindung und versuche es erneut.'}</span> <button type="button" onClick={retryTasksSync} style={{ marginLeft: 5, border: 0, padding: 0, background: 'transparent', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Erneut versuchen</button></>
                : (saveStatus === 'pending' ? 'Wird gespeichert…' : 'In deinem Konto gespeichert.')}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Schnellzugriff</h2>
            <div className="lm-today-quick-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <button onClick={onOpenSearch} style={actionStyle}>⌕ Suche</button>
              <button onClick={onOpenSchedule} style={actionStyle}>📅 Stundenplan</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
