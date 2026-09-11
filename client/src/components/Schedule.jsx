import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useIsMobile } from '../hooks/useIsMobile';
import api from '../lib/api';
import { BREAKS, SCHEDULE_META_KEY, getScheduleSettings, withScheduleSettings } from '../lib/schedule';

const STORAGE_KEY = 'lm_schedule';
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
const PERIODS = 6;

const STUNDENPLAN_SUBJECTS = [
  { id: 'unterricht', label: 'Unterricht', color: '#2563EB' },
  { id: 'besprechung', label: 'Besprechung', color: '#7C3AED' },
  { id: 'vertretung', label: 'Vertretung', color: '#F59E0B' },
  { id: 'pausenaufsicht', label: 'Pausenaufsicht', color: '#64748B' },
  { id: 'mittagspause', label: 'Mittagspause', color: '#D97706' },
  { id: 'fortbildung', label: 'Fortbildung', color: '#0F766E' },
  { id: 'frei', label: 'Frei', color: '#94A3B8' },
];

const LEGACY_SUBJECT_IDS = new Set(['klassenstunde', 'elsa', 'inf6', 'inf7', 'es9', 'esq1', 'sportq1', 'sport5d']);
const LEGACY_FOLDER_SUBJECTS = new Set(['klasse', 'informatik', 'spanisch', 'sport']);


function storageKey() {
  try {
    const token = localStorage.getItem('lm_token');
    const payload = token ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) : {};
    return `${STORAGE_KEY}:${payload.user_id ?? payload.id ?? payload.sub ?? 'default'}`;
  } catch { return `${STORAGE_KEY}:default`; }
}
function loadCache() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); } catch { return {}; }
}
function writeCache(s) {
  localStorage.setItem(storageKey(), JSON.stringify(s));
}

function hydrateSchedule(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    if (LEGACY_SUBJECT_IDS.has(value.id) || LEGACY_FOLDER_SUBJECTS.has(value.subjectId)) continue;
    if (key === SCHEDULE_META_KEY) {
      next[key] = value;
      continue;
    }
    if (key.startsWith('break-')) {
      next[key] = value;
      continue;
    }
    const legacyId = value.id || value.subject || value.subjectId;
    const preset = STUNDENPLAN_SUBJECTS.find((s) => s.id === legacyId);
    if (preset) {
      next[key] = {
        id: preset.id,
        label: value.label || preset.label,
        color: value.color || preset.color,
        ...(preset.subjectId ? { subjectId: value.subjectId || preset.subjectId } : {}),
        ...(value.location || value.room ? { location: value.location || value.room } : {}),
        ...(value.folderId ? { folderId: value.folderId } : {}),
      };
      continue;
    }
    if (value.label && value.color) next[key] = value;
  }
  return next;
}

export default function Schedule({ onNavigate, folders = [], onClose }) {
  const { t, lang } = useLang();
  const [schedule, setSchedule] = useState(() => hydrateSchedule(loadCache()));
  const [picker, setPicker] = useState(null); // { day, period, rect }
  const [supervisionPicker, setSupervisionPicker] = useState(null); // { breakKey, day, rect }
  const [editAnnouncement, setEditAnnouncement] = useState('');
  const [dragOverKey, setDragOverKey] = useState(null);
  const isMobile = useIsMobile(860);

  useEscapeKey(isMobile && !!onClose, onClose);

  useEffect(() => {
    api.get('/schedule').then((res) => {
      const data = hydrateSchedule(res.data || {});
      setSchedule(data);
      writeCache(data);
    }).catch(() => {});
  }, []);

  const DAYS = lang === 'es' ? DAYS_ES : DAYS_DE;
  const fileDate = new Date().toISOString().slice(0, 10);

  const persist = useCallback((next) => {
    setSchedule(next);
    writeCache(next);
    api.put('/schedule', next).catch(() => {});
  }, []);

  const saveCell = useCallback(({ label, location, folderId }) => {
    if (!picker) return;
    const key = `${picker.day}-${picker.period}`;
    const current = schedule[key];
    if (!label.trim()) return;
    const nextCell = {
      ...(current || { id: `custom-${Date.now()}`, color: '#2563EB' }),
      label: label.trim(),
      location: location.trim(),
    };
    if (folderId) nextCell.folderId = folderId;
    else delete nextCell.folderId;
    persist({ ...schedule, [key]: nextCell });
    setPicker(null);
  }, [picker, schedule, persist]);

  const unlink = useCallback((day, period) => {
    const key = `${day}-${period}`;
    const next = { ...schedule };
    delete next[key];
    persist(next);
  }, [schedule, persist]);

  const saveSupervision = useCallback(({ label, location }) => {
    if (!supervisionPicker) return;
    const { breakKey, day } = supervisionPicker;
    const current = schedule[breakKey] || {};
    const existing = current[day];
    const next = { ...schedule };
    const name = label.trim();

    if (!name) {
      const updated = { ...current };
      delete updated[day];
      if (Object.keys(updated).length === 0) delete next[breakKey];
      else next[breakKey] = updated;
    } else {
      next[breakKey] = {
        ...current,
        [day]: {
          ...(existing && typeof existing === 'object' ? existing : {}),
          label: name,
          location: location.trim(),
        },
      };
    }
    persist(next);
    setSupervisionPicker(null);
  }, [supervisionPicker, schedule, persist]);

  const clearSupervision = useCallback(() => {
    if (!supervisionPicker) return;
    saveSupervision({ label: '', location: '' });
  }, [supervisionPicker, saveSupervision]);

  const openPicker = useCallback((day, period, el) => {
    const rect = el.getBoundingClientRect();
    setPicker({ day, period, rect });
  }, []);

  const onDropToCell = useCallback((day, period, payload) => {
    if (!payload) return;
    const toKey = `${day}-${period}`;
    if (payload.type === 'subject') {
      const subject = STUNDENPLAN_SUBJECTS.find((s) => s.id === payload.subjectId);
      if (!subject) return;
      const cell = { id: subject.id, label: subject.label, color: subject.color };
      if (subject.subjectId) cell.subjectId = subject.subjectId;
      persist({ ...schedule, [toKey]: cell });
      return;
    }
    if (payload.type === 'cell') {
      const fromKey = `${payload.day}-${payload.period}`;
      if (fromKey === toKey || !payload.cell) return;
      const next = { ...schedule, [toKey]: payload.cell };
      delete next[fromKey];
      persist(next);
    }
  }, [persist, schedule]);

  const exportIcs = useCallback(() => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LehrerMaps//Schedule Export//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    const today = new Date();
    const nextMonday = new Date(today);
    const day = nextMonday.getDay();
    const delta = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
    nextMonday.setDate(nextMonday.getDate() + delta);
    nextMonday.setHours(0, 0, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    const stamp = fmt(new Date());

    Object.entries(schedule).forEach(([key, cell], idx) => {
      if (!cell?.label) return;
      const [d, p] = key.split('-').map(Number);
      const start = new Date(nextMonday);
      start.setDate(nextMonday.getDate() + d);
      start.setHours(8 + p, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      lines.push(
        'BEGIN:VEVENT',
        `UID:lehrermaps-${d}-${p}-${idx}@local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${cell.label.replace(/,/g, '\\,')}`,
        ...(cell.location ? [`LOCATION:${cell.location.replace(/[,;\\]/g, '\\$&')}`] : []),
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lehrermaps-stundenplan-${fileDate}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [schedule, fileDate]);

  return (
    <div className="lm-schedule-view" style={{ padding: '28px 32px', height: '100%', overflow: 'auto' }}>
      <div className="lm-schedule-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--c-text-3)' }}>
          <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 8h16M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--c-text)', letterSpacing: -0.4 }}>
          {t('schedule.title')}
        </h2>
        {isMobile && onClose && (
          <button
            className="lm-schedule-close"
            type="button"
            onClick={onClose}
            aria-label="Stundenplan schließen"
            title="Stundenplan schließen"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
        <button
          onClick={exportIcs}
          style={{
            marginLeft: 'auto',
            height: 30,
            padding: '0 12px',
            border: '1px solid var(--c-border)',
            borderRadius: 7,
            background: 'transparent',
            color: 'var(--c-text-2)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('schedule.export_ics')}
        </button>
      </div>

      <ScheduleTimeSettings schedule={schedule} onSave={(periods, breaks) => persist(withScheduleSettings(schedule, periods, breaks))} />

      <div className="lm-schedule-grid-wrap">
      <div className="lm-schedule-grid" style={{
        display: 'grid',
        gridTemplateColumns: `44px repeat(5, 1fr)`,
        gap: 4,
      }}>
        {/* Header row */}
        <div />
        {DAYS.map((d) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text-3)',
            padding: '6px 0',
          }}>{d}</div>
        ))}

        {/* Period rows */}
        {Array.from({ length: PERIODS }, (_, p) => (
          [
            p === 2 && <BreakRow key="break-fruehstueck" breakKey="break-fruehstueck" label="Pause" value={schedule['break-fruehstueck'] || {}} onEditDay={(day, element) => setSupervisionPicker({ breakKey: 'break-fruehstueck', day, rect: element.getBoundingClientRect() })} />,
            p === 4 && <BreakRow key="break-mittag" breakKey="break-mittag" label="Pause" value={schedule['break-mittag'] || {}} onEditDay={(day, element) => setSupervisionPicker({ breakKey: 'break-mittag', day, rect: element.getBoundingClientRect() })} />,
            <div key={`label-${p}`} style={{
              fontSize: 10, color: 'var(--c-text-3)', textAlign: 'right',
              paddingRight: 8, paddingTop: 10, fontFamily: '"DM Mono", monospace',
            }}>
              {t('schedule.period')}{p + 1}
            </div>,
            ...Array.from({ length: 5 }, (_, d) => {
              const key = `${d}-${p}`;
              const cell = schedule[key];
              return (
          <ScheduleCell
                  key={key}
                  day={d}
                  period={p}
                  cell={cell}
                  onEdit={(el) => openPicker(d, p, el)}
                  onEditStateChange={setEditAnnouncement}
                  onUnlink={() => unlink(d, p)}
                  onNavigate={onNavigate}
                  folders={folders}
                  dragOver={dragOverKey === key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const payload = readDndPayload(e.dataTransfer);
                    e.dataTransfer.dropEffect = payload?.type === 'subject' ? 'copy' : 'move';
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => {
                    if (dragOverKey === key) setDragOverKey(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const payload = readDndPayload(e.dataTransfer);
                    setDragOverKey(null);
                    onDropToCell(d, p, payload);
                  }}
                />
              );
            }),
          ]
        ))}
      </div>
      </div>
      <div className="lm-visually-hidden" aria-live="polite" aria-atomic="true">{editAnnouncement}</div>

      {picker && (
        <SubjectPicker
          rect={picker.rect}
          cell={schedule[`${picker.day}-${picker.period}`]}
          folders={folders}
          onSaveCell={saveCell}
          onClear={() => unlink(picker.day, picker.period)}
          onClose={() => setPicker(null)}
        />
      )}
      {supervisionPicker && (
        <SupervisionPicker
          rect={supervisionPicker.rect}
          entry={schedule[supervisionPicker.breakKey]?.[supervisionPicker.day]}
          onSave={saveSupervision}
          onClear={clearSupervision}
          onClose={() => setSupervisionPicker(null)}
        />
      )}
    </div>
  );
}

function ScheduleTimeSettings({ schedule, onSave }) {
  const settings = getScheduleSettings(schedule);
  const schedulePeriods = settings.periods;
  const scheduleBreaks = settings.breaks;
  const emptyPeriods = () => Array.from({ length: PERIODS }, () => ({ start: '', end: '' }));
  const emptyBreaks = () => BREAKS.map((breakInfo) => ({ ...breakInfo, start: '', end: '' }));
  const [open, setOpen] = useState(false);
  const [periods, setPeriods] = useState(() => schedulePeriods.length ? schedulePeriods : emptyPeriods());
  const [breaks, setBreaks] = useState(() => scheduleBreaks.length ? scheduleBreaks : emptyBreaks());
  const [invalid, setInvalid] = useState(false);
  const configured = settings.configured;
  const openEditor = () => {
    if (!open) {
      // Take a fresh snapshot only when opening. A server response can arrive
      // after mount, while an open form must never overwrite active typing.
      setPeriods(schedulePeriods.length ? schedulePeriods : emptyPeriods());
      setBreaks(scheduleBreaks.length ? scheduleBreaks : emptyBreaks());
      setInvalid(false);
    }
    setOpen(!open);
  };
  const save = (event) => {
    event.preventDefault();
    if (!getScheduleSettings(withScheduleSettings(schedule, periods, breaks)).configured) {
      setInvalid(true);
      return;
    }
    onSave(periods, breaks);
    setOpen(false);
  };
  return (
    <section className="lm-schedule-times" aria-label="Stundenzeiten">
      <div><strong>Stunden- und Pausenzeiten</strong><span>{configured ? 'Für das Heute-Cockpit eingerichtet' : 'Bitte Zeiten einrichten, damit Heute reale Unterrichts- und Pausenzeiten zeigen kann.'}</span></div>
      <button type="button" className="lm-schedule-times-toggle" onClick={openEditor} aria-expanded={open}>{open ? 'Schließen' : configured ? 'Zeiten bearbeiten' : 'Zeiten einrichten'}</button>
      {open && <form className="lm-schedule-times-form" onSubmit={save}>
        {periods.flatMap((period, index) => {
          const fields = [<label key={`period-${index}`}>Block {index + 1}<span><input aria-label={`Block ${index + 1} Beginn`} type="time" value={period.start} onChange={(e) => { setInvalid(false); setPeriods(periods.map((item, i) => i === index ? { ...item, start: e.target.value } : item)); }} required /><input aria-label={`Block ${index + 1} Ende`} type="time" value={period.end} onChange={(e) => { setInvalid(false); setPeriods(periods.map((item, i) => i === index ? { ...item, end: e.target.value } : item)); }} required /></span></label>];
          const breakIndex = index === 1 ? 0 : index === 3 ? 1 : null;
          if (breakIndex !== null) { const breakInfo = breaks[breakIndex]; fields.push(<label key={`break-${breakInfo.key}`}>{breakInfo.label}<span><input aria-label={`${breakInfo.label} Beginn`} type="time" value={breakInfo.start} onChange={(e) => { setInvalid(false); setBreaks(breaks.map((item, i) => i === breakIndex ? { ...item, start: e.target.value } : item)); }} required /><input aria-label={`${breakInfo.label} Ende`} type="time" value={breakInfo.end} onChange={(e) => { setInvalid(false); setBreaks(breaks.map((item, i) => i === breakIndex ? { ...item, end: e.target.value } : item)); }} required /></span></label>); }
          return fields;
        })}
        {invalid && <p className="lm-schedule-times-error" role="alert">Jeder Block und jede Pause braucht eine gültige Zeit und muss nach dem vorherigen Eintrag beginnen.</p>}
        <button type="submit" className="lm-button lm-button-primary">Zeiten speichern</button>
      </form>}
    </section>
  );
}

function ScheduleCell({
  day, period, cell, onEdit, onUnlink, onNavigate,
  folders, onEditStateChange,
  dragOver, onDragOver, onDragLeave, onDrop,
}) {
  const { t } = useLang();
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  const mainButtonRef = useRef(null);
  const firstEditControlRef = useRef(null);
  const navigationTimer = useRef(null);
  const longPressTimer = useRef(null);
  const suppressClick = useRef(false);
  const focusAfterModeChange = useRef(null);
  const navigationTarget = getScheduleNavigationTarget(cell, folders);
  const canNav = navigationTarget && onNavigate;

  useEffect(() => () => {
    window.clearTimeout(navigationTimer.current);
    window.clearTimeout(longPressTimer.current);
  }, []);
  useEffect(() => {
    if (editing && focusAfterModeChange.current === 'edit') firstEditControlRef.current?.focus();
    if (!editing && focusAfterModeChange.current === 'view') mainButtonRef.current?.focus();
    focusAfterModeChange.current = null;
  }, [editing]);

  const beginEditing = () => {
    window.clearTimeout(navigationTimer.current);
    navigationTimer.current = null;
    focusAfterModeChange.current = 'edit';
    setEditing(true);
    onEditStateChange?.(`Bearbeiten geöffnet für ${cell.label}.`);
  };
  const endEditing = () => {
    window.clearTimeout(navigationTimer.current);
    navigationTimer.current = null;
    focusAfterModeChange.current = 'view';
    setEditing(false);
    onEditStateChange?.(`Bearbeiten beendet für ${cell.label}.`);
  };
  const handleClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!cell) { onEdit(ref.current); return; }
    if (canNav) {
      window.clearTimeout(navigationTimer.current);
      navigationTimer.current = window.setTimeout(() => onNavigate(navigationTarget), 260);
    }
  };
  const handleKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && cell) {
      event.preventDefault();
      beginEditing();
    }
  };
  const startLongPress = (event) => {
    if (!cell || event.pointerType !== 'touch') return;
    longPressTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      beginEditing();
    }, 550);
  };
  const stopLongPress = () => window.clearTimeout(longPressTimer.current);

  const cellContent = cell ? (
    <div style={{ minHeight: 56, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, maxWidth: '100%' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: cell.color, flexShrink: 0 }} />
        <div className="lm-schedule-cell-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.label}</div>
      </div>
      {cell.location && <div className="lm-schedule-cell-location">📍 {cell.location}</div>}
      {canNav && hovered && !editing && <div className="lm-schedule-cell-navigation-hint">→ {t('schedule.navigate')}</div>}
    </div>
  ) : <div className="lm-schedule-cell-add" aria-hidden="true">+</div>;

  return (
    <div
      className={`lm-schedule-cell${editing ? ' is-editing' : ''}`}
      ref={ref}
      draggable={!!cell && !editing}
      onDragStart={(e) => {
        if (!cell) return;
        const payload = JSON.stringify({
          type: 'cell',
          day,
          period,
          cell,
        });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-lehrermaps-schedule', payload);
        e.dataTransfer.setData('text/plain', payload);
      }}
      onDragEnd={() => onDragLeave?.()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDoubleClick={(event) => { if (cell) { event.preventDefault(); event.stopPropagation(); beginEditing(); } }}
      onPointerDown={startLongPress}
      onPointerUp={stopLongPress}
      onPointerCancel={stopLongPress}
      onPointerLeave={stopLongPress}
      style={{
        minHeight: 56, borderRadius: 8,
        border: dragOver
          ? `1.5px dashed ${cell ? cell.color : '#0EA5E9'}`
          : `1px solid ${cell ? cell.color + '44' : 'var(--c-border)'}`,
        background: dragOver
          ? (cell ? `${cell.color}20` : 'rgba(14,165,233,0.08)')
          : (cell ? `${cell.color}12` : 'var(--c-surface)'),
        cursor: cell && !editing ? 'grab' : 'pointer', position: 'relative',
        transition: 'background .1s, border-color .1s',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!editing ? <button ref={mainButtonRef} type="button" className="lm-schedule-cell-main" onClick={handleClick} onKeyDown={handleKeyDown} aria-label={cell ? `${cell.label}${canNav ? ` – einmal klicken für ${t('schedule.navigate')}` : ''}. Doppelklicken, lange drücken oder Eingabetaste zum Bearbeiten.` : 'Stundenplanfeld bearbeiten'} title={cell ? 'Doppelklicken, lange drücken oder Eingabetaste zum Bearbeiten' : 'Stundenplanfeld bearbeiten'}>{cellContent}</button> : cellContent}
      {cell && editing && (
        <div className="lm-schedule-cell-edit-actions">
          <button
              ref={firstEditControlRef} type="button" onClick={(e) => { e.stopPropagation(); onEdit(ref.current); }}
              title={t('schedule.pick_folder')}
              aria-label={t('schedule.pick_folder')}
              className="lm-schedule-cell-edit-button"
            >✎</button>
          <button
            type="button" onClick={(e) => { e.stopPropagation(); onUnlink(); setEditing(false); onEditStateChange?.(`Feld ${cell.label} geleert.`); }}
            title={t('schedule.unlink')}
            aria-label={t('schedule.unlink')}
            className="lm-schedule-cell-edit-button"
          >×</button>
          <button type="button" onClick={endEditing} className="lm-schedule-cell-edit-button" aria-label="Bearbeiten beenden" title="Bearbeiten beenden">✓</button>
        </div>
      )}
    </div>
  );
}

// Timetable entries are free-form text, so navigation is intentionally based
// on the normalized class/subject + room combination rather than a fragile
// preset id. This also covers entries imported from older schedules.
const SCHEDULE_FOLDER_ROUTES = [];

function normalizeScheduleText(value) {
  return String(value || '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getScheduleNavigationTarget(cell, folders) {
  if (!cell || LEGACY_FOLDER_SUBJECTS.has(cell.subjectId)) return null;
  if (cell.folderId) {
    const folder = folders.find((candidate) => String(candidate.id) === String(cell.folderId));
    if (folder) return { subjectId: folder.subject, folderId: folder.id };
  }
  const text = normalizeScheduleText(`${cell.label || ''} ${cell.location || ''}`);
  const route = SCHEDULE_FOLDER_ROUTES.find(({ match }) => match.test(text));
  if (route) {
    const folder = folders.find((candidate) => candidate.subject === route.subjectId
      && normalizeScheduleText(candidate.name) === normalizeScheduleText(route.folderName));
    return { subjectId: route.subjectId, folderId: folder?.id || null, folderName: route.folderName };
  }
  return cell.subjectId ? { subjectId: cell.subjectId, folderId: null } : null;
}

function readDndPayload(dataTransfer) {
  try {
    const raw = dataTransfer.getData('application/x-lehrermaps-schedule')
      || dataTransfer.getData('text/plain');
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

const AUFSICHT_COLOR = '#64748B';

function BreakRow({ breakKey, label, value, onEditDay }) {
  return [
    <div key={`${breakKey}-label`} style={{
      display: 'flex', alignItems: 'center',
      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      textTransform: 'uppercase', color: 'var(--c-text-3)',
      justifyContent: 'flex-end', paddingRight: 6,
      minHeight: 76,
    }}>{label}</div>,
    ...[0, 1, 2, 3, 4].map((d) => (
      <BreakDayCell key={`${breakKey}-${d}`} entry={value[d]} onEdit={(element) => onEditDay(d, element)} />
    )),
  ];
}

function BreakDayCell({ entry, onEdit }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const longPressTimer = useRef(null);
  const suppressClick = useRef(false);
  // Older schedules persisted a boolean. Treat it as the original default name
  // until the user edits it, then persist the richer object shape.
  const details = entry && typeof entry === 'object' ? entry : {};
  const active = !!entry;
  const label = details.label || 'Aufsicht';
  const location = details.location || details.room || '';
  useEffect(() => () => window.clearTimeout(longPressTimer.current), []);
  const beginEditing = () => onEdit(ref.current);
  const startLongPress = (event) => {
    if (!active || event.pointerType !== 'touch') return;
    longPressTimer.current = window.setTimeout(() => { suppressClick.current = true; beginEditing(); }, 550);
  };
  const stopLongPress = () => window.clearTimeout(longPressTimer.current);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (!active) beginEditing(); }}
      onDoubleClick={(event) => { if (active) { event.preventDefault(); beginEditing(); } }}
      onKeyDown={(event) => { if (active && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); beginEditing(); } }}
      onPointerDown={startLongPress}
      onPointerUp={stopLongPress}
      onPointerCancel={stopLongPress}
      onPointerLeave={stopLongPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={active ? `${label}. Doppelklicken, lange drücken oder Eingabetaste zum Bearbeiten.` : 'Aufsicht hinzufügen'}
      title={active ? 'Doppelklicken, lange drücken oder Eingabetaste zum Bearbeiten' : 'Aufsicht hinzufügen'}
      style={{
        minHeight: 76, borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${active ? AUFSICHT_COLOR + '66' : hovered ? AUFSICHT_COLOR + '33' : 'var(--c-border)'}`,
        background: active ? `${AUFSICHT_COLOR}18` : hovered ? `${AUFSICHT_COLOR}0C` : 'var(--c-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .1s, border-color .1s',
      }}
    >
      {active ? (
        <span className="lm-schedule-break-details">
          <span className="lm-schedule-break-label">{label}</span>
          {location && <span className="lm-schedule-break-location">📍 {location}</span>}
        </span>
      ) : hovered ? (
        <span style={{ fontSize: 14, color: AUFSICHT_COLOR, opacity: 0.5 }}>+</span>
      ) : null}
    </button>
  );
}

function SupervisionPicker({ rect, entry, onSave, onClear, onClose }) {
  useEscapeKey(true, onClose);
  const details = entry && typeof entry === 'object' ? entry : {};
  const [label, setLabel] = useState(details.label || (entry ? 'Aufsicht' : ''));
  const [location, setLocation] = useState(details.location || details.room || '');
  const PICKER_W = 220;
  const PICKER_MAX_H = Math.min(260, window.innerHeight - 80);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.left;
  let top = rect.bottom + 6;

  if (left + PICKER_W > vw - 8) left = vw - PICKER_W - 8;
  if (top + PICKER_MAX_H > vh - 8) top = rect.top - PICKER_MAX_H - 6;
  left = Math.max(8, left);

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
      <div style={{ position: 'fixed', left, top, width: PICKER_W, maxHeight: PICKER_MAX_H, overflowY: 'auto', zIndex: 1200, background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)', borderRadius: 12, boxShadow: 'var(--c-shadow-modal)', padding: 10, display: 'flex', flexDirection: 'column', gap: 7, animation: 'lmSlideUp .15s cubic-bezier(.4,.7,.3,1)', fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
        <form onSubmit={(event) => { event.preventDefault(); onSave({ label, location }); }} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
            Klasse oder Gruppe
            <input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="z. B. Klasse 6a" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, height: 34, padding: '0 9px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit', fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
            Raum oder Ort
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="z. B. S10 oder Schulhof" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, height: 34, padding: '0 9px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit', fontSize: 12 }} />
          </label>
          <button type="submit" style={{ width: '100%', padding: '8px 10px', border: 0, borderRadius: 8, background: 'var(--c-text)', color: 'var(--c-surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>Speichern</button>
        </form>
        {entry && <button type="button" onClick={onClear} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Aufsicht entfernen</button>}
      </div>
    </>,
    document.body,
  );
}

function SubjectPicker({ rect, cell, folders = [], onSaveCell, onClear, onClose }) {
  useEscapeKey(true, onClose);
  const [label, setLabel] = useState(cell?.label || '');
  const [location, setLocation] = useState(cell?.location || '');
  const [folderId, setFolderId] = useState(cell?.folderId ? String(cell.folderId) : '');
  const PICKER_W = 220;
  const PICKER_MAX_H = Math.min(360, window.innerHeight - 80);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left;
  let top = rect.bottom + 6;

  if (left + PICKER_W > vw - 8) left = vw - PICKER_W - 8;
  if (top + PICKER_MAX_H > vh - 8) top = rect.top - PICKER_MAX_H - 6;
  left = Math.max(8, left);

  return createPortal(
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1199 }}
      />
      {/* picker card */}
      <div
        style={{
          position: 'fixed',
          left,
          top,
          width: PICKER_W,
          maxHeight: PICKER_MAX_H,
          overflowY: 'auto',
          zIndex: 1200,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-soft)',
          borderRadius: 12,
          boxShadow: 'var(--c-shadow-modal)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          animation: 'lmSlideUp .15s cubic-bezier(.4,.7,.3,1)',
          fontFamily: '"DM Sans", -apple-system, sans-serif',
        }}
      >
        <form onSubmit={(event) => { event.preventDefault(); onSaveCell({ label, location, folderId: folderId || null }); }} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
              Klasse oder Gruppe
              <input
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="z. B. Unterricht 6"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, height: 34, padding: '0 9px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit', fontSize: 12 }}
              />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
              Raum oder Ort
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="z. B. S10, S9-2, J004"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, height: 34, padding: '0 9px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit', fontSize: 12 }}
              />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
              Materialordner
              <select value={folderId} onChange={(event) => setFolderId(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, height: 34, padding: '0 9px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit', fontSize: 12 }}>
                <option value="">Kein Ordner verknüpft</option>
                {folders.map((folder) => <option key={folder.id} value={String(folder.id)}>{folder.name}</option>)}
              </select>
            </label>
            <button type="submit" style={{ width: '100%', padding: '8px 10px', border: 0, borderRadius: 8, background: 'var(--c-text)', color: 'var(--c-surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>
              Speichern
            </button>
          </form>
        {cell && (
          <button
            onClick={() => { onClear(); onClose(); }}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid var(--c-border)',
              borderRadius: 8, background: 'transparent', color: 'var(--c-text-2)',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
            }}
          >
            Feld leeren
          </button>
        )}
      </div>
    </>,
    document.body
  );
}
