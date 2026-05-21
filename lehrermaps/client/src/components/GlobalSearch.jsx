import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { searchGlobal } from '../lib/api';
import { SUBJECTS, detectKind } from '../constants/structure';
import FileBadge from './FileBadge';
import FolderIcon from './FolderIcon';
import { useLang } from '../contexts/LangContext';

const DEBOUNCE_MS = 280;

export default function GlobalSearch({ open, onClose, onNavigate }) {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ files: [], folders: [], hasMoreFiles: false, hasMoreFolders: false, totalFiles: 0, totalFolders: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(null); // 'files' | 'folders' | null
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults({ files: [], folders: [], hasMoreFiles: false, hasMoreFolders: false });
      setLoading(false);
      setLoadingMore(null);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const doSearch = useCallback((value) => {
    clearTimeout(timerRef.current);
    if (!value.trim()) { setResults({ files: [], folders: [], hasMoreFiles: false, hasMoreFolders: false, totalFiles: 0, totalFolders: 0 }); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchGlobal(value);
        setResults(data);
      } catch { setResults({ files: [], folders: [], hasMoreFiles: false, hasMoreFolders: false }); }
      finally { setLoading(false); }
    }, DEBOUNCE_MS);
  }, []);

  const loadMore = useCallback(async (section) => {
    setLoadingMore(section);
    try {
      const fileOffset = section === 'files' ? results.files.length : 0;
      const folderOffset = section === 'folders' ? results.folders.length : 0;
      const data = await searchGlobal(q, fileOffset, folderOffset);
      setResults((prev) => ({
        files: section === 'files' ? [...prev.files, ...data.files] : prev.files,
        folders: section === 'folders' ? [...prev.folders, ...data.folders] : prev.folders,
        hasMoreFiles: section === 'files' ? data.hasMoreFiles : prev.hasMoreFiles,
        hasMoreFolders: section === 'folders' ? data.hasMoreFolders : prev.hasMoreFolders,
      }));
    } catch { /* silent */ }
    finally { setLoadingMore(null); }
  }, [q, results.files.length, results.folders.length]);

  const handleChange = (e) => {
    setQ(e.target.value);
    doSearch(e.target.value);
  };

  if (!open) return null;

  const getColor = (subjectId) => SUBJECTS.find((s) => s.id === subjectId)?.color ?? '#6B7280';
  const hasQuery = q.trim().length > 0;
  const isEmpty = results.files.length === 0 && results.folders.length === 0;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'var(--c-overlay)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '72px 24px 24px',
        animation: 'lmFadeIn .12s ease-out',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 620,
          background: 'var(--c-surface)', borderRadius: 16,
          boxShadow: 'var(--c-shadow-modal)',
          border: '1px solid var(--c-border-soft)',
          overflow: 'hidden',
          animation: 'lmSlideUp .18s cubic-bezier(.4,.7,.3,1)',
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderBottom: '1px solid var(--c-border)',
        }}>
          {loading ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--c-text-3)' }}>
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="2" strokeDasharray="15" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur=".7s" repeatCount="indefinite"/>
              </circle>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--c-text-3)' }}>
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={handleChange}
            placeholder={t('search.placeholder')}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 16, color: 'var(--c-text)', fontFamily: 'inherit',
            }}
          />
          {q && (
            <button
              onClick={() => { setQ(''); setResults({ files: [], folders: [] }); inputRef.current?.focus(); }}
              style={{
                width: 20, height: 20, border: 'none', borderRadius: 4, background: 'var(--c-hover)',
                color: 'var(--c-text-3)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >×</button>
          )}
          <kbd style={{
            fontSize: 11, color: 'var(--c-text-3)', background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border)', borderRadius: 5, padding: '2px 6px',
            fontFamily: '"DM Mono", monospace', flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!hasQuery && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13 }}>
              {t('search.hint')}
            </div>
          )}
          {hasQuery && !loading && isEmpty && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13 }}>
              {t('search.no_results')}
            </div>
          )}
          {results.folders.length > 0 && (
            <ResultSection label={t('search.folders_section')} total={results.totalFolders}>
              {results.folders.map((f) => (
                <ResultRow
                  key={`folder-${f.id}`}
                  onClick={() => { onNavigate(f.subject, f.id); onClose(); }}
                  icon={<FolderIcon color={getColor(f.subject)} size={15} />}
                  name={f.name}
                  meta={`${f.subject} › ${f.group_name}${f.notes_match ? ` · ${t('search.notes_match')}` : ''}`}
                  dotColor={getColor(f.subject)}
                />
              ))}
              {results.hasMoreFolders && (
                <ShowMoreButton loading={loadingMore === 'folders'} onClick={() => loadMore('folders')} t={t} />
              )}
            </ResultSection>
          )}
          {results.files.length > 0 && (
            <ResultSection label={t('search.files_section')} total={results.totalFiles}>
              {results.files.map((f) => (
                <ResultRow
                  key={`file-${f.id}`}
                  onClick={() => { onNavigate(f.subject, f.folder_id); onClose(); }}
                  icon={<FileBadge kind={detectKind(f.name)} name={f.name} size={20} />}
                  name={f.name}
                  meta={`${f.subject} › ${f.folder_name}`}
                  dotColor={getColor(f.subject)}
                />
              ))}
              {results.hasMoreFiles && (
                <ShowMoreButton loading={loadingMore === 'files'} onClick={() => loadMore('files')} t={t} />
              )}
            </ResultSection>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResultSection({ label, total, children }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase',
        color: 'var(--c-text-3)', padding: '6px 18px 3px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {label}
        {total > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 500, letterSpacing: 0,
            background: 'var(--c-hover)', color: 'var(--c-text-3)',
            borderRadius: 4, padding: '1px 5px', textTransform: 'none',
          }}>{total}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ShowMoreButton({ loading, onClick, t }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%', textAlign: 'center', padding: '7px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'transparent', border: 'none', cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit', fontSize: 11, color: 'var(--c-text-3)',
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = 'var(--c-text-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-3)'; }}
    >
      {loading ? '…' : t('search.show_more')}
    </button>
  );
}

function ResultRow({ onClick, icon, name, meta, dotColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '8px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', color: 'var(--c-text)', transition: 'background .1s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: 'var(--c-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 1 }}>{meta}</div>
      </div>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dotColor, flexShrink: 0, opacity: 0.7,
      }} />
    </button>
  );
}
