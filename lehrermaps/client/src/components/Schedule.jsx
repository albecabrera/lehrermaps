import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SUBJECTS } from '../constants/structure';
import FolderIcon from './FolderIcon';
import { useLang } from '../contexts/LangContext';

const STORAGE_KEY = 'lm_schedule';
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
const PERIODS = 10;

function loadSchedule() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveSchedule(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function Schedule({ folders, onNavigate }) {
  const { t, lang } = useLang();
  const [schedule, setSchedule] = useState(loadSchedule);
  const [picker, setPicker] = useState(null); // { day, period }

  const DAYS = lang === 'es' ? DAYS_ES : DAYS_DE;
  const fileDate = new Date().toISOString().slice(0, 10);

  const getSubjectColor = (subjectId) =>
    SUBJECTS.find((s) => s.id === subjectId)?.color ?? '#6B7280';

  const assign = useCallback((folder) => {
    if (!picker) return;
    const key = `${picker.day}-${picker.period}`;
    const next = {
      ...schedule,
      [key]: { folderId: folder.id, folderName: folder.name, subject: folder.subject, color: getSubjectColor(folder.subject) },
    };
    setSchedule(next);
    saveSchedule(next);
    setPicker(null);
  }, [picker, schedule]);

  const unlink = useCallback((day, period) => {
    const key = `${day}-${period}`;
    const next = { ...schedule };
    delete next[key];
    setSchedule(next);
    saveSchedule(next);
  }, [schedule]);

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
      if (!cell?.folderName) return;
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
        `SUMMARY:${cell.folderName.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${(cell.subject || '').replace(/,/g, '\\,')}`,
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
                  onOpen={() => { if (cell) onNavigate(cell.subject, cell.folderId); }}
                  onEdit={() => setPicker({ day: d, period: p })}
                  onUnlink={() => unlink(d, p)}
                  t={t}
                />
              );
            }),
          ]
        ))}
      </div>

      {picker && (
        <FolderPicker
          folders={folders}
          onSelect={assign}
          onClose={() => setPicker(null)}
          t={t}
        />
      )}
    </div>
  );
}

function ScheduleCell({ cell, onOpen, onEdit, onUnlink, t }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
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
      onClick={cell ? onOpen : onEdit}
    >
      {cell ? (
        <div style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cell.color, flexShrink: 0 }} />
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--c-text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{cell.folderName}</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 2 }}>{cell.subject}</div>
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
            border: 'none', borderRadius: 4, background: 'var(--c-hover)',
            color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      )}
    </div>
  );
}

function FolderPicker({ folders, onSelect, onClose, t }) {
  const [q, setQ] = useState('');
  const filtered = q
    ? folders.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()) || f.subject.includes(q.toLowerCase()))
    : folders;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'var(--c-overlay)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, maxHeight: '70vh',
          background: 'var(--c-surface)', borderRadius: 14,
          border: '1px solid var(--c-border-soft)',
          boxShadow: 'var(--c-shadow-modal)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'lmSlideUp .18s cubic-bezier(.4,.7,.3,1)',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 10 }}>
            {t('schedule.pick_folder')}
          </div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            style={{
              width: '100%', height: 32, border: '1px solid var(--c-border)', borderRadius: 7,
              background: 'var(--c-input-bg)', color: 'var(--c-text)', fontSize: 12,
              padding: '0 10px', outline: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {filtered.map((f) => {
            const color = SUBJECTS.find((s) => s.id === f.subject)?.color ?? '#6B7280';
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f)}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  borderRadius: 7, fontFamily: 'inherit', color: 'var(--c-text)',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <FolderIcon color={color} size={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-3)' }}>{f.subject} · {f.group_name}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--c-border)' }}>
          <button onClick={onClose} style={{
            height: 30, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 7,
            background: 'transparent', color: 'var(--c-text-2)', fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
