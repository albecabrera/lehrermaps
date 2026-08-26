import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import api from '../lib/api';
import { SUBJECTS } from '../constants/structure';
import { useIsMobile } from '../hooks/useIsMobile';

const STORAGE_KEY = 'lm_schedule';
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
const PERIODS = 6;
const subjectColor = (subjectId, fallback) => SUBJECTS.find((subject) => subject.id === subjectId)?.color || fallback;

const STUNDENPLAN_SUBJECTS = [
  { id: 'klassenstunde', label: 'Klassenstunde', color: subjectColor('klasse', '#EC4899'), subjectId: 'klasse' },
  { id: 'elsa',          label: 'ELSA',          color: subjectColor('klasse', '#EC4899'), subjectId: 'klasse' },
  { id: 'inf6',          label: 'Informatik 6',  color: subjectColor('informatik', '#2563EB'), subjectId: 'informatik' },
  { id: 'inf7',          label: 'Informatik 7',  color: subjectColor('informatik', '#2563EB'), subjectId: 'informatik' },
  { id: 'inf8',          label: 'Informatik 8',  color: subjectColor('informatik', '#2563EB'), subjectId: 'informatik' },
  { id: 'inf6d',         label: 'Informatik 6d', color: subjectColor('informatik', '#2563EB'), subjectId: 'informatik' },
  { id: 'inf6f',         label: 'Informatik 6f', color: subjectColor('informatik', '#2563EB'), subjectId: 'informatik' },
  { id: 'es9',           label: 'Spanisch 9',    color: subjectColor('spanisch', '#E8472A'), subjectId: 'spanisch' },
  { id: 'es10',          label: 'Spanisch 10',   color: subjectColor('spanisch', '#E8472A'), subjectId: 'spanisch' },
  { id: 'esq1',          label: 'Spanisch Q1',   color: subjectColor('spanisch', '#E8472A'), subjectId: 'spanisch' },
  { id: 'esq2',          label: 'Spanisch Q2',   color: subjectColor('spanisch', '#E8472A'), subjectId: 'spanisch' },
  { id: 'sportq1',       label: 'Sport Q1',      color: subjectColor('sport', '#16A34A'), subjectId: 'sport' },
  { id: 'sportq2',       label: 'Sport Q2',       color: subjectColor('sport', '#16A34A'), subjectId: 'sport' },
  { id: 'sport5d',       label: 'Sport 5d',      color: subjectColor('sport', '#16A34A'), subjectId: 'sport' },
  { id: 'sport6d',       label: 'Sport 6d',      color: subjectColor('sport', '#16A34A'), subjectId: 'sport' },
  { id: 'math6d',        label: 'Mathematik 6d', color: '#9333EA', subjectId: 'mathematik' },
  { id: 'vertretung',    label: 'Vertretung',    color: '#F59E0B' },
  { id: 'pausenaufsicht',label: 'Pausenaufsicht',color: '#64748B' },
  { id: 'mittagspause',  label: 'MiPa-Aufsicht', color: '#D97706' },
  { id: 'zertifikatskurs', label: 'Zertifikatskurs', color: '#7C3AED' },
  { id: 'frei',            label: 'Frei',             color: '#94A3B8' },
];

function loadCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function normalizeCell(value) {
  if (!value || value === true || typeof value !== 'object') return value;
  const preset = STUNDENPLAN_SUBJECTS.find((s) => s.id === value.id || s.id === value.subject || s.id === value.subjectId || s.label === value.label);
  if (!preset) return value.label && value.color ? value : null;
  return {
    id: preset.id,
    label: value.label || preset.label,
    color: preset.color,
    ...(value.room ? { room: value.room } : {}),
    ...(preset.subjectId ? { subjectId: preset.subjectId } : {}),
  };
}

function hydrateSchedule(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    if (key.startsWith('break-')) {
      next[key] = Object.fromEntries(Object.entries(value).map(([day, cell]) => [day, normalizeCell(cell)]));
      continue;
    }
    const cell = normalizeCell(value);
    if (cell) next[key] = cell;
  }
  return next;
}

export default function Schedule({ onNavigate }) {
  const { t, lang } = useLang();
  const isMobile = useIsMobile(860);
  const [schedule, setSchedule] = useState(() => hydrateSchedule(loadCache()));
  const [picker, setPicker] = useState(null); // { day, period, rect }
  const [breakPicker, setBreakPicker] = useState(null); // { breakKey, day, rect }
  const [selectedCell, setSelectedCell] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

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

  const assign = useCallback((subject) => {
    if (!picker) return;
    const key = `${picker.day}-${picker.period}`;
    const cell = { id: subject.id, label: subject.label, color: subject.color };
    if (subject.subjectId) cell.subjectId = subject.subjectId;
    persist({ ...schedule, [key]: cell });
    setPicker(null);
  }, [picker, schedule, persist]);

  const assignCustom = useCallback(({ label, room, color }) => {
    if (!picker || !label.trim()) return;
    const cell = { id: `custom-${Date.now()}`, label: label.trim(), color: color || '#0EA5E9', room: room.trim() };
    persist({ ...schedule, [`${picker.day}-${picker.period}`]: cell });
    setPicker(null);
  }, [picker, persist, schedule]);

  const unlink = useCallback((day, period) => {
    const key = `${day}-${period}`;
    const next = { ...schedule };
    delete next[key];
    persist(next);
  }, [schedule, persist]);

  const unlinkBreakDay = useCallback((breakKey, day) => {
    const next = { ...schedule, [breakKey]: { ...(schedule[breakKey] || {}) } };
    delete next[breakKey][day];
    if (Object.keys(next[breakKey]).length === 0) delete next[breakKey];
    persist(next);
  }, [schedule, persist]);

  const toggleBreakDay = useCallback((breakKey, day) => {
    const current = schedule[breakKey] || {};
    const updated = { ...current, [day]: !current[day] };
    if (!updated[day]) delete updated[day];
    const next = { ...schedule };
    if (Object.keys(updated).length === 0) delete next[breakKey];
    else next[breakKey] = updated;
    persist(next);
  }, [schedule, persist]);

  const assignBreakDay = useCallback((breakKey, day, payload) => {
    if (!['break-mittag', 'break-fruehstueck'].includes(breakKey) || payload?.type !== 'subject') return;
    const subject = STUNDENPLAN_SUBJECTS.find((item) => item.id === payload.subjectId);
    if (!subject) return;
    const cell = { id: subject.id, label: subject.label, color: subject.color };
    if (subject.subjectId) cell.subjectId = subject.subjectId;
    persist({ ...schedule, [breakKey]: { ...(schedule[breakKey] || {}), [day]: cell } });
  }, [persist, schedule]);

  const assignBreakSubject = useCallback((subject) => {
    if (!breakPicker) return;
    assignBreakDay(breakPicker.breakKey, breakPicker.day, { type: 'subject', subjectId: subject.id });
    setBreakPicker(null);
  }, [assignBreakDay, breakPicker]);

  const assignBreakCustom = useCallback(({ label, room, color }) => {
    if (!breakPicker || !label.trim()) return;
    const cell = { id: `custom-${Date.now()}`, label: label.trim(), color: color || '#0EA5E9', room: room.trim() };
    persist({ ...schedule, [breakPicker.breakKey]: { ...(schedule[breakPicker.breakKey] || {}), [breakPicker.day]: cell } });
    setBreakPicker(null);
  }, [breakPicker, persist, schedule]);

  const openPicker = useCallback((day, period, el) => {
    const rect = el.getBoundingClientRect();
    setPicker({ day, period, rect });
  }, []);

  const openBreakPicker = useCallback((breakKey, day, el) => {
    setBreakPicker({ breakKey, day, rect: el.getBoundingClientRect() });
  }, []);

  const openCellDetail = useCallback((detail) => {
    if (isMobile && detail?.cell) setSelectedCell(detail);
  }, [isMobile]);

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
    <>
    <div className="lm-schedule-page" style={{ padding: '32px clamp(18px, 4vw, 42px)', height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      <div className="lm-schedule-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
        <div className="lm-glass" style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 11, color: 'var(--c-text-2)' }}>
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 8h16M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        </div>
        <div>
          <div style={{ marginBottom: 3, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--c-text-3)' }}>Wochenübersicht</div>
          <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1, fontWeight: 750, color: 'var(--c-text)', letterSpacing: -0.7 }}>
            {t('schedule.title')}
          </h2>
        </div>
        <button
          onClick={exportIcs}
          className="lm-glass"
          style={{
            marginLeft: 'auto',
            height: 34,
            padding: '0 14px',
            border: '1px solid var(--c-border)',
            borderRadius: 9,
            color: 'var(--c-text-2)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: 'var(--c-shadow-pop)',
          }}
        >
          {t('schedule.export_ics')}
        </button>
      </div>

      <div className="lm-glass lm-schedule-grid" style={{
        display: 'grid',
        gridTemplateColumns: `52px repeat(5, 1fr)`,
        gap: 6,
        padding: 8,
        border: '1px solid var(--c-border)',
        borderRadius: 16,
        boxShadow: 'var(--c-glass-shadow)',
      }}>
        {/* Header row */}
        <div />
        {DAYS.map((d) => (
          <div key={d} className="lm-glass lm-schedule-day" style={{
            textAlign: 'center', fontSize: 10, fontWeight: 800,
            letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text-3)',
            padding: '9px 0', border: '1px solid var(--c-border)', borderRadius: 8,
          }}>{d}</div>
        ))}

        {/* Period rows */}
        {Array.from({ length: PERIODS }, (_, p) => (
          [
            p === 2 && <BreakRow key="break-fruehstueck" breakKey="break-fruehstueck" label="Pause" value={schedule['break-fruehstueck'] || {}} onToggleDay={(d) => toggleBreakDay('break-fruehstueck', d)} allowAssignments onEditDay={(d, el) => openBreakPicker('break-fruehstueck', d, el)} onOpenDetail={(d, cell, el) => openCellDetail({ breakKey: 'break-fruehstueck', day: d, dayLabel: DAYS[d], periodLabel: 'Pause', cell, anchor: el })} onDropDay={(d, payload) => assignBreakDay('break-fruehstueck', d, payload)} isMobile={isMobile} />,
            p === 4 && <BreakRow key="break-mittag" breakKey="break-mittag" label="MiPa-Aufsicht" value={schedule['break-mittag'] || {}} onToggleDay={(d) => toggleBreakDay('break-mittag', d)} allowAssignments onEditDay={(d, el) => openBreakPicker('break-mittag', d, el)} onOpenDetail={(d, cell, el) => openCellDetail({ breakKey: 'break-mittag', day: d, dayLabel: DAYS[d], periodLabel: 'MiPa-Aufsicht', cell, anchor: el })} onDropDay={(d, payload) => assignBreakDay('break-mittag', d, payload)} isMobile={isMobile} />,
            <div key={`label-${p}`} className="lm-schedule-period" style={{
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
                  isMobile={isMobile}
                  onOpenDetail={(detail) => openCellDetail(detail)}
                  dayLabel={DAYS[d]}
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

      {picker && (
        <SubjectPicker
          rect={picker.rect}
          current={schedule[`${picker.day}-${picker.period}`]?.id}
          currentCell={schedule[`${picker.day}-${picker.period}`]}
          onSelect={assign}
          onCustom={assignCustom}
          onClose={() => setPicker(null)}
        />
      )}
      {breakPicker && (
        <SubjectPicker
          rect={breakPicker.rect}
          current={schedule[breakPicker.breakKey]?.[breakPicker.day]?.id}
          currentCell={schedule[breakPicker.breakKey]?.[breakPicker.day]}
          onSelect={assignBreakSubject}
          onCustom={assignBreakCustom}
          onClose={() => setBreakPicker(null)}
        />
      )}
      </div>
    </div>
    {selectedCell && (
      <ScheduleDetailOverlay
        {...selectedCell}
        onClose={() => setSelectedCell(null)}
        onNavigate={selectedCell.cell.subjectId ? () => { setSelectedCell(null); onNavigate?.(selectedCell.cell.subjectId); } : null}
        onEdit={() => {
          setSelectedCell(null);
          if (selectedCell.breakKey) openBreakPicker(selectedCell.breakKey, selectedCell.day, selectedCell.anchor);
          else openPicker(selectedCell.day, selectedCell.period, selectedCell.anchor);
        }}
        onRemove={() => {
          setSelectedCell(null);
          if (selectedCell.breakKey) unlinkBreakDay(selectedCell.breakKey, selectedCell.day);
          else unlink(selectedCell.day, selectedCell.period);
        }}
      />
    )}
    </>
  );
}

function ScheduleCell({
  day, period, cell, onEdit, onUnlink, onNavigate,
  dragOver, onDragOver, onDragLeave, onDrop, isMobile, onOpenDetail, dayLabel,
}) {
  const { t } = useLang();
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const canNav = cell?.subjectId && onNavigate;

  const handleClick = () => {
    if (isMobile && cell) {
      onOpenDetail?.({ day, dayLabel, period, periodLabel: `${t('schedule.period')} ${period + 1}`, cell, anchor: ref.current });
      return;
    }
    if (canNav) {
      onNavigate(cell.subjectId);
    } else {
      onEdit(ref.current);
    }
  };

  return (
    <div
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
        minHeight: cell ? 68 : 56, minWidth: 0, borderRadius: 8,
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
      title={cell ? `${cell.label}${cell.room ? ` · ${cell.room}` : ''}` : undefined}
    >
      {cell ? (
        <div style={{ padding: '8px 8px 8px 9px', borderLeft: `3px solid ${cell.color}`, minHeight: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cell.color, flexShrink: 0 }} />
            <div style={{
              minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--c-text)',
              overflowWrap: 'anywhere', lineHeight: 1.2,
            }}>{cell.label}</div>
          </div>
          {canNav && hovered && (
            <div style={{ fontSize: 9, color: cell.color, marginTop: 2, opacity: 0.8 }}>→ {t('schedule.navigate')}</div>
          )}
          {cell.room && <div style={{ fontSize: 9, color: 'var(--c-text-3)', marginTop: 4, overflowWrap: 'anywhere', lineHeight: 1.15 }}>📍 {cell.room}</div>}
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

function ScheduleDetailOverlay({ cell, dayLabel, periodLabel, onClose, onNavigate, onEdit, onRemove }) {
  useEscapeKey(true, onClose);
  const detailCell = cell === true ? { label: 'Aufsicht', color: AUFSICHT_COLOR } : cell;
  const area = detailCell.subjectId ? (SUBJECTS.find((subject) => subject.id === detailCell.subjectId)?.name || 'Fachbereich') : 'Manueller Eintrag';

  return createPortal(
    <div className="lm-schedule-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="lm-schedule-detail" role="dialog" aria-modal="true" aria-labelledby="lm-schedule-detail-title">
        <header className="lm-schedule-detail-header">
          <div>
            <div className="lm-schedule-detail-kicker">Stundenplan</div>
            <h2 id="lm-schedule-detail-title">{detailCell.label}</h2>
          </div>
          <button type="button" className="lm-schedule-detail-close" onClick={onClose} aria-label="Detailansicht schließen">×</button>
        </header>
        <div className="lm-schedule-detail-color" style={{ '--schedule-detail-color': detailCell.color }}>
          <span aria-hidden="true" />
          <strong>{area}</strong>
        </div>
        <dl className="lm-schedule-detail-meta">
          <div><dt>Wochentag</dt><dd>{dayLabel}</dd></div>
          <div><dt>Unterrichtsstunde</dt><dd>{periodLabel}</dd></div>
          {detailCell.room && <div><dt>Ort / Raum</dt><dd>{detailCell.room}</dd></div>}
        </dl>
        <div className="lm-schedule-detail-actions">
          {onNavigate && <button type="button" className="lm-schedule-detail-primary" onClick={onNavigate}>→ Ordner öffnen</button>}
          <button type="button" onClick={onEdit}>✎ Bearbeiten</button>
          <button type="button" className="lm-schedule-detail-danger" onClick={onRemove}>× Entfernen</button>
        </div>
      </section>
    </div>,
    document.body
  );
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

function BreakRow({ breakKey, label, value, onToggleDay, allowAssignments = false, onEditDay, onOpenDetail, onDropDay, isMobile }) {
  return [
    <div key={`${breakKey}-label`} style={{
      display: 'flex', alignItems: 'center',
      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      textTransform: 'uppercase', color: 'var(--c-text-3)',
      justifyContent: 'flex-end', paddingRight: 6,
      height: 30,
      borderTop: `1px solid ${AUFSICHT_COLOR}30`,
      background: `${AUFSICHT_COLOR}08`,
    }}>{label}</div>,
    ...[0, 1, 2, 3, 4].map((d) => (
      <BreakDayCell key={`${breakKey}-${d}`} cell={value[d]} allowAssignments={allowAssignments} isMobile={isMobile} onToggle={() => onToggleDay(d)} onEdit={(el) => onEditDay?.(d, el)} onOpenDetail={(cell, el) => onOpenDetail?.(d, cell, el)} onDrop={(payload) => onDropDay?.(d, payload)} />
    )),
  ];
}

function BreakDayCell({ cell, allowAssignments = false, isMobile, onToggle, onEdit, onOpenDetail, onDrop }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const active = !!cell;
  const color = cell?.color || AUFSICHT_COLOR;
  return (
    <div
      ref={ref}
      onClick={() => {
        if (isMobile && cell) onOpenDetail?.(cell, ref.current);
        else if (allowAssignments) onEdit?.(ref.current);
        else onToggle();
      }}
      onDragOver={(event) => { if (!allowAssignments) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setHovered(true); }}
      onDrop={(event) => { if (!allowAssignments) return; event.preventDefault(); onDrop(readDndPayload(event.dataTransfer)); setHovered(false); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 30, borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${active ? color + '66' : hovered ? AUFSICHT_COLOR + '33' : 'var(--c-border)'}`,
        borderTop: `1px solid ${active ? color + '66' : AUFSICHT_COLOR + '30'}`,
        borderLeft: active ? `3px solid ${color}` : undefined,
        background: active ? `${color}18` : hovered ? `${AUFSICHT_COLOR}0C` : `${AUFSICHT_COLOR}08`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .1s, border-color .1s', position: 'relative',
      }}
    >
      {active ? (
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 0.3, textAlign: 'center', overflowWrap: 'anywhere', maxWidth: '100%', padding: '0 3px' }}>{cell === true ? 'Aufsicht' : cell.label}</span>
      ) : hovered ? (
        <span style={{ fontSize: 14, color: AUFSICHT_COLOR, opacity: 0.5 }}>+</span>
      ) : null}
      {active && cell !== true && cell.room && <span style={{ fontSize: 8, color, textAlign: 'center', overflowWrap: 'anywhere', maxWidth: '100%', padding: '0 3px' }}>📍 {cell.room}</span>}
      {allowAssignments && hovered && <button type="button" title="Aufsicht/Pause bearbeiten" aria-label="Aufsicht oder Pause bearbeiten" onClick={(event) => { event.stopPropagation(); onEdit?.(ref.current); }} style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, border: 0, borderRadius: 4, background: 'rgba(0,0,0,.25)', color: '#fff', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>✎</button>}
    </div>
  );
}

function SubjectPicker({ rect, current, currentCell, onSelect, onCustom, onClose }) {
  useEscapeKey(true, onClose);
  const [label, setLabel] = useState(currentCell?.label || '');
  const [room, setRoom] = useState(currentCell?.room || '');
  const [color, setColor] = useState(currentCell?.color || '#0EA5E9');
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
        {STUNDENPLAN_SUBJECTS.map((s) => {
          const active = s.id === current;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '7px 10px',
                border: active ? `1.5px solid ${s.color}` : '1.5px solid transparent',
                borderRadius: 8,
                background: active ? `${s.color}18` : 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background .1s, border-color .1s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--c-hover)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: s.color, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? s.color : 'var(--c-text)',
              }}>{s.label}</span>
              {active && (
                <svg style={{ marginLeft: 'auto', color: s.color }} width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          );
        })}
        <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 6, paddingTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-2)', marginBottom: 5 }}>Manueller Eintrag</div>
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Klasse / Kurs" aria-label="Klasse oder Kurs" style={pickerInputStyle} />
          <input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Raum, z. B. J004" aria-label="Raum" style={pickerInputStyle} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 5px', fontSize: 10, color: 'var(--c-text-2)' }}>
            Farbe
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Farbe für manuellen Eintrag" style={{ width: 28, height: 22, padding: 1, border: '1px solid var(--c-border)', borderRadius: 5, background: 'transparent', cursor: 'pointer' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--c-text-3)' }}>{color.toUpperCase()}</span>
          </label>
          <button type="button" disabled={!label.trim()} onClick={() => onCustom?.({ label, room, color })} style={{ width: '100%', marginTop: 4, padding: '7px 10px', border: 0, borderRadius: 8, background: color, color: '#fff', fontWeight: 700, cursor: label.trim() ? 'pointer' : 'not-allowed', opacity: label.trim() ? 1 : .5 }}>Eintrag übernehmen</button>
        </div>
      </div>
    </>,
    document.body
  );
}

const pickerInputStyle = { width: '100%', boxSizing: 'border-box', marginBottom: 5, padding: '7px 8px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-input-bg)', color: 'var(--c-text)', font: 'inherit', fontSize: 11 };
