import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';

export default function DeadlineModal({ open, title, initialDate, accent, onClose, onSave }) {
  const { t } = useLang();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue(initialDate || '');
  }, [open, initialDate]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'var(--c-overlay)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--c-surface)', color: 'var(--c-text)',
          border: '1px solid var(--c-border-soft)', borderRadius: 12,
          boxShadow: 'var(--c-shadow-modal)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 4 }}>{t('modal.deadline.hint')}</div>
        </div>
        <div style={{ padding: 18 }}>
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%', height: 38, padding: '0 10px',
              border: '1px solid var(--c-border)', borderRadius: 8,
              background: 'var(--c-input-bg)', color: 'var(--c-text)',
              fontFamily: 'inherit', fontSize: 13,
            }}
          />
          <button
            onClick={() => setValue('')}
            style={{
              marginTop: 10, height: 30, border: '1px solid var(--c-border)',
              borderRadius: 7, background: 'transparent', color: 'var(--c-text-2)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 10px',
            }}
          >
            {t('modal.deadline.clear')}
          </button>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnStyle()}>{t('cancel')}</button>
          <button onClick={() => onSave(value)} style={btnStyle(accent, true)}>{t('save')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function btnStyle(accent, primary = false) {
  return {
    height: 32, padding: '0 12px', borderRadius: 7, fontFamily: 'inherit', fontSize: 12,
    border: primary ? 'none' : '1px solid var(--c-border)',
    background: primary ? accent : 'transparent',
    color: primary ? '#fff' : 'var(--c-text-2)',
    cursor: 'pointer',
    fontWeight: primary ? 600 : 500,
  };
}
