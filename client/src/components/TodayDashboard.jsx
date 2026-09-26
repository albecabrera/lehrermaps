import { useEffect, useRef, useState } from 'react';
import api, { getTodayDashboard, saveTodayDashboardTasks } from '../lib/api';
import { usePendingSync } from '../lib/pendingSync';
import { getCockpitLesson, getScheduleOverviewRows, getScheduleOverviewState, getScheduleSettings, remainingMinutes } from '../lib/schedule';
import { isTaskReminderEligible, normalizeTodayTasks, orderTasksByCompletion, taskDueAt, toggleTodayTask, updateTodayTaskDue, updateTodayTaskText } from '../lib/todayTasks';
import { getTodayGreeting } from '../lib/todayGreeting';
import { scheduleOneNoteTarget } from '../lib/externalApps';

const LEGACY_TASKS_KEY = 'lm_today_tasks';
const REMINDER_MARKER_KEY = 'lm_today_task_reminders';

function reminderMarker(task) {
  return `${task.id}:${task.dueDate || ''}:${task.dueTime || ''}`;
}

function readReminderMarkers() {
  try { return JSON.parse(localStorage.getItem(REMINDER_MARKER_KEY) || '{}'); } catch { return {}; }
}

function formatDue(task) {
  const due = taskDueAt(task);
  if (!due) return task.dueDate ? `Termin: ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('de-DE')}` : '';
  return `Fällig: ${due.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${task.dueTime}`;
}

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

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

function formatScheduleRange(range) {
  return range?.start && range?.end ? `${range.start}–${range.end}` : '';
}

function TodayWeeklySchedule({ schedule, now, scheduleError, onOpenMaterials, onOpenTimer, onOpenSchedule }) {
  const { todayDay, lessonState, highlightKey } = getScheduleOverviewState(schedule, now);
  const highlightedLesson = lessonState?.lesson;
  const rows = getScheduleOverviewRows(schedule);

  return (
    <section className="lm-today-week-overview" aria-labelledby="week-schedule-heading">
      <div className="lm-today-week-header">
        <div><div className="lm-eyebrow">WOCHE</div><h2 id="week-schedule-heading">Wochenstundenplan</h2></div>
        <div className="lm-today-week-actions">
          <button type="button" className="lm-button" onClick={onOpenTimer}>Timer öffnen</button>
          <button type="button" className="lm-button lm-button-primary" onClick={onOpenSchedule}>Stundenplan bearbeiten</button>
        </div>
      </div>
      {scheduleError && <div className="lm-today-state is-warning">Der Stundenplan konnte gerade nicht geladen werden. Bitte Verbindung prüfen.</div>}
      {!schedule && <p className="lm-today-muted">Stundenplan wird geladen…</p>}
      {schedule && !getScheduleSettings(schedule).configured && <div className="lm-today-state"><strong>Unterrichts- und Pausenzeiten fehlen noch.</strong><span>Lege die Block- und Pausenzeiten im Stundenplan fest, damit die aktuelle oder nächste Stunde markiert werden kann.</span></div>}
      {schedule && getScheduleSettings(schedule).configured && <div className="lm-today-week-grid" role="table" aria-label="Wochenstundenplan von Montag bis Freitag">
        <div className="lm-today-week-corner" role="columnheader">Zeit</div>
        {DAYS.map((day, index) => <div key={day} role="columnheader" className={`lm-today-week-day${todayDay === index ? ' is-today' : ''}`}>{day}<span>{todayDay === index ? 'Heute' : ''}</span></div>)}
        {rows.map((row) => {
          const isBreak = row.type === 'break';
          const time = formatScheduleRange(row.range);
          const rowLabel = isBreak ? row.breakInfo.label : `Block ${row.index + 1}`;
          return [
            <div key={`${rowLabel}-label`} role="rowheader" className={`lm-today-week-row-label${isBreak ? ' is-break' : ''}`}><strong>{rowLabel}</strong>{time && <span>{time}</span>}</div>,
            ...DAYS.map((day, dayIndex) => {
              const key = isBreak ? `${row.breakInfo.key}-${dayIndex}` : `${dayIndex}-${row.index}`;
              const rawCell = isBreak ? schedule[row.breakInfo.key]?.[dayIndex] : schedule[key];
              const cell = rawCell && typeof rawCell === 'object' ? rawCell : null;
              const isHighlight = highlightKey === key;
              const isCurrent = isHighlight && lessonState.kind === 'current';
              const isNext = isHighlight && lessonState.kind === 'next';
              return <div key={key} role="cell" className={`lm-today-week-cell${todayDay === dayIndex ? ' is-today' : ''}${isBreak ? ' is-break' : ''}${isCurrent ? ' is-current' : ''}${isNext ? ' is-next' : ''}`}>
                {cell?.label ? <>
                  <span className="lm-today-week-cell-label"><i style={{ backgroundColor: cell.color || (isBreak ? '#64748B' : '#2563EB') }} />{cell.label}</span>
                  {cell.location && <small>Raum {cell.location}</small>}
                  {isHighlight && <span className="lm-today-week-status">{isCurrent ? 'Jetzt' : 'Nächste Stunde'}</span>}
                  {cell.folderId && <button type="button" className="lm-text-button lm-today-week-materials" onClick={() => onOpenMaterials?.(cell.folderId)}>Materialien öffnen</button>}
                </> : <span className="lm-today-week-empty">—</span>}
              </div>;
            }),
          ];
        })}
      </div>}
      {schedule && getScheduleSettings(schedule).configured && !highlightedLesson && <p className="lm-today-muted">Für diese Woche sind noch keine Unterrichtseinträge hinterlegt.</p>}
    </section>
  );
}

export default function TodayDashboard({ onOpenMaterials, onOpenTimer, onOpenOneNote, onOpenSchedule }) {
  const date = todayKey();
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [editingTaskDueDate, setEditingTaskDueDate] = useState('');
  const [editingTaskDueTime, setEditingTaskDueTime] = useState('');
  const [taskAnnouncement, setTaskAnnouncement] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => globalThis.Notification?.permission || 'unsupported');
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
  const dueTaskIds = new Set(tasks.filter((task) => isTaskReminderEligible(task, now)).map((task) => task.id));
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
    setEditingTaskDueDate(task.dueDate || '');
    setEditingTaskDueTime(task.dueTime || '');
    setTaskAnnouncement(`Aufgabe bearbeiten: ${task.text}`);
  };
  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditingTaskText('');
    setEditingTaskDueDate('');
    setEditingTaskDueTime('');
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
    setTasks(updateTodayTaskDue(updateTodayTaskText(tasks, editingTaskId, nextText), editingTaskId, editingTaskDueDate, editingTaskDueTime));
    setEditingTaskId(null);
    setEditingTaskText('');
    setEditingTaskDueDate('');
    setEditingTaskDueTime('');
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

  useEffect(() => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const markers = readReminderMarkers();
    let changed = false;
    tasks.filter((task) => isTaskReminderEligible(task, now)).forEach((task) => {
      const marker = reminderMarker(task);
      if (markers[marker]) return;
      if (globalThis.Notification?.permission === 'granted') {
        try {
          new Notification('LehrerMaps · Aufgabe fällig', { body: task.text, tag: marker });
          markers[marker] = Date.now();
          changed = true;
        } catch { /* in-app due state remains available */ }
      }
    });
    if (changed) { try { localStorage.setItem(REMINDER_MARKER_KEY, JSON.stringify(markers)); } catch {} }
  }, [now, tasks, notificationPermission]);

  const requestNotifications = async () => {
    if (!globalThis.Notification?.requestPermission) return;
    const permission = await globalThis.Notification.requestPermission();
    setNotificationPermission(permission);
    setTaskAnnouncement(permission === 'granted' ? 'Benachrichtigungen für offene Erinnerungen aktiviert.' : 'Benachrichtigungen sind nicht aktiviert. Fällige Aufgaben bleiben hier sichtbar.');
  };

  return (
    <div className="lm-today-view">
      <div className="lm-today-shell">
        <header className="lm-today-header">
          <div><div className="lm-eyebrow">Dein Unterrichtstag</div><h1>{getTodayGreeting(now)}</h1><div className="lm-today-date">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
        </header>

        <div className="lm-today-content">
          <section className="lm-editorial-card lm-today-summary-card">
            <TodayWeeklySchedule schedule={schedule} now={now} scheduleError={scheduleError} onOpenMaterials={onOpenMaterials} onOpenTimer={onOpenTimer} onOpenSchedule={onOpenSchedule} />
            <section className="lm-today-lesson-card" aria-live="polite">
            <div className="lm-today-section-header"><div><div className="lm-eyebrow">{lessonState?.kind === 'current' ? 'JETZT' : 'NÄCHSTE STUNDE'}</div><h2>{lesson ? lesson.label : 'Dein Unterricht im Blick'}</h2></div>{lesson && <span className="lm-lesson-block">{lesson.blockLabel || `Block ${lesson.block}`}</span>}</div>
            {!lessonState && <p className="lm-today-muted">Stundenplan wird geladen…</p>}
            {lessonState?.kind === 'no-time-config' && <div className="lm-today-state"><strong>Unterrichts- und Pausenzeiten fehlen noch.</strong><span>Lege die Block- und Pausenzeiten im Stundenplan fest. Erst dann zeigt dieses Cockpit echte aktuelle und nächste Einträge.</span></div>}
            {lessonState?.kind === 'no-lessons' && <div className="lm-today-state"><strong>Heute und in den nächsten Schultagen steht keine Stunde an.</strong><span>Prüfe deinen Stundenplan oder genieße den freien Raum.</span></div>}
            {scheduleError && <div className="lm-today-state is-warning">Der Stundenplan konnte gerade nicht geladen werden. Bitte Verbindung prüfen.</div>}
            {lesson && <><div className="lm-lesson-details"><span>{lesson.time}</span>{lesson.location && <span>Raum {lesson.location}</span>}{lessonState.kind === 'current' && <span>Noch {remainingMinutes(lesson, now)} Min.</span>}</div><div className="lm-lesson-actions">{!lesson.isBreak && (lesson.folderId ? <button type="button" className="lm-button lm-button-primary" onClick={() => onOpenMaterials?.(lesson.folderId)}>Materialien öffnen</button> : <button type="button" className="lm-button lm-button-primary" disabled>Kein Materialordner verknüpft</button>)}<button type="button" className="lm-button" onClick={onOpenTimer}>Timer öffnen</button></div>{lesson.isBreak ? <p className="lm-today-muted">Pausenaufsicht im Blick.</p> : (!lesson.folderId && <p className="lm-today-muted">Verknüpfe einen Materialordner direkt in der passenden Stundenplanzelle.</p>)}</>}
          </section>

            <section id="tasks" className="lm-editorial-card lm-today-tasks" aria-busy={!loaded}>
            <div className="lm-today-section-header"><div><h2><span className="lm-today-task-kicker">FOKUS</span>Meine Aufgaben</h2></div><span className="lm-task-count">{openTasks}</span></div>
            <div className="lm-today-task-entry"><input value={taskText} disabled={!loaded} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Neue Aufgabe…" aria-label="Neue Aufgabe" /><button disabled={!loaded} onClick={addTask} className="lm-button lm-button-primary" aria-label="Aufgabe hinzufügen">+</button></div>
            {notificationPermission === 'default' && <button type="button" className="lm-text-button lm-task-notification-button" onClick={requestNotifications}>Benachrichtigungen aktivieren</button>}
            <p className="lm-task-reminder-disclosure">Erinnerungen funktionieren bestmöglich, solange LehrerMaps geöffnet und sichtbar ist. Bei geschlossener oder pausierter App können sie verspätet sein.</p>
            {tasks.length === 0 && <div className="lm-today-empty">Noch keine Aufgaben. Alles bereit.</div>}
            <div className="lm-today-task-list" aria-label="Aufgabenliste">
              {tasks.map((task) => {
                const editing = editingTaskId === task.id;
                return <div key={task.id} className={`lm-today-task${editing ? ' is-editing' : ''}`}>
                  <input type="checkbox" disabled={!loaded || editing} checked={task.done} onChange={() => toggleTask(task)} aria-label={`${task.text} als ${task.done ? 'offen' : 'erledigt'} markieren`} />
                  {editing ? <div className="lm-today-task-editor"><input ref={editInputRef} value={editingTaskText} maxLength="500" onChange={(event) => setEditingTaskText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveEditingTask(); } if (event.key === 'Escape') { event.preventDefault(); cancelEditingTask(); } }} aria-label="Aufgabentext bearbeiten" /><div className="lm-today-task-due-fields"><label>Datum<input type="date" value={editingTaskDueDate} onChange={(event) => setEditingTaskDueDate(event.target.value)} aria-label="Fälligkeitsdatum" /></label><label>Uhrzeit<input type="time" value={editingTaskDueTime} disabled={!editingTaskDueDate} onChange={(event) => setEditingTaskDueTime(event.target.value)} aria-label="Fälligkeitszeit" /></label><button type="button" className="lm-text-button" onClick={() => { setEditingTaskDueDate(''); setEditingTaskDueTime(''); }}>Termin entfernen</button></div><div className="lm-today-task-editor-actions"><button type="button" className="lm-button lm-button-primary" onClick={saveEditingTask}>Speichern</button><button type="button" className="lm-button" onClick={cancelEditingTask}>Abbrechen</button></div></div> : <span className={`${task.done ? 'is-done' : ''}${dueTaskIds.has(task.id) ? ' is-due' : ''}`} onDoubleClick={(event) => { event.preventDefault(); startEditingTask(task); }} onPointerUp={(event) => { if (event.pointerType !== 'touch') return; const now = Date.now(); const previous = lastTaskTouchRef.current; if (previous.id === task.id && now - previous.at < 400) { lastTaskTouchRef.current = { id: null, at: 0 }; startEditingTask(task); } else { lastTaskTouchRef.current = { id: task.id, at: now }; } }} title="Doppelklicken oder doppeltippen zum Bearbeiten">{task.text}{formatDue(task) && <small className="lm-task-due">{formatDue(task)}{dueTaskIds.has(task.id) ? ' · fällig' : ''}</small>}</span>}
                  {!editing && <button type="button" disabled={!loaded} onClick={() => startEditingTask(task)} aria-label={`Aufgabe bearbeiten: ${task.text}`} className="lm-icon-button lm-task-edit-button"><span aria-hidden="true">✎</span><span className="lm-visually-hidden">Bearbeiten</span></button>}
                  {!editing && <button type="button" disabled={!loaded} onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))} aria-label={`Aufgabe löschen: ${task.text}`} className="lm-icon-button">×</button>}
                </div>;
              })}
            </div>
            <div className="lm-visually-hidden" aria-live="polite" aria-atomic="true">{taskAnnouncement}</div>
            <div className={tasksSync.status === 'error' ? 'lm-today-save-status is-error' : 'lm-today-save-status'} aria-live="polite">{tasksSync.status === 'error' ? <><span>Aufgaben konnten nicht gespeichert werden.</span> <button type="button" onClick={retryTasksSync} className="lm-text-button">Erneut versuchen</button></> : (tasksSync.status === 'pending' ? 'Wird gespeichert…' : 'In deinem Konto gespeichert.')}</div>
          </section>
                    </section>
        </div>
      </div>
    </div>
  );
}
