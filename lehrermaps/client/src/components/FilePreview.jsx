import { useState, useEffect, useRef, useCallback } from 'react';
import FileBadge from './FileBadge';
import { detectKind } from '../constants/structure';
import { downloadFile, viewFile, previewFile, openFileInApp } from '../lib/api';
import { useLang } from '../contexts/LangContext';

export default function FilePreview({ file, accent = '#E8472A', onClose }) {
  const { t } = useLang();

  if (!file) {
    return (
      <div style={{
        height: '100%', background: 'var(--c-bg)', borderLeft: '1px solid var(--c-border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', color: 'var(--c-text-2)', fontSize: 12,
        padding: 24, textAlign: 'center', gap: 8,
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3 }}>
          <rect x="6" y="4" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 10h8M10 14h8M10 18h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ color: 'var(--c-text-3)', whiteSpace: 'pre-line' }}>{t('preview.select')}</span>
      </div>
    );
  }

  const kind = detectKind(file.original_name);
  const sizeFmt = formatBytes(file.size_bytes);
  const dateFmt = file.uploaded_at
    ? new Date(file.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const ext = file.original_name.split('.').pop().toLowerCase();
  const convertible = new Set(['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods']);
  const nativeAppExts = new Set(['pptx', 'ppt', 'odp', 'doc', 'docx', 'odc', 'odt', 'pdf']);
  const canOpenInline = ['pdf', 'img', 'video', 'audio', 'text', 'markdown', 'code', 'notebook'].includes(kind)
    || convertible.has(ext);
  const canOpenInApp = nativeAppExts.has(ext);

  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%', background: 'var(--c-bg)', borderLeft: '1px solid var(--c-border)',
        display: 'flex', flexDirection: 'column', color: 'var(--c-text)',
      }}>
      <div style={{
        padding: '10px 12px 10px 16px', borderBottom: '1px solid var(--c-border)',
        display: 'flex', gap: 10, alignItems: 'flex-start', flexShrink: 0,
      }}>
        <FileBadge kind={kind} name={file.original_name} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, lineHeight: 1.3,
            wordBreak: 'break-word', color: 'var(--c-text)',
          }}>{file.original_name}</div>
          <div style={{
            fontSize: 11, color: 'var(--c-text-2)', marginTop: 3,
            fontFamily: '"DM Mono", monospace',
          }}>{sizeFmt} · {dateFmt}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Schließen"
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 5,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--c-text-3)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginTop: 2,
              transition: 'background .1s, color .1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)'; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <PreviewSurface file={file} kind={kind} accent={accent} t={t} />
      </div>

      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--c-border)',
        display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {canOpenInline && (
          <a
            href={convertible.has(ext) ? previewFile(file.id) : viewFile(file.id)}
            target="_blank"
            rel="noreferrer"
            style={btnStyle('var(--c-text)', 'var(--c-hover)')}
          >{t('open_browser')}</a>
        )}
        {canOpenInApp && (
          <OpenInAppButton fileId={file.id} ext={ext} accent={accent} t={t} />
        )}
        {canOpenInline && (
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? t('preview.fullscreen_exit') : t('preview.fullscreen')}
            style={{ ...btnStyle('var(--c-text-2)', 'var(--c-hover)'), border: 'none', cursor: 'pointer' }}
          >
            {isFullscreen ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 1H1v3M8 1h3v3M4 11H1V8M8 11h3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 4V1h3M8 1h3v3M1 8v3h3M11 8v3H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
        <a
          href={downloadFile(file.id)}
          target="_blank"
          rel="noreferrer"
          style={{ ...btnStyle('#fff', accent), marginLeft: 'auto' }}
        >{t('download')}</a>
      </div>
    </div>
  );
}

function btnStyle(color, bg) {
  return {
    height: 28, padding: '0 14px', border: 'none', borderRadius: 6,
    background: bg, color, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
    display: 'flex', alignItems: 'center',
  };
}

function PreviewSurface({ file, kind, accent, t }) {
  const src = viewFile(file.id);

  if (kind === 'pdf') {
    return (
      <iframe
        src={src}
        title={t('preview.iframe_title', { name: file.original_name })}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    );
  }

  if (kind === 'img') {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-hover)', padding: 12, boxSizing: 'border-box',
      }}>
        <img
          src={src}
          alt={file.original_name}
          loading="lazy"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
        />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        controls
        src={src}
        style={{ width: '100%', height: '100%', background: 'var(--c-surface-2)', display: 'block' }}
      />
    );
  }

  if (kind === 'audio') {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, background: 'var(--c-bg)', padding: 24, boxSizing: 'border-box',
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="20" fill={`${accent}18`}/>
          <path d="M17 28V12l18-4v16" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="11" cy="28" r="5" stroke={accent} strokeWidth="1.8"/>
          <circle cx="29" cy="24" r="5" stroke={accent} strokeWidth="1.8"/>
        </svg>
        <audio controls src={src} style={{ width: '100%' }} />
      </div>
    );
  }

  if (kind === 'text' || kind === 'markdown' || kind === 'code' || kind === 'notebook') {
    return <TextPreview src={src} t={t} />;
  }

  if (kind === 'doc' || kind === 'slide') {
    const ext = file.original_name.split('.').pop().toLowerCase();
    const convertible = new Set(['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp']);
    if (convertible.has(ext)) {
      return <ConvertedPdfPreview fileId={file.id} t={t} />;
    }
    return <FallbackPreview file={file} kind={kind} accent={accent} t={t} />;
  }

  return <FallbackPreview file={file} kind={kind} accent={accent} t={t} />;
}

const TEXT_LIMIT = 60000;

function TextPreview({ src, t }) {
  const [content, setContent] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setContent(null);
    setErr(false);
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.text();
      })
      .then(setContent)
      .catch(() => setErr(true));
  }, [src]);

  if (err) return (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text-3)' }}>{t('preview.unavailable')}</div>
  );
  if (!content) return (
    <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text-3)' }}>{t('preview.loading')}</div>
  );

  const truncated = content.length > TEXT_LIMIT;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {truncated && (
        <div style={{
          padding: '4px 14px', background: '#78350F22', borderBottom: '1px solid #92400E44',
          fontSize: 10, color: '#D97706', fontFamily: '"DM Mono", monospace', flexShrink: 0,
        }}>
          {t('preview.truncated')}
        </div>
      )}
      <pre style={{
        margin: 0, flex: 1, padding: 14, boxSizing: 'border-box',
        background: '#1F2937', color: '#e8e8ea', overflow: 'auto',
        fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 11, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {truncated ? content.slice(0, TEXT_LIMIT) + '\n\n[…]' : content}
      </pre>
    </div>
  );
}

const APP_LABEL_KEYS = {
  pptx: 'open_in_pptx', ppt: 'open_in_pptx', odp: 'open_in_impress',
  doc: 'open_in_word', docx: 'open_in_word', odc: 'open_in_word', odt: 'open_in_writer',
  pdf: 'open_in_preview',
};

function OpenInAppButton({ fileId, ext, accent, t }) {
  const [state, setState] = useState('idle');
  const labelKey = APP_LABEL_KEYS[ext] || 'open';

  const handle = async () => {
    setState('loading');
    try {
      await openFileInApp(fileId);
      setState('idle');
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={state === 'loading'}
      style={{
        ...btnStyle('#fff', state === 'error' ? '#DC2626' : '#F97316'),
        opacity: state === 'loading' ? 0.7 : 1,
        cursor: state === 'loading' ? 'wait' : 'pointer',
        border: 'none',
      }}
    >
      {state === 'error' ? t('app_not_found') : state === 'loading' ? t('opening') : t(labelKey)}
    </button>
  );
}

function ConvertedPdfPreview({ fileId, t }) {
  const [state, setState] = useState('loading');
  const src = previewFile(fileId);

  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setState('error'), 30000);
    return () => clearTimeout(timer);
  }, [state, src]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {state === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
          background: 'var(--c-bg)', fontSize: 12, color: 'var(--c-text-2)',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="10" cy="10" r="8" stroke="var(--c-border)" strokeWidth="2"/>
            <path d="M10 2a8 8 0 0 1 8 8" stroke="var(--c-text-2)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          {t('converting')}
        </div>
      )}
      {state === 'error' && (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text-3)' }}>{t('preview.conversion_failed')}</div>
      )}
      <iframe
        src={src}
        title={t('preview.preview_title')}
        style={{ width: '100%', height: '100%', border: 'none', display: state === 'ready' ? 'block' : 'none' }}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
    </div>
  );
}

function FallbackPreview({ file, kind, accent, t }) {
  const labels = {
    doc: 'Word-Dokument', slide: 'Präsentation', sheet: 'Tabelle',
    archive: 'Archiv', notebook: 'Notebook',
  };
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 12,
      background: 'var(--c-bg)', padding: 24, boxSizing: 'border-box',
    }}>
      <FileBadge kind={kind} name={file.original_name} size={48} />
      <div style={{ fontSize: 13, color: 'var(--c-text-2)', textAlign: 'center' }}>
        {labels[kind] || 'Datei'} · {t('preview.no_browser')}
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text-3)', textAlign: 'center' }}>
        {t('preview.download_to_open')}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
