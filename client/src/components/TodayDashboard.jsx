import { useEffect, useState } from 'react';
import api, { getTodayDashboard, saveTodayDashboardTasks } from '../lib/api';
import { usePendingSync } from '../lib/pendingSync';
import { getCockpitLesson, remainingMinutes } from '../lib/schedule';

const LEGACY_TASKS_KEY = 'lm_today_tasks';

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap((task) => {
    const id = String(task?.id ?? '').trim();
    const text = typeof task?.text === 'string' ? task.text.trim() : '';
    if (!id || id.length > 100 || !text || ids.has(id) || typeof task?.done !== 'boolean') return [];
    ids.add(id);
    return [{ id, text: text.slice(0, 500), done: task.done }];
  }).slice(0, 20);
}

const readLegacyTasks = () => {
  try { const tasks = normalizeTasks(JSON.parse(localStorage.getItem(LEGACY_TASKS_KEY) || '[]')); return tasks.length ? tasks : undefined; } catch { return undefined; }
};

function pendingTaskIsNewer(pending, backendTasks, dashboard) {
  if (JSON.stringify(pending.value) === JSON.stringify(backendTasks)) return false;
  const pendingAt = Number(pending.updatedAt);
  const timestamp = typeof dashboard?.tasksUpdatedAt === 'string' ? dashboard.tasksUpdatedAt.replace(' ', 'T') : '';
  const storedAt = timestamp ? Date.parse(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`) : NaN;
  return Number.isFinite(pendingAt) ? (!Number.isFinite(storedAt) || pendingAt > storedAt) : backendTasks.length === 0;
}

function greeting(hour) {
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function TodayDashboard({ onOpenSchedule, onOpenMaterials, onOpenTimer }) {
  const date = todayKey();
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [scheduleError, setScheduleError] = useState(false);
  const [tasks, setTasks, tasksSync, retryTasksSync] = usePendingSync({
    storageKey: 'lm_pending_today_tasks', initialValue: [], load: () => getTodayDashboard(date),
    save: saveTodayDashboardTasks, isBackendEmpty: (value) => value.length === 0, isValid: Array.isArray,
    normalizeValue: (value) => normalizeTasks(Array.isArray(value) ? value : value?.tasks),
    createPending: (value) => ({ value, updatedAt: Date.now() }), shouldUsePending: pendingTaskIsNewer,
    confirm: (response, value) => JSON.stringify(response?.tasks) === JSON.stringify(value), saveDelay: 150,
    readLegacy: readLegacyTasks, clearLegacy: () => localStorage.removeItem(LEGACY_TASKS_KEY), refreshInterval: 1_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    api.get('/schedule').then((res) => setSchedule(res.data || {})).catch(() => setScheduleError(true));
    return () => window.clearInterval(timer);
  }, []);

  const loaded = tasksSync.hydrated;
  const lessonState = schedule ? getCockpitLesson(schedule, now) : null;
  const lesson = lessonState?.lesson;
  const openTasks = tasks.filter((task) => !task.done).length;
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
          <div><div className="lm-eyebrow">HEUTE · BETRIEBSZENTRALE</div><h1>{greeting(now.getHours())}.</h1><div className="lm-today-date">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
          <button type="button" className="lm-button lm-today-header-action" onClick={onOpenSchedule}>Stundenplan öffnen</button>
        </header>

        <div className="lm-today-stats" aria-label="Tagesindikatoren">
          <div className="lm-today-stat" style={{ '--stat-color': '#0F766E' }}><div className="lm-today-stat-value">{lessonState?.kind === 'current' ? 'Läuft' : lessonState?.kind === 'next' ? 'Als Nächstes' : 'Plan prüfen'}</div><div className="lm-today-stat-label">Unterricht</div></div>
          <div className="lm-today-stat" style={{ '--stat-color': '#E8472A' }}><div className="lm-today-stat-value is-date">{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div><div className="lm-today-stat-label">Aktuelle Zeit</div></div>
          <div className="lm-today-stat" style={{ '--stat-color': '#2563EB' }}><div className="lm-today-stat-value">{openTasks}</div><div className="lm-today-stat-label">Aufgaben offen</div></div>
        </div>

        <div className="lm-today-content">
          <section className="lm-today-lesson-card" aria-live="polite">
            <div className="lm-today-section-header"><div><div className="lm-eyebrow">{lessonState?.kind === 'current' ? 'JETZT' : 'NÄCHSTE STUNDE'}</div><h2>{lesson ? lesson.label : 'Dein Unterricht im Blick'}</h2></div>{lesson && <span className="lm-lesson-block">Block {lesson.block}</span>}</div>
            {!lessonState && <p className="lm-today-muted">Stundenplan wird geladen…</p>}
            {lessonState?.kind === 'no-time-config' && <div className="lm-today-state"><strong>Unterrichtszeiten fehlen noch.</strong><span>Lege die sechs Blockzeiten im Stundenplan fest. Erst dann zeigt dieses Cockpit echte aktuelle und nächste Stunden.</span><button type="button" className="lm-button lm-button-primary" onClick={onOpenSchedule}>Zeiten einrichten</button></div>}
            {lessonState?.kind === 'no-lessons' && <div className="lm-today-state"><strong>Heute und in den nächsten Schultagen steht keine Stunde an.</strong><span>Prüfe deinen Stundenplan oder genieße den freien Raum.</span><button type="button" className="lm-button" onClick={onOpenSchedule}>Stundenplan prüfen</button></div>}
            {scheduleError && <div className="lm-today-state is-warning">Der Stundenplan konnte gerade nicht geladen werden. Bitte Verbindung prüfen.</div>}
            {lesson && <><div className="lm-lesson-details"><span>{lesson.time}</span>{lesson.location && <span>Raum {lesson.location}</span>}{lessonState.kind === 'current' && <span>Noch {remainingMinutes(lesson, now)} Min.</span>}</div><div className="lm-lesson-actions"><button type="button" className="lm-button lm-button-primary" disabled={!lesson.folderId} onClick={() => onOpenMaterials?.(lesson.folderId)}>{lesson.folderId ? 'Materialien öffnen' : 'Kein Materialordner verknüpft'}</button><button type="button" className="lm-button" onClick={onOpenSchedule}>Stundenplan</button><button type="button" className="lm-button" onClick={onOpenTimer}>Timer öffnen</button></div>{!lesson.folderId && <p className="lm-today-muted">Verknüpfe einen Materialordner direkt in der passenden Stundenplanzelle.</p>}</>}
          </section>

          <section className="lm-editorial-card lm-today-tasks" aria-busy={!loaded}>
            <div className="lm-today-section-header"><div><div className="lm-eyebrow">FOKUS</div><h2>Meine Aufgaben</h2></div><span className="lm-task-count">{openTasks}</span></div>
            <div className="lm-today-task-entry"><input value={taskText} disabled={!loaded} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Neue Aufgabe…" aria-label="Neue Aufgabe" /><button disabled={!loaded} onClick={addTask} className="lm-button lm-button-primary" aria-label="Aufgabe hinzufügen">+</button></div>
            {tasks.length === 0 && <div className="lm-today-empty">Noch keine Aufgaben. Alles bereit.</div>}
            <div className="lm-today-task-list">{tasks.map((task) => <div key={task.id} className="lm-today-task"><input type="checkbox" disabled={!loaded} checked={task.done} onChange={() => setTasks(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} /><span className={task.done ? 'is-done' : undefined}>{task.text}</span><button disabled={!loaded} onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))} aria-label="Aufgabe löschen" className="lm-icon-button">×</button></div>)}</div>
            <div className={tasksSync.status === 'error' ? 'lm-today-save-status is-error' : 'lm-today-save-status'} aria-live="polite">{tasksSync.status === 'error' ? <><span>Aufgaben konnten nicht gespeichert werden.</span> <button type="button" onClick={retryTasksSync} className="lm-text-button">Erneut versuchen</button></> : (tasksSync.status === 'pending' ? 'Wird gespeichert…' : 'In deinem Konto gespeichert.')}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
