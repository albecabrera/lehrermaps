import { useEffect, useRef, useState } from 'react';
import api, { getTodayDashboard, saveTodayDashboardTasks } from '../lib/api';
import { usePendingSync } from '../lib/pendingSync';
import { getCockpitLesson, remainingMinutes } from '../lib/schedule';
import { normalizeTodayTasks, orderTasksByCompletion, toggleTodayTask, updateTodayTaskText } from '../lib/todayTasks';
import { scheduleOneNoteTarget } from '../lib/externalApps';
import { getTodayGreeting } from '../lib/todayGreeting';

const LEGACY_TASKS_KEY = 'lm_today_tasks';

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const readLegacyTasks = () => {
  try { const tasks = normalizeTodayTasks(JSON.parse(localStorage.getItem(LEGACY_TASKS_KEY) || '[]')); return tasks.length ? tasks : undefined; } catch { return undefined; }
};

function pendingTaskIsNewer(pending, backendTasks, dashboard) {
  if (JSON.stringify(pending.value) === JSON.stringify(backendTasks)) return false;
  const pendingAt = Number(pending.updatedAt);
  const timestamp = typeof dashboard?.tasksUpdatedAt === 'string' ? dashboard.tasksUpdatedAt.replace(' ', 'T') : '';
  const storedAt = timestamp ? Date.parse(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`) : NaN;
  return Number.isFinite(pendingAt) ? (!Number.isFinite(storedAt) || pendingAt > storedAt) : backendTasks.length === 0;
}

export default function TodayDashboard({ onOpenSchedule, onOpenMaterials, onOpenTimer, onOpenOneNote }) {
  const date = todayKey();
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [taskAnnouncement, setTaskAnnouncement] = useState('');
  const [scheduleError, setScheduleError] = useState(false);
  const editInputRef = useRef(null);
  const lastTaskTouchRef = useRef({ id: null, at: 0 });
  const [tasks, setTasks, tasksSync, retryTasksSync] = usePendingSync({
    storageKey: 'lm_pending_today_tasks', initialValue: [], load: () => getTodayDashboard(date),
    save: saveTodayDashboardTasks, isBackendEmpty: (value) => value.length === 0, isValid: Array.isArray,
    normalizeValue: (value) => orderTasksByCompletion(Array.isArray(value) ? value : value?.tasks),
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
  const lessonOneNoteTarget = lesson && !lesson.folderId ? scheduleOneNoteTarget(lesson.label) : null;
  const addTask = () => {
    const text = taskText.trim();
    if (!text) return;
    setTasks([{ id: `${Date.now()}`, text, done: false }, ...tasks].slice(0, 20));
    setTaskText('');
    setTaskAnnouncement('Aufgabe hinzugefügt.');
  };
  const startEditingTask = (task) => {
    if (!loaded) return;
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
    setTaskAnnouncement(`Aufgabe bearbeiten: ${task.text}`);
  };
  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditingTaskText('');
    setTaskAnnouncement('Bearbeiten abgebrochen.');
  };
  const saveEditingTask = () => {
    if (!editingTaskId) return;
    const nextText = editingTaskText.trim();
    if (!nextText) {
      setTaskAnnouncement('Eine Aufgabe braucht einen Text.');
      editInputRef.current?.focus();
      return;
    }
    setTasks(updateTodayTaskText(tasks, editingTaskId, nextText));
    setEditingTaskId(null);
    setEditingTaskText('');
    setTaskAnnouncement('Aufgabe gespeichert.');
  };
  const toggleTask = (task) => {
    if (editingTaskId === task.id) return;
    setTasks(toggleTodayTask(tasks, task.id));
    setTaskAnnouncement(task.done ? 'Aufgabe wieder geöffnet und zu den offenen Aufgaben verschoben.' : 'Aufgabe erledigt und ans Ende der Liste verschoben.');
  };

  useEffect(() => {
    if (editingTaskId) editInputRef.current?.focus();
  }, [editingTaskId]);

  return (
    <div className="lm-today-view">
      <div className="lm-today-shell">
        <header className="lm-today-header">
          <div><h1>{getTodayGreeting(now)}</h1><div className="lm-today-date">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
          <button type="button" className="lm-button lm-today-header-action" onClick={onOpenSchedule}>Stundenplan öffnen</button>
        </header>

        <div className="lm-today-content">
          <section className="lm-today-lesson-card" aria-live="polite">
            <div className="lm-today-section-header"><div><div className="lm-eyebrow">{lessonState?.kind === 'current' ? 'JETZT' : 'NÄCHSTE STUNDE'}</div><h2>{lesson ? lesson.label : 'Dein Unterricht im Blick'}</h2></div>{lesson && <span className="lm-lesson-block">{lesson.blockLabel || `Block ${lesson.block}`}</span>}</div>
            {!lessonState && <p className="lm-today-muted">Stundenplan wird geladen…</p>}
            {lessonState?.kind === 'no-time-config' && <div className="lm-today-state"><strong>Unterrichts- und Pausenzeiten fehlen noch.</strong><span>Lege die Block- und Pausenzeiten im Stundenplan fest. Erst dann zeigt dieses Cockpit echte aktuelle und nächste Einträge.</span></div>}
            {lessonState?.kind === 'no-lessons' && <div className="lm-today-state"><strong>Heute und in den nächsten Schultagen steht keine Stunde an.</strong><span>Prüfe deinen Stundenplan oder genieße den freien Raum.</span></div>}
            {scheduleError && <div className="lm-today-state is-warning">Der Stundenplan konnte gerade nicht geladen werden. Bitte Verbindung prüfen.</div>}
            {lesson && <><div className="lm-lesson-details"><span>{lesson.time}</span>{lesson.location && <span>Raum {lesson.location}</span>}{lessonState.kind === 'current' && <span>Noch {remainingMinutes(lesson, now)} Min.</span>}</div><div className="lm-lesson-actions">{!lesson.isBreak && (lesson.folderId ? <button type="button" className="lm-button lm-button-primary" onClick={() => onOpenMaterials?.(lesson.folderId)}>Materialien öffnen</button> : <button type="button" className="lm-button lm-button-primary" disabled>Kein Materialordner verknüpft</button>)}<button type="button" className="lm-button" onClick={onOpenTimer}>Timer öffnen</button></div>{lesson.isBreak ? <p className="lm-today-muted">Pausenaufsicht im Blick.</p> : (!lesson.folderId && <p className="lm-today-muted">Verknüpfe einen Materialordner direkt in der passenden Stundenplanzelle.</p>)}</>}
          </section>

          <section id="tasks" className="lm-editorial-card lm-today-tasks" aria-busy={!loaded}>
            <div className="lm-today-section-header"><div><div className="lm-eyebrow">FOKUS</div><h2>Meine Aufgaben</h2></div><span className="lm-task-count">{openTasks}</span></div>
            <div className="lm-today-task-entry"><input value={taskText} disabled={!loaded} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Neue Aufgabe…" aria-label="Neue Aufgabe" /><button disabled={!loaded} onClick={addTask} className="lm-button lm-button-primary" aria-label="Aufgabe hinzufügen">+</button></div>
            {tasks.length === 0 && <div className="lm-today-empty">Noch keine Aufgaben. Alles bereit.</div>}
            <div className="lm-today-task-list" aria-label="Aufgabenliste">
              {tasks.map((task) => {
                const editing = editingTaskId === task.id;
                return <div key={task.id} className={`lm-today-task${editing ? ' is-editing' : ''}`}>
                  <input type="checkbox" disabled={!loaded || editing} checked={task.done} onChange={() => toggleTask(task)} aria-label={`${task.text} als ${task.done ? 'offen' : 'erledigt'} markieren`} />
                  {editing ? <div className="lm-today-task-editor"><input ref={editInputRef} value={editingTaskText} maxLength="500" onChange={(event) => setEditingTaskText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveEditingTask(); } if (event.key === 'Escape') { event.preventDefault(); cancelEditingTask(); } }} aria-label="Aufgabentext bearbeiten" /><div className="lm-today-task-editor-actions"><button type="button" className="lm-button lm-button-primary" onClick={saveEditingTask}>Speichern</button><button type="button" className="lm-button" onClick={cancelEditingTask}>Abbrechen</button></div></div> : <span className={task.done ? 'is-done' : undefined} onDoubleClick={(event) => { event.preventDefault(); startEditingTask(task); }} onPointerUp={(event) => { if (event.pointerType !== 'touch') return; const now = Date.now(); const previous = lastTaskTouchRef.current; if (previous.id === task.id && now - previous.at < 400) { lastTaskTouchRef.current = { id: null, at: 0 }; startEditingTask(task); } else { lastTaskTouchRef.current = { id: task.id, at: now }; } }} title="Doppelklicken oder doppeltippen zum Bearbeiten">{task.text}</span>}
                  {!editing && <button type="button" disabled={!loaded} onClick={() => startEditingTask(task)} aria-label={`Aufgabe bearbeiten: ${task.text}`} className="lm-icon-button lm-task-edit-button"><span aria-hidden="true">✎</span><span className="lm-visually-hidden">Bearbeiten</span></button>}
                  {!editing && <button type="button" disabled={!loaded} onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))} aria-label={`Aufgabe löschen: ${task.text}`} className="lm-icon-button">×</button>}
                </div>;
              })}
            </div>
            <div className="lm-visually-hidden" aria-live="polite" aria-atomic="true">{taskAnnouncement}</div>
            <div className={tasksSync.status === 'error' ? 'lm-today-save-status is-error' : 'lm-today-save-status'} aria-live="polite">{tasksSync.status === 'error' ? <><span>Aufgaben konnten nicht gespeichert werden.</span> <button type="button" onClick={retryTasksSync} className="lm-text-button">Erneut versuchen</button></> : (tasksSync.status === 'pending' ? 'Wird gespeichert…' : 'In deinem Konto gespeichert.')}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
