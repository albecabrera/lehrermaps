import { useEffect, useMemo, useRef, useState } from 'react';
import { createLessonDisplaySession, createLessonPhase, createLessonSession, getLessonSession, getLessonSessions, updateLessonDisplaySession, updateLessonPhase, updateLessonSession } from '../lib/api';
import FilePreview from './FilePreview';
import { RichTextEditor } from './NotesEditor';
import TeachingCanvas from './Canvas/TeachingCanvas';

const DEFAULT_PHASES = [
  ['Einstieg', 5], ['Erarbeitung', 15], ['Partnerarbeit', 10], ['Sicherung', 10], ['Abschluss', 5],
];

const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
const timeParts = (seconds) => ({ hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60 });
const timeFromParts = (parts) => Math.max(0, (Number(parts.hours) || 0) * 3600 + (Number(parts.minutes) || 0) * 60 + (Number(parts.seconds) || 0));
const makePlanningDraft = (folder) => ({
  title: folder.name,
  lesson_date: new Date().toISOString().slice(0, 10),
  class_name: folder.group_name || '',
  learning_goal: '',
  phases: DEFAULT_PHASES.map(([title, minutes]) => ({ title, minutes, student_instruction: '' })),
});

export default function TeachingMode({ folder, files, links, accent, t, onClose, startWithPlanner = false }) {
  const [session, setSession] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [timerFullscreen, setTimerFullscreen] = useState(false);
  const [durationDraft, setDurationDraft] = useState({ hours: 0, minutes: 5, seconds: 0 });
  const [showSolutions, setShowSolutions] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [displayUrl, setDisplayUrl] = useState('');
  const [displayToken, setDisplayToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(startWithPlanner);
  const [planningDraft, setPlanningDraft] = useState(() => makePlanningDraft(folder));
  const [planningSaving, setPlanningSaving] = useState(false);
  const [planningError, setPlanningError] = useState('');
  const [mobilePhaseFocus, setMobilePhaseFocus] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 760);
  const phaseTouchStart = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const onChange = (event) => {
      setIsMobileLayout(event.matches);
      if (!event.matches) setMobilePhaseFocus(false);
    };
    setIsMobileLayout(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (startWithPlanner) {
      setPlanningDraft(makePlanningDraft(folder));
      setPlanning(true);
      return undefined;
    }
    const storageKey = `lm_lesson_session_${folder.id}`;
    const restore = async () => {
      const storedId = window.localStorage.getItem(storageKey);
      if (storedId) {
        const existing = await getLessonSession(storedId).catch(() => null);
        if (existing) { setSession(existing); setPlanning(false); setRemaining(existing.phases?.[0]?.duration_seconds || 300); setDurationDraft(timeParts(existing.phases?.[0]?.duration_seconds || 300)); return; }
      }
      const saved = await getLessonSessions().catch(() => []);
      const folderSession = saved.find((item) => Number(item.folder_id) === Number(folder.id));
      if (folderSession) {
        const existing = await getLessonSession(folderSession.id).catch(() => null);
        if (existing) { window.localStorage.setItem(storageKey, String(existing.id)); setSession(existing); setPlanning(false); setRemaining(existing.phases?.[0]?.duration_seconds || 300); setDurationDraft(timeParts(existing.phases?.[0]?.duration_seconds || 300)); return; }
      }
      setPlanningDraft(makePlanningDraft(folder));
      setPlanning(true);
    };
    restore().catch(() => {});
  }, [folder.id, folder.name, folder.subject, startWithPlanner]);

  const phase = session?.phases?.[activeIndex] || null;
  const visibleFiles = useMemo(() => files.filter((file) => showSolutions || (file.material_role || 'other') !== 'solution'), [files, showSolutions]);

  useEffect(() => {
    if (!running || !phase) return undefined;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((Number(phase.duration_seconds) * 1000 - (Date.now() - startedAt)) / 1000));
      setRemaining(next);
      if (next === 0) setRunning(false);
    }, 1000);
    updateLessonPhase(phase.id, { timer_state: 'running', timer_started_at: new Date(startedAt).toISOString(), timer_remaining_seconds: remaining }).catch(() => {});
    return () => window.clearInterval(timer);
  }, [running, phase?.id, startedAt]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { if (timerFullscreen) setTimerFullscreen(false); else onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, timerFullscreen]);

  const selectPhase = (index) => {
    setActiveIndex(index);
    if (isMobileLayout) setMobilePhaseFocus(true);
    setRunning(false);
    setStartedAt(null);
    setRemaining(session?.phases?.[index]?.duration_seconds || 300);
    setDurationDraft(timeParts(session?.phases?.[index]?.duration_seconds || 300));
    if (displayToken && session?.phases?.[index]?.id) updateLessonDisplaySession(displayToken, session.phases[index].id).catch(() => {});
  };

  const handlePhaseTouchStart = (event) => {
    if (isMobileLayout) phaseTouchStart.current = event.touches[0].clientX;
  };

  const handlePhaseTouchEnd = (event) => {
    if (!isMobileLayout || phaseTouchStart.current === null || !session?.phases?.length) return;
    const delta = event.changedTouches[0].clientX - phaseTouchStart.current;
    phaseTouchStart.current = null;
    if (Math.abs(delta) < 60) return;
    const nextIndex = delta < 0
      ? Math.min(session.phases.length - 1, activeIndex + 1)
      : Math.max(0, activeIndex - 1);
    if (nextIndex !== activeIndex) selectPhase(nextIndex);
  };

  const applyDuration = async () => {
    if (!phase) return;
    const duration = timeFromParts(durationDraft);
    setRemaining(duration);
    setRunning(false);
    setStartedAt(null);
    setSession((current) => ({ ...current, phases: current.phases.map((item, index) => index === activeIndex ? { ...item, duration_seconds: duration } : item) }));
    await updateLessonPhase(phase.id, { duration_seconds: duration, timer_state: 'idle', timer_remaining_seconds: duration }).catch(() => {});
  };

  const saveNotes = async (value) => {
    if (!session) return;
    setSession((current) => ({ ...current, teacher_notes: value }));
    await updateLessonSession(session.id, { teacher_notes: value }).catch(() => {});
  };

  const savePlannedLesson = async () => {
    setPlanningSaving(true);
    setPlanningError('');
    try {
      const created = await createLessonSession({
        folder_id: folder.id,
        title: planningDraft.title.trim() || folder.name,
        subject: folder.subject,
        lesson_date: planningDraft.lesson_date,
        class_name: planningDraft.class_name.trim() || null,
        learning_goal: planningDraft.learning_goal.trim() || null,
        phases: planningDraft.phases.map((item, position) => ({
          title: item.title.trim() || `Phase ${position + 1}`,
          position,
          duration_seconds: Math.max(60, (Number(item.minutes) || 1) * 60),
          student_instruction: item.student_instruction.trim() || null,
        })),
      });
      const persisted = await getLessonSession(created.id).catch(() => null);
      const savedLesson = persisted || created;
      window.localStorage.setItem(`lm_lesson_session_${folder.id}`, String(created.id));
      setSession(savedLesson);
      setPlanning(false);
      setActiveIndex(0);
      setRemaining(savedLesson.phases?.[0]?.duration_seconds || 300);
      setDurationDraft(timeParts(savedLesson.phases?.[0]?.duration_seconds || 300));
    } catch (error) {
      setPlanningError(error?.response?.data?.error || 'Die Stunde konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally { setPlanningSaving(false); }
  };

  const openProjection = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const result = await createLessonDisplaySession(session.id);
      const url = `${window.location.origin}/display/${result.token}`;
      setDisplayUrl(url);
      setDisplayToken(result.token);
      if (phase?.id) await updateLessonDisplaySession(result.token, phase.id).catch(() => {});
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally { setSaving(false); }
  };

  if (planning) return <LessonPlanner folder={folder} accent={accent} draft={planningDraft} setDraft={setPlanningDraft} saving={planningSaving} error={planningError} onSave={savePlannedLesson} onCancel={() => { if (session) setPlanning(false); else onClose?.(); }} />;

  return (
    <div className="lm-teaching-mode" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--c-bg)', color: 'var(--c-text)', display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)' }}>
      <aside className={`lm-teaching-sidebar${mobilePhaseFocus ? ' is-hidden' : ''}`} style={{ borderRight: '1px solid var(--c-border)', background: 'var(--c-surface)', padding: 18, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}><div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: accent }}>Lehrerhilfe</div><h2 style={{ margin: '4px 0 0', fontSize: 20 }}>{folder.name}</h2></div><button aria-label="Unterrichtsmodus schließen" onClick={onClose} style={{ width: 30, height: 30, border: '1px solid var(--c-border)', borderRadius: 8, background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer' }}>×</button></div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--c-text-2)', marginBottom: 14 }}>Private Lehrernotiz<textarea value={session?.teacher_notes || ''} onChange={(event) => saveNotes(event.target.value)} placeholder="Nur für dich sichtbar …" style={{ display: 'block', width: '100%', minHeight: 58, marginTop: 5, resize: 'vertical', boxSizing: 'border-box', border: '1px solid var(--c-border)', borderRadius: 8, padding: 8, background: 'var(--c-input-bg)', color: 'var(--c-text)', fontFamily: 'inherit' }} /></label>
        <button onClick={openProjection} disabled={!session || saving} style={{ width: '100%', height: 36, border: 0, borderRadius: 8, background: accent, color: '#fff', fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>{saving ? 'Projektion wird geöffnet …' : 'Projektionsansicht öffnen'}</button>
        {displayUrl && <div style={{ fontSize: 10, color: 'var(--c-text-3)', overflowWrap: 'anywhere', marginBottom: 12 }}>Link: {displayUrl}</div>}
        <button onClick={() => setShowSolutions((value) => !value)} style={{ width: '100%', height: 34, border: `1px solid ${showSolutions ? '#DC262655' : 'var(--c-border)'}`, borderRadius: 9, background: showSolutions ? '#DC262611' : 'var(--c-surface-2)', color: showSolutions ? '#DC2626' : 'var(--c-text-2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 14 }}>{showSolutions ? 'Lösungen verstecken' : 'Lösungen einblenden'}</button>
        <div style={{ display: 'grid', gap: 6 }}>{(session?.phases || []).map((item, index) => <button key={item.id || index} onClick={() => selectPhase(index)} style={{ textAlign: 'left', border: `1px solid ${index === activeIndex ? accent : 'var(--c-border)'}`, background: index === activeIndex ? `${accent}12` : 'var(--c-surface-2)', borderRadius: 9, padding: '10px 12px', color: 'var(--c-text)', cursor: 'pointer' }}><strong>{index + 1}. {item.title}</strong><span style={{ display: 'block', fontSize: 11, color: 'var(--c-text-3)', marginTop: 3 }}>{Math.round(item.duration_seconds / 60)} Minuten</span></button>)}</div>
        <button onClick={async () => { const title = window.prompt('Titel der neuen Phase', 'Neue Phase'); if (!title || !session) return; const next = await createLessonPhase(session.id, { title, duration_seconds: 300, position: session.phases.length }).catch(() => null); if (next) setSession({ ...session, phases: [...session.phases, next] }); }} style={{ width: '100%', marginTop: 10, height: 32, border: '1px dashed var(--c-border)', borderRadius: 8, background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer' }}>+ Phase hinzufügen</button>
        <button onClick={() => { setPlanningDraft(makePlanningDraft(folder)); setPlanning(true); }} style={{ width: '100%', marginTop: 8, height: 34, border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface-2)', color: 'var(--c-text-2)', cursor: 'pointer' }}>Neue Stunde planen</button>
      </aside>
      <main className={`lm-teaching-main${mobilePhaseFocus ? ' is-focus' : ''}`} onTouchStart={handlePhaseTouchStart} onTouchEnd={handlePhaseTouchEnd} style={{ minWidth: 0, overflow: 'auto', padding: 'clamp(22px, 5vw, 64px)', background: 'var(--c-surface-2)' }}>
        {phase ? <><button className="lm-teaching-phase-back" onClick={() => setMobilePhaseFocus(false)} aria-label="Zu den Phasen zurückkehren">← Phasen</button><div style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Phase {activeIndex + 1} von {session.phases.length}</div><h1 style={{ margin: '8px 0', fontSize: 'clamp(28px, 5vw, 52px)', letterSpacing: -1 }}>{phase.title}</h1><div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 8, marginTop: 18 }}><label style={{ fontSize: 11, color: 'var(--c-text-2)' }}>Stunden<input aria-label="Timer Stunden" type="number" min="0" value={durationDraft.hours} onChange={(event) => setDurationDraft({ ...durationDraft, hours: event.target.value })} style={{ display: 'block', width: 72, marginTop: 4, padding: '7px 8px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-surface)', color: 'var(--c-text)' }} /></label><label style={{ fontSize: 11, color: 'var(--c-text-2)' }}>Minuten<input aria-label="Timer Minuten" type="number" min="0" max="59" value={durationDraft.minutes} onChange={(event) => setDurationDraft({ ...durationDraft, minutes: event.target.value })} style={{ display: 'block', width: 72, marginTop: 4, padding: '7px 8px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-surface)', color: 'var(--c-text)' }} /></label><label style={{ fontSize: 11, color: 'var(--c-text-2)' }}>Sekunden<input aria-label="Timer Sekunden" type="number" min="0" max="59" value={durationDraft.seconds} onChange={(event) => setDurationDraft({ ...durationDraft, seconds: event.target.value })} style={{ display: 'block', width: 72, marginTop: 4, padding: '7px 8px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-surface)', color: 'var(--c-text)' }} /></label><button onClick={applyDuration} style={{ height: 34, padding: '0 12px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>Zeit übernehmen</button></div><div style={{ fontSize: 'clamp(64px, 12vw, 150px)', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: remaining <= 120 ? '#DC2626' : accent, lineHeight: 1, margin: '26px 0' }}>{formatTime(remaining)}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}><button onClick={() => { if (running) { setRunning(false); setStartedAt(null); updateLessonPhase(phase.id, { timer_state: 'paused', timer_remaining_seconds: remaining }).catch(() => {}); } else { const start = Date.now() - Math.max(0, phase.duration_seconds - remaining) * 1000; setStartedAt(start); setRunning(true); } }} style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 8, background: accent, color: '#fff', fontWeight: 700 }}>{running ? 'Pause' : 'Starten'}</button><button onClick={() => { setRemaining(phase.duration_seconds); setRunning(false); setStartedAt(null); updateLessonPhase(phase.id, { timer_state: 'idle', timer_remaining_seconds: phase.duration_seconds }).catch(() => {}); }} style={{ height: 40, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>Zurücksetzen</button><button onClick={() => setTimerFullscreen(true)} style={{ height: 40, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>Timer fullscreen</button><button onClick={() => selectPhase(Math.min(session.phases.length - 1, activeIndex + 1))} style={{ height: 40, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>Weiter →</button></div><section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 18, maxWidth: 800 }}><h3 style={{ marginTop: 0 }}>Arbeitsauftrag</h3><p style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{phase.student_instruction || phase.description || 'Noch keinen Arbeitsauftrag hinterlegt.'}</p></section><section style={{ marginTop: 18, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 18, width: '100%', boxSizing: 'border-box' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}><div><h3 style={{ margin: 0 }}>Schülerantworten</h3><p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--c-text-3)' }}>Gemeinsames Antwortprotokoll dieser Phase · nur für dich sichtbar</p></div></div><div style={{ height: 'min(560px, 60vh)', minHeight: 360, border: '1px solid var(--c-border)', borderRadius: 9, overflow: 'hidden' }}><RichTextEditor key={phase.id} value={phase.student_responses || ''} contentKey={`phase-${phase.id}`} accent={accent} placeholder="Antworten der Schülerinnen und Schüler festhalten …" documentTitle={`${folder.name} · ${phase.title}`} onChange={(content) => setSession((current) => ({ ...current, phases: current.phases.map((item) => item.id === phase.id ? { ...item, student_responses: content } : item) }))} onSave={(content) => updateLessonPhase(phase.id, { student_responses: content })} /></div></section><TeachingCanvas sessionId={session.id} phase={phase} files={visibleFiles} accent={accent} /><section style={{ marginTop: 18, maxWidth: 800 }}><h3>Material gezielt anzeigen</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{visibleFiles.map((file) => <button key={file.id} onClick={() => setSelectedFile(file)} style={{ border: `1px solid ${selectedFile?.id === file.id ? accent : 'var(--c-border)'}`, borderRadius: 8, padding: '8px 10px', background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>{file.original_name}</button>)}</div>{links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', margin: '10px 12px 0 0', color: accent }}>{link.title}</a>)}</section></> : <div>Stunde wird vorbereitet …</div>}
      </main>
      {timerFullscreen && phase && <div role="dialog" aria-label="Timer Vollbild" style={{ position: 'fixed', inset: 0, zIndex: 2050, background: '#080b12', color: '#fff', display: 'grid', placeItems: 'center', padding: 24 }}><button aria-label="Timer-Vollbild schließen" onClick={() => setTimerFullscreen(false)} style={{ position: 'absolute', top: 20, right: 20, height: 38, padding: '0 14px', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, background: 'transparent', color: '#fff', cursor: 'pointer' }}>Esc · Zurück</button><div style={{ textAlign: 'center' }}><div style={{ color: accent, fontSize: 16, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>Lehrerhilfe · {phase.title}</div><div style={{ fontSize: 'clamp(100px, 24vw, 320px)', fontVariantNumeric: 'tabular-nums', fontWeight: 800, lineHeight: 1, marginTop: 22, color: remaining <= 120 ? '#F87171' : '#fff' }}>{formatTime(remaining)}</div><div style={{ color: 'rgba(255,255,255,.55)', marginTop: 24 }}>Esc drücken, um zur normalen Ansicht zurückzukehren</div></div></div>}
      {selectedFile && <div style={{ position: 'fixed', inset: 0, zIndex: 2010, background: '#000b', display: 'grid', placeItems: 'center', padding: 24 }} onClick={() => setSelectedFile(null)}><div onClick={(event) => event.stopPropagation()} style={{ width: 'min(92vw, 1000px)', height: 'min(86vh, 760px)', background: '#111', borderRadius: 12, overflow: 'hidden' }}><FilePreview file={selectedFile} accent={accent} /></div></div>}
    </div>
  );
}

function LessonPlanner({ folder, accent, draft, setDraft, saving, error, onSave, onCancel }) {
  const [templates, setTemplates] = useState(() => { try { return JSON.parse(localStorage.getItem('lm_lesson_templates') || '[]'); } catch { return []; } });
  const saveTemplate = () => {
    const name = window.prompt('Name der Vorlage', draft.title || 'Unterrichtsvorlage');
    if (!name?.trim()) return;
    const next = [...templates.filter((item) => item.name !== name.trim()), { name: name.trim(), phases: draft.phases.map(({ title, minutes, student_instruction }) => ({ title, minutes, student_instruction })) }];
    setTemplates(next); localStorage.setItem('lm_lesson_templates', JSON.stringify(next));
  };
  const loadTemplate = (event) => {
    const template = templates.find((item) => item.name === event.target.value);
    if (template) setDraft((current) => ({ ...current, phases: template.phases.map((phase) => ({ ...phase })) }));
  };
  const updatePhase = (index, key, value) => setDraft((current) => ({
    ...current,
    phases: current.phases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, [key]: value } : phase),
  }));
  const addPhase = () => setDraft((current) => ({
    ...current,
    phases: [...current.phases, { title: `Phase ${current.phases.length + 1}`, minutes: 5, student_instruction: '' }],
  }));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, overflow: 'auto', background: 'var(--c-surface-2)', color: 'var(--c-text)', padding: 'clamp(22px, 5vw, 64px)' }}>
      <div style={{ width: 'min(100%, 980px)', margin: '0 auto' }}>
        <div style={{ color: accent, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Lehrerhilfe · Neue Stunde</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
          <div><h1 style={{ margin: '6px 0 8px' }}>Stunde planen</h1><p style={{ marginTop: 0, color: 'var(--c-text-2)' }}>Lege die Stunde und ihre Phasen fest. Danach kannst du die Schülerantworten direkt im Unterricht protokollieren.</p></div>
          <button aria-label="Planung schließen" onClick={onCancel} style={{ width: 34, height: 34, border: '1px solid var(--c-border)', borderRadius: 8, background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}><select aria-label="Unterrichtsvorlage laden" defaultValue="" onChange={loadTemplate} style={{ ...inputStyle, width: 'auto', minWidth: 220, margin: 0 }}><option value="">Vorlage laden …</option>{templates.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><button type="button" onClick={saveTemplate} style={{ height: 38, padding: '0 12px', border: `1px solid ${accent}66`, borderRadius: 8, background: `${accent}0d`, color: accent, fontWeight: 700, cursor: 'pointer' }}>Als Vorlage speichern</button></div>
        <section style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 18, marginTop: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(2, minmax(150px, 1fr))', gap: 12 }}>
            <label style={labelStyle}>Titel der Stunde<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Datum<input type="date" value={draft.lesson_date} onChange={(event) => setDraft({ ...draft, lesson_date: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Klasse<input value={draft.class_name} onChange={(event) => setDraft({ ...draft, class_name: event.target.value })} style={inputStyle} /></label>
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>Lernziel<textarea value={draft.learning_goal} onChange={(event) => setDraft({ ...draft, learning_goal: event.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder={`Lernziel für ${folder.name} …`} /></label>
        </section>
        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {draft.phases.map((phase, index) => <section key={`${index}-${phase.title}`} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><strong style={{ color: accent }}>{index + 1}</strong><input aria-label={`Name Phase ${index + 1}`} value={phase.title} onChange={(event) => updatePhase(index, 'title', event.target.value)} style={{ ...inputStyle, flex: 1, margin: 0, fontWeight: 700 }} /><label style={{ ...labelStyle, width: 120, margin: 0 }}>Minuten<input type="number" min="1" value={phase.minutes} onChange={(event) => updatePhase(index, 'minutes', event.target.value)} style={inputStyle} /></label></div>
            <label style={labelStyle}>Arbeitsauftrag<textarea value={phase.student_instruction} onChange={(event) => updatePhase(index, 'student_instruction', event.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Was sollen die Schüler in dieser Phase tun?" /></label>
          </section>)}
        </div>
        <button onClick={addPhase} style={{ width: '100%', marginTop: 12, height: 40, border: `1px dashed ${accent}88`, borderRadius: 9, background: `${accent}0b`, color: accent, fontWeight: 700, cursor: 'pointer' }}>＋ Phase hinzufügen</button>
        {error && <div role="alert" style={{ marginTop: 16, padding: '10px 12px', border: '1px solid #DC262655', borderRadius: 8, background: '#DC262611', color: '#DC2626', fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button onClick={onCancel} style={{ height: 40, padding: '0 16px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text-2)', cursor: 'pointer' }}>Abbrechen</button><button onClick={onSave} disabled={saving} style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 8, background: accent, color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Stunde wird gespeichert …' : 'Stunde bestätigen und speichern'}</button></div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, color: 'var(--c-text-2)' };
const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '9px 10px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit' };
