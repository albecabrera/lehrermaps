import { useState, useEffect } from 'react';
import { useLang } from '../contexts/LangContext';

export default function LinkPreview({ link, accent = '#E8472A', onDelete }) {
  const { t } = useLang();
  const [qrSrc, setQrSrc] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link?.url) return;
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(link.url, { width: 260, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
    ).then((src) => { if (!cancelled) setQrSrc(src); }).catch(() => {});
    return () => { cancelled = true; };
  }, [link?.url]);

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { }
  };

  if (!link) {
    return (
      <div style={{
        height: '100%', background: 'var(--c-bg)', borderLeft: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-text-3)', fontSize: 12, padding: 24, textAlign: 'center',
      }}>
        <span>Link auswählen<br/>zum Anzeigen</span>
      </div>
    );
  }

  const displayUrl = link.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div style={{
      height: '100%', background: 'var(--c-bg)', borderLeft: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column', color: 'var(--c-text)',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 10, alignItems: 'flex-start', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.5 9.5a4 4 0 0 0 5.656 0l1.415-1.414a4 4 0 0 0-5.657-5.657L7.5 3.843" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9.5 6.5a4 4 0 0 0-5.656 0L2.43 7.914a4 4 0 0 0 5.657 5.657l.414-.414" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word', color: 'var(--c-text)' }}>{link.title}</div>
          <div style={{ fontSize: 11, color: 'var(--c-text-2)', marginTop: 3, fontFamily: '"DM Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayUrl}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 0 }}>
        {qrSrc ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img
              src={qrSrc}
              alt="QR-Code"
              style={{ width: 200, height: 200, borderRadius: 8, border: '1px solid var(--c-border)' }}
            />
            <div style={{ fontSize: 10, color: 'var(--c-text-3)', textAlign: 'center', fontFamily: '"DM Mono", monospace' }}>
              {t('preview.qr_scan')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{t('loading')}</div>
        )}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--c-border)', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <a href={link.url} target="_blank" rel="noreferrer" style={btnStyle('#fff', accent)}>
          {t('open')}
        </a>
        <button onClick={copyUrl} style={{ ...btnStyle('var(--c-text)', 'var(--c-hover)'), border: 'none', cursor: 'pointer' }}>
          {copied ? t('copied') : t('copy_url')}
        </button>
        {onDelete && (
          <button onClick={() => onDelete(link.id)} style={{ ...btnStyle('#DC2626', 'rgba(220,38,38,0.08)'), border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
            {t('delete')}
          </button>
        )}
      </div>
    </div>
  );
}

function btnStyle(color, bg) {
  return {
    height: 28, padding: '0 14px', borderRadius: 6,
    background: bg, color, fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', textDecoration: 'none',
    display: 'flex', alignItems: 'center',
  };
}
