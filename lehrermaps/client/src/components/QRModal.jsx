import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useLang } from '../contexts/LangContext';

export default function QRModal({ url, title, onClose }) {
  const { t } = useLang();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220, margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).catch(() => {});
  }, [url]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'var(--c-overlay)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
        animation: 'lmFadeIn .12s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)', borderRadius: 16,
          padding: '28px 32px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
          boxShadow: 'var(--c-shadow-modal)',
          border: '1px solid var(--c-border-soft)',
          animation: 'lmSlideUp .18s cubic-bezier(.4,.7,.3,1)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', textAlign: 'center' }}>
          {title}
        </div>
        <div style={{
          background: '#fff', padding: 12, borderRadius: 10,
          border: '1px solid var(--c-border)',
        }}>
          <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4 }} />
        </div>
        <div style={{
          fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace',
          maxWidth: 240, textAlign: 'center', wordBreak: 'break-all',
          background: 'var(--c-surface-2)', padding: '6px 10px', borderRadius: 6,
          border: '1px solid var(--c-border)',
        }}>
          {url}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigator.clipboard.writeText(url)}
            style={{
              height: 32, padding: '0 14px', border: '1px solid var(--c-border)',
              borderRadius: 7, background: 'transparent', color: 'var(--c-text-2)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{t('student.copy_link')}</button>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: '0 16px', border: 'none', borderRadius: 7,
              background: 'var(--c-hover)', color: 'var(--c-text)', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{t('cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
