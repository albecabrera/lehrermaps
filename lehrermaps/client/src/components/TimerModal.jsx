import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function TimerModal({ open, initialMinutes, accent, onClose, onSave }) {
  const { t } = useLang();
  const [value, setValue] = useState('');
  useEscapeKey(open, onClose);
  useEffect(() => { if (open) setValue(initialMinutes ? String(initialMinutes) : ''); }, [open, initialMinutes]);
  if (!open) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--c-overlay)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border-soft)', borderRadius: 12, boxShadow: 'var(--c-shadow-modal)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t('modal.timer.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 4 }}>{t('modal.timer.hint')}</div>
        </div>
        <div style={{ padding: 18 }}>
          <input autoFocus type="number" min="1" max="600" step="1" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('modal.timer.placeholder')} style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-input-bg)', color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 13 }} />
          <button onClick={() => setValue('')} style={{ marginTop: 10, height: 30, border: '1px solid var(--c-border)', borderRadius: 7, background: 'transparent', color: 'var(--c-text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 10px' }}>{t('modal.timer.clear')}</button>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={buttonStyle()}>{t('cancel')}</button>
          <button onClick={() => onSave(value)} style={buttonStyle(accent, true)}>{t('save')}</button>
        </div>
      </div>
    </div>, document.body
  );
}

function buttonStyle(accent, primary = false) {
  return { height: 32, padding: '0 12px', borderRadius: 7, fontFamily: 'inherit', fontSize: 12, border: primary ? 'none' : '1px solid var(--c-border)', background: primary ? accent : 'transparent', color: primary ? '#fff' : 'var(--c-text-2)', cursor: 'pointer', fontWeight: primary ? 600 : 500 };
}
