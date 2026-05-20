import { useState, useEffect, useRef } from 'react';
import { useLang } from '../contexts/LangContext';

export default function AddLinkModal({ open, onClose, onSave, accent = '#E8472A' }) {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [qrSrc, setQrSrc] = useState(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (open) { setTitle(''); setUrl(''); setQrSrc(null); setSaving(false); setTimeout(() => titleRef.current?.focus(), 60); }
  }, [open]);

  useEffect(() => {
    if (!url) { setQrSrc(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const src = await QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#111827', light: '#ffffff' } });
        if (!cancelled) setQrSrc(src);
      } catch { if (!cancelled) setQrSrc(null); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [url]);

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try { await onSave(title.trim(), url.trim()); onClose(); }
    catch { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'var(--c-overlay)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)', borderRadius: 14, width: 440,
          boxShadow: 'var(--c-shadow-modal)', overflow: 'hidden',
          fontFamily: '"DM Sans", -apple-system, sans-serif',
          border: '1px solid var(--c-border-soft)',
        }}
      >
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 9.5a4 4 0 0 0 5.656 0l1.415-1.414a4 4 0 0 0-5.657-5.657L7.5 3.843" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9.5 6.5a4 4 0 0 0-5.656 0L2.43 7.914a4 4 0 0 0 5.657 5.657l.414-.414" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{t('modal.add_link.title')}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{t('modal.add_link.subtitle')}</div>
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{t('modal.add_link.name_label')}</label>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('modal.add_link.name_placeholder')}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{t('modal.add_link.url_label')}</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('modal.add_link.url_placeholder')}
                style={inputStyle}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          </div>

          <div style={{
            width: 100, height: 100, borderRadius: 8, border: '1px solid var(--c-border)',
            background: 'var(--c-hover)', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {qrSrc ? (
              <img src={qrSrc} alt="QR" style={{ width: 92, height: 92 }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" opacity="0.25">
                <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="16" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="2" y="16" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor"/>
                <rect x="19" y="5" width="4" height="4" rx="0.5" fill="currentColor"/>
                <rect x="5" y="19" width="4" height="4" rx="0.5" fill="currentColor"/>
                <path d="M16 16h3v3h-3zM22 16h2v2h-2zM16 22h2v2h-2zM20 20h6v6h-6z" fill="currentColor"/>
              </svg>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--c-surface-2)' }}>
          <button onClick={onClose} style={cancelBtn}>{t('cancel')}</button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !url.trim()}
            style={{ ...primaryBtn(accent), opacity: (!title.trim() || !url.trim()) ? 0.5 : 1 }}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--c-border)',
  borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  color: 'var(--c-text)', background: 'var(--c-input-bg)', boxSizing: 'border-box',
};
const cancelBtn = {
  height: 32, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 7,
  background: 'transparent', color: 'var(--c-text-2)', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const primaryBtn = (accent) => ({
  height: 32, padding: '0 16px', border: 'none', borderRadius: 7,
  background: accent, color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
});
