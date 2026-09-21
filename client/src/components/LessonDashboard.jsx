import { useEffect, useState } from 'react';
import { getLessonSession } from '../lib/api';

const statusLabel = (status) => ({ active: 'Aktiv', completed: 'Abgeschlossen', planned: 'Geplant', draft: 'Entwurf' }[String(status || '').toLowerCase()] || 'Geplant');

const formatDate = (value) => {
  if (!value) return 'Ohne Datum';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(parsed);
};

const dateKey = (lesson) => lesson.lesson_date || 'ohne-datum';

export default function LessonDashboard({ sessions = [], folders = [], accent, onOpen, onPlan }) {
  const [sessionDetails, setSessionDetails] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(sessions.map((lesson) => getLessonSession(lesson.id).then((detail) => [lesson.id, detail]).catch(() => [lesson.id, null]))).then((entries) => {
      if (!cancelled) setSessionDetails(Object.fromEntries(entries.filter(([, detail]) => detail)));
    });
    return () => { cancelled = true; };
  }, [sessions]);
  const folderById = new Map(folders.map((folder) => [Number(folder.id), folder]));
  const groups = sessions.reduce((result, lesson) => {
    const key = dateKey(lesson);
    (result[key] ||= []).push(lesson);
    return result;
  }, {});
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a === 'ohne-datum' ? 1 : b === 'ohne-datum' ? -1 : a.localeCompare(b));
  const firstFolder = folders.find((folder) => folder.subject !== 'system');

  return <main className="lm-lesson-dashboard" aria-labelledby="lesson-dashboard-title">
    <div className="lm-lesson-dashboard-shell">
      <header className="lm-lesson-command-header">
        <div><div className="lm-eyebrow">Unterricht vorbereiten</div><h1 id="lesson-dashboard-title">Dein Unterricht im Fluss</h1><p>Plane, starte und führe jede Stunde mit Material, Phasen und Zeit im Blick.</p></div>
        <button type="button" className="lm-button lm-button-primary lm-lesson-create" style={{ '--lesson-accent': accent }} onClick={() => firstFolder && onPlan?.(firstFolder)} disabled={!firstFolder}>+ Neue Stunde planen</button>
      </header>
      {!sessions.length ? <section className="lm-empty-state lm-lesson-empty"><span aria-hidden="true">✦</span><div><h2>Bereit für die nächste Stunde?</h2><p>Lege eine Stunde an und führe sie anschließend direkt im Unterrichtsmodus durch.</p></div><button type="button" className="lm-button lm-button-primary" onClick={() => firstFolder && onPlan?.(firstFolder)} disabled={!firstFolder}>Neue Stunde planen</button></section> : <div className="lm-lesson-groups">
        {sortedGroups.map(([date, lessons]) => <section key={date} className="lm-lesson-group" aria-labelledby={`lesson-date-${date}`}>
          <div className="lm-section-heading"><div><div className="lm-eyebrow">{date === 'ohne-datum' ? 'Ohne Termin' : 'Unterrichtstag'}</div><h2 id={`lesson-date-${date}`}>{date === 'ohne-datum' ? 'Noch nicht terminiert' : formatDate(date)}</h2></div><span className="lm-status-chip">{lessons.length} {lessons.length === 1 ? 'Stunde' : 'Stunden'}</span></div>
          <div className="lm-lesson-list">{lessons.map((lesson) => {
            const folder = folderById.get(Number(lesson.folder_id));
            const phases = sessionDetails[lesson.id]?.phases || lesson.phases || [];
            const totalMinutes = phases.reduce((sum, phase) => sum + Number(phase.duration_seconds || 0), 0) / 60;
            const completed = phases.filter((phase) => phase.timer_state === 'completed').length;
            const progress = phases.length ? Math.round((completed / phases.length) * 100) : 0;
            const canOpen = Boolean(folder);
            return <article key={lesson.id} className="lm-lesson-card" style={{ '--lesson-accent': lesson.color || accent }}>
              <div className="lm-lesson-card-main"><div className="lm-lesson-subject-dot" aria-hidden="true" /><div><div className="lm-lesson-card-meta"><span>{lesson.subject || folder?.subject || 'Ohne Fach'}</span><span>·</span><span>{lesson.class_name || folder?.group_name || 'Ohne Klasse'}</span></div><h3>{lesson.title}</h3>{lesson.learning_goal && <p>{lesson.learning_goal}</p>}</div></div>
              <div className="lm-lesson-card-side"><span className={`lm-status-chip is-${String(lesson.status || 'draft').toLowerCase()}`}>{statusLabel(lesson.status)}</span><div className="lm-lesson-progress-label"><span>{phases.length} Phasen · {Math.round(totalMinutes)} Min.</span><strong>{progress}%</strong></div><div className="lm-lesson-progress" aria-label={`${progress}% der Phasen abgeschlossen`}><i style={{ width: `${progress}%` }} /></div><button type="button" className="lm-button lm-button-primary" onClick={() => canOpen && onOpen?.(folder, lesson)} disabled={!canOpen}>{progress > 0 ? 'Stunde fortsetzen' : 'Stunde öffnen'} <span aria-hidden="true">→</span></button></div>
            </article>;
          })}</div>
        </section>)}
      </div>}
    </div>
  </main>;
}
