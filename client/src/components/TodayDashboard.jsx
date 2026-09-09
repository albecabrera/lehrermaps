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

export default function TodayDashboard({ onOpenSchedule }) {
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

  return (
    <div className="lm-today-view">
      <div className="lm-today-shell">
        <header className="lm-today-header">
          <div>
            <div className="lm-eyebrow">Heute</div>
            <h1>Dein Unterrichtsstart</h1>
            <div className="lm-today-date">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="lm-today-header-actions">
            <button onClick={onOpenSchedule} className="lm-button lm-button-secondary">📅 Stundenplan</button>
          </div>
        </header>

        <div className="lm-today-stats">
          {[
            ['Arbeitsbereich', 'Bereit', '#0F766E'],
            ['Heute', new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()), '#E8472A'],
            ['Aufgaben offen', tasks.filter((task) => !task.done).length, '#2563EB'],
          ].map(([label, value, color]) => (
            <div key={label} className="lm-today-stat lm-stagger-in" style={{ '--stat-color': color }}>
              <div className={label === 'Heute' ? 'lm-today-stat-value is-date' : 'lm-today-stat-value'}>{value}</div>
              <div className="lm-today-stat-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="lm-today-content">
          <section className="lm-editorial-card" aria-busy={!loaded}>
            <div className="lm-today-section-header">
              <h2>Meine Aufgaben</h2>
            </div>
            <div className="lm-today-task-entry">
              <input value={taskText} disabled={!loaded} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Neue Aufgabe…" />
              <button disabled={!loaded} onClick={addTask} className="lm-button lm-button-primary" aria-label="Aufgabe hinzufügen">+</button>
            </div>
            {tasks.length === 0 && <div className="lm-today-empty">Noch keine Aufgaben. Alles bereit. 🎉</div>}
            <div className="lm-today-task-list">
              {tasks.map((task) => (
                <div key={task.id} className="lm-today-task">
                  <input type="checkbox" disabled={!loaded} checked={task.done} onChange={() => setTasks(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} />
                  <span className={task.done ? 'is-done' : undefined}>{task.text}</span>
                  <button disabled={!loaded} onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))} aria-label="Aufgabe löschen" className="lm-icon-button">×</button>
                </div>
              ))}
            </div>
            <div className={saveStatus === 'error' ? 'lm-today-save-status is-error' : 'lm-today-save-status'}>
              {saveStatus === 'error'
                ? <><span>{tasksSync.errorKind === 'rejected' ? 'Die Aufgaben konnten nicht gespeichert werden. Bitte prüfe sie und versuche es erneut.' : 'Nicht in der Datenbank gespeichert. Bitte prüfe die Verbindung und versuche es erneut.'}</span> <button type="button" onClick={retryTasksSync} className="lm-text-button">Erneut versuchen</button></>
                : (saveStatus === 'pending' ? 'Wird gespeichert…' : 'In deinem Konto gespeichert.')}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
