import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useIsMobile } from '../hooks/useIsMobile';
import api from '../lib/api';

const STORAGE_KEY = 'lm_schedule';
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
const PERIODS = 6;

const STUNDENPLAN_SUBJECTS = [
  { id: 'klassenstunde', label: 'Klassenstunde', color: '#9333EA', subjectId: 'klasse' },
  { id: 'elsa',          label: 'ELSA',          color: '#0891B2', subjectId: 'klasse' },
  { id: 'inf6',          label: 'Informatik 6',  color: '#2563EB', subjectId: 'informatik' },
  { id: 'inf7',          label: 'Informatik 7',  color: '#1E40AF', subjectId: 'informatik' },
  { id: 'es9',           label: 'Spanisch 9',    color: '#E8472A', subjectId: 'spanisch' },
  { id: 'esq1',          label: 'Spanisch Q1',   color: '#B83220', subjectId: 'spanisch' },
  { id: 'sportq1',       label: 'Sport Q1',      color: '#16A34A', subjectId: 'sport' },
  { id: 'sport5d',       label: 'Sport 5d',      color: '#15803D', subjectId: 'sport' },
  { id: 'vertretung',    label: 'Vertretung',    color: '#F59E0B' },
  { id: 'pausenaufsicht',label: 'Pausenaufsicht',color: '#64748B' },
  { id: 'mittagspause',  label: 'Mittagspause',  color: '#D97706' },
  { id: 'zertifikatskurs', label: 'Zertifikatskurs', color: '#7C3AED' },
  { id: 'frei',            label: 'Frei',             color: '#94A3B8' },
];

function loadCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function hydrateSchedule(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
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

  const saveCell = useCallback(({ label, location }) => {
    if (!picker) return;
    const key = `${picker.day}-${picker.period}`;
    const current = schedule[key];
    if (!label.trim()) return;
    persist({ ...schedule, [key]: {
      ...(current || { id: `custom-${Date.now()}`, color: '#2563EB' }),
      label: label.trim(),
      location: location.trim(),
    } });
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

      {picker && (
        <SubjectPicker
          rect={picker.rect}
          cell={schedule[`${picker.day}-${picker.period}`]}
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

function ScheduleCell({
  day, period, cell, onEdit, onUnlink, onNavigate,
  folders,
  dragOver, onDragOver, onDragLeave, onDrop,
}) {
  const { t } = useLang();
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const navigationTarget = getScheduleNavigationTarget(cell, folders);
  const canNav = navigationTarget && onNavigate;

  const handleClick = () => {
    if (canNav) {
      onNavigate(navigationTarget);
    } else {
      onEdit(ref.current);
    }
  };

  return (
    <div
      className="lm-schedule-cell"
      ref={ref}
      draggable={!!cell}
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
      style={{
        minHeight: 56, borderRadius: 8,
        border: dragOver
          ? `1.5px dashed ${cell ? cell.color : '#0EA5E9'}`
          : `1px solid ${cell ? cell.color + '44' : 'var(--c-border)'}`,
        background: dragOver
          ? (cell ? `${cell.color}20` : 'rgba(14,165,233,0.08)')
          : (cell ? `${cell.color}12` : 'var(--c-surface)'),
        cursor: cell ? 'grab' : 'pointer', position: 'relative',
        transition: 'background .1s, border-color .1s',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {cell ? (
        <div style={{
          minHeight: 56,
          padding: '8px 10px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, maxWidth: '100%' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cell.color, flexShrink: 0 }} />
            <div className="lm-schedule-cell-label" style={{
              fontSize: 11, fontWeight: 600, color: 'var(--c-text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{cell.label}</div>
          </div>
          {cell.location && <div className="lm-schedule-cell-location">📍 {cell.location}</div>}
          {canNav && hovered && (
            <div style={{ fontSize: 9, color: cell.color, marginTop: 2, opacity: 0.8 }}>→ {t('schedule.navigate')}</div>
          )}
        </div>
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 0.6 : 0,
          transition: 'opacity .12s',
          fontSize: 18, color: 'var(--c-text-3)',
        }}>+</div>
      )}
      {cell && hovered && (
        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3 }}>
          {canNav && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(ref.current); }}
              title={t('schedule.pick_folder')}
              aria-label={t('schedule.pick_folder')}
              style={{
                width: 18, height: 18, border: 'none', borderRadius: 4,
                background: 'rgba(0,0,0,0.25)', color: '#fff', cursor: 'pointer',
                fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✎</button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onUnlink(); }}
            title={t('schedule.unlink')}
            aria-label={t('schedule.unlink')}
            style={{
              width: 18, height: 18, border: 'none', borderRadius: 4,
              background: 'rgba(0,0,0,0.25)', color: '#fff', cursor: 'pointer',
              fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      )}
    </div>
  );
}

// Timetable entries are free-form text, so navigation is intentionally based
// on the normalized class/subject + room combination rather than a fragile
// preset id. This also covers entries imported from older schedules.
const SCHEDULE_FOLDER_ROUTES = [
  { match: /10\s*bdf/, subjectId: 'spanisch', folderName: 'Klasse 10' },
  { match: /13\s*s(?:1|\b).*g2.*d\s*-?105/, subjectId: 'spanisch', folderName: 'Klasse 13 S' },
  { match: /6\s*d.*sp.*th\s*1/, subjectId: 'sport', folderName: 'Sport 6d' },
  { match: /8\s*abcdef/, subjectId: 'informatik', folderName: 'WP8' },
  { match: /6\s*d.*if.*j\s*-?105/, subjectId: 'informatik', folderName: '6d' },
  { match: /13.*sp.*g1.*th\s*3/, subjectId: 'sport', folderName: 'Klasse 13 SP' },
  { match: /6\s*f.*if.*j\s*-?105/, subjectId: 'informatik', folderName: '6f' },
  { match: /6\s*d.*ks.*f\s*103/, subjectId: 'klasse', folderName: '6d KS' },
];

function normalizeScheduleText(value) {
  return String(value || '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getScheduleNavigationTarget(cell, folders) {
  if (!cell) return null;
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
  // Older schedules persisted a boolean. Treat it as the original default name
  // until the user edits it, then persist the richer object shape.
  const details = entry && typeof entry === 'object' ? entry : {};
  const active = !!entry;
  const label = details.label || 'Aufsicht';
  const location = details.location || details.room || '';
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onEdit(ref.current)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={active ? `${label} bearbeiten` : 'Aufsicht hinzufügen'}
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

function SubjectPicker({ rect, cell, onSaveCell, onClear, onClose }) {
  useEscapeKey(true, onClose);
  const [label, setLabel] = useState(cell?.label || '');
  const [location, setLocation] = useState(cell?.location || '');
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
        <form onSubmit={(event) => { event.preventDefault(); onSaveCell({ label, location }); }} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
              Klasse oder Gruppe
              <input
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="z. B. Informatik 6"
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
