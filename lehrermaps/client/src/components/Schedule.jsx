import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import api from '../lib/api';

const STORAGE_KEY = 'lm_schedule';
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
const PERIODS = 6;

const STUNDENPLAN_SUBJECTS = [
  { id: 'klassenstunde', label: 'Klassenstunde', color: '#9333EA' },
  { id: 'elsa',          label: 'ELSA',          color: '#0891B2' },
  { id: 'inf6',          label: 'Informatik 6',  color: '#2563EB' },
  { id: 'inf7',          label: 'Informatik 7',  color: '#1E40AF' },
  { id: 'es9',           label: 'Spanisch 9',    color: '#E8472A' },
  { id: 'esq1',          label: 'Spanisch Q1',   color: '#B83220' },
  { id: 'sportq1',       label: 'Sport Q1',      color: '#16A34A' },
  { id: 'sport5d',       label: 'Sport 5d',      color: '#15803D' },
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

export default function Schedule() {
  const { t, lang } = useLang();
  const [schedule, setSchedule] = useState(loadCache);
  const [picker, setPicker] = useState(null); // { day, period, rect }

  useEffect(() => {
    api.get('/schedule').then((res) => {
      const data = res.data || {};
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
    persist({ ...schedule, [key]: { id: subject.id, label: subject.label, color: subject.color } });
    setPicker(null);
  }, [picker, schedule, persist]);

  const unlink = useCallback((day, period) => {
    const key = `${day}-${period}`;
    const next = { ...schedule };
    delete next[key];
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

  const openPicker = useCallback((day, period, el) => {
    const rect = el.getBoundingClientRect();
    setPicker({ day, period, rect });
  }, []);

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
    <div style={{ padding: '28px 32px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--c-text-3)' }}>
          <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 8h16M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--c-text)', letterSpacing: -0.4 }}>
          {t('schedule.title')}
        </h2>
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

      {/* Subject legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {STUNDENPLAN_SUBJECTS.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20,
            background: s.color + '18',
            border: `1px solid ${s.color}44`,
            fontSize: 11, fontWeight: 600, color: s.color,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <div style={{
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
            p === 2 && <BreakRow key="break-fruehstueck" breakKey="break-fruehstueck" label="Frühstückspause" value={schedule['break-fruehstueck'] || {}} onToggleDay={(d) => toggleBreakDay('break-fruehstueck', d)} />,
            p === 4 && <BreakRow key="break-mittag" breakKey="break-mittag" label="Mittagspause" value={schedule['break-mittag'] || {}} onToggleDay={(d) => toggleBreakDay('break-mittag', d)} />,
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
                  cell={cell}
                  onEdit={(el) => openPicker(d, p, el)}
                  onUnlink={() => unlink(d, p)}
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
          onSelect={assign}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function ScheduleCell({ cell, onEdit, onUnlink }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);

  return (
    <div
      ref={ref}
      style={{
        minHeight: 56, borderRadius: 8,
        border: `1px solid ${cell ? cell.color + '44' : 'var(--c-border)'}`,
        background: cell ? `${cell.color}12` : 'var(--c-surface)',
        cursor: 'pointer', position: 'relative',
        transition: 'background .1s, border-color .1s',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEdit(ref.current)}
    >
      {cell ? (
        <div style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cell.color, flexShrink: 0 }} />
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--c-text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{cell.label}</div>
          </div>
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
        <button
          onClick={(e) => { e.stopPropagation(); onUnlink(); }}
          style={{
            position: 'absolute', top: 4, right: 4, width: 18, height: 18,
            border: 'none', borderRadius: 4, background: 'rgba(0,0,0,0.25)',
            color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      )}
    </div>
  );
}

const AUFSICHT_COLOR = '#64748B';

function BreakRow({ breakKey, label, value, onToggleDay }) {
  return [
    <div key={`${breakKey}-label`} style={{
      display: 'flex', alignItems: 'center',
      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      textTransform: 'uppercase', color: 'var(--c-text-3)',
      justifyContent: 'flex-end', paddingRight: 6,
      height: 30,
    }}>{label.split('pause')[0]}</div>,
    ...[0, 1, 2, 3, 4].map((d) => (
      <BreakDayCell key={`${breakKey}-${d}`} active={!!value[d]} onToggle={() => onToggleDay(d)} />
    )),
  ];
}

function BreakDayCell({ active, onToggle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 30, borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${active ? AUFSICHT_COLOR + '66' : hovered ? AUFSICHT_COLOR + '33' : 'var(--c-border)'}`,
        background: active ? `${AUFSICHT_COLOR}18` : hovered ? `${AUFSICHT_COLOR}0C` : 'var(--c-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .1s, border-color .1s',
      }}
    >
      {active ? (
        <span style={{ fontSize: 9, fontWeight: 700, color: AUFSICHT_COLOR, letterSpacing: 0.3 }}>Aufsicht</span>
      ) : hovered ? (
        <span style={{ fontSize: 14, color: AUFSICHT_COLOR, opacity: 0.5 }}>+</span>
      ) : null}
    </div>
  );
}

function SubjectPicker({ rect, current, onSelect, onClose }) {
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
      </div>
    </>,
    document.body
  );
}
