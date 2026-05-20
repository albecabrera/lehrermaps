import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';

export default function ConfirmModal({ open, title, message, warning, onConfirm, onClose }) {
  const { t } = useLang();
  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'rgba(10,10,14,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'lmFadeIn .15s ease-out',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--c-surface)', color: 'var(--c-text)',
          borderRadius: 14, padding: '24px 24px 20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          animation: 'lmSlideUp .2s cubic-bezier(.4,.7,.3,1)',
          border: '1px solid var(--c-border)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--c-text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: warning ? 12 : 20 }}>
          {message}
        </div>
        {warning && (
          <div style={{
            background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626',
            marginBottom: 20, lineHeight: 1.5,
          }}>
            ⚠ {warning}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 34, padding: '0 16px', border: '1px solid var(--c-border)', borderRadius: 8,
              background: 'transparent', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >{t('cancel')}</button>
          <button
            onClick={onConfirm}
            style={{
              height: 34, padding: '0 16px', border: 'none', borderRadius: 8,
              background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >{t('delete')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
