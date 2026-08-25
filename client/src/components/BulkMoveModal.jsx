import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function BulkMoveModal({ files, folders, targetId, onTargetChange, onConfirm, onClose, accent, t }) {
  useEscapeKey(true, onClose);
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : folders;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'var(--c-overlay)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        className="lm-modal-surface"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)',
          borderRadius: 14, boxShadow: 'var(--c-shadow-modal)',
          width: '100%', maxWidth: 400, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'lmSlideUp .16s cubic-bezier(.4,.7,.3,1)',
        }}
      >
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {t('table.bulk_move_title')} · {files.length}×
          </span>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, border: 'none', borderRadius: 6,
              background: 'var(--c-hover)', color: 'var(--c-text-2)',
              cursor: 'pointer', fontSize: 14, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
          <input
            autoFocus
            placeholder="Ordner suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', border: '1px solid var(--c-border)', borderRadius: 7,
              padding: '6px 10px', background: 'var(--c-surface-2)', color: 'var(--c-text)',
              fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
          {filtered.map((folder) => {
            const on = String(folder.id) === String(targetId);
            return (
              <button
                key={folder.id}
                onClick={() => onTargetChange(String(folder.id))}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: on ? `${accent}14` : 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', color: on ? accent : 'var(--c-text)',
                  fontSize: 12, fontWeight: on ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {folder.name}
                </span>
                <span style={{ fontSize: 10, color: on ? accent : 'var(--c-text-3)' }}>
                  {folder.subject}
                </span>
                {on && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--c-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 7,
              background: 'transparent', color: 'var(--c-text-2)', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Abbrechen</button>
          <button
            onClick={onConfirm}
            disabled={!targetId}
            style={{
              height: 32, padding: '0 16px', border: 'none', borderRadius: 7,
              background: targetId ? accent : 'var(--c-border)', color: '#fff', fontSize: 12,
              fontWeight: 600, cursor: targetId ? 'pointer' : 'default', fontFamily: 'inherit',
              opacity: targetId ? 1 : 0.5,
            }}
          >{t('table.bulk_move_confirm')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
