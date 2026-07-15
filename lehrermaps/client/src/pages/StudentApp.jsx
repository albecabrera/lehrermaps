import { useState } from 'react';
import { SUBJECTS } from '../constants/structure';
import { useFolders } from '../hooks/useFolders';
import { useFiles } from '../hooks/useFiles';
import FileTable from '../components/FileTable';
import FilePreview from '../components/FilePreview';
import FolderIcon from '../components/FolderIcon';
import { useLang } from '../contexts/LangContext';
import { useTheme } from '../contexts/ThemeContext';

export default function StudentApp({ onLogout }) {
  const { t } = useLang();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [subjectId, setSubjectId] = useState('spanisch');
  const [activeFolder, setActiveFolder] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [studentQuery, setStudentQuery] = useState('');

  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const { folders, loading } = useFolders();
  const { files } = useFiles(activeFolder?.id);

  const subjectFolders = folders.filter((f) => f.subject === subjectId);
  const accent = subject.color;

  // Baumreihenfolge mit Tiefe — Unterordner erscheinen eingerückt unter ihrem Elternordner
  const orderedFolders = (() => {
    const byParent = new Map();
    subjectFolders.forEach((f) => {
      const k = f.parent_id ?? null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(f);
    });
    const sortFn = (a, b) =>
      ((b.is_favorite || 0) - (a.is_favorite || 0)) ||
      ((a.sort_order || 0) - (b.sort_order || 0)) ||
      a.name.localeCompare(b.name);
    const out = [];
    const seen = new Set();
    const walk = (pid, depth) => {
      (byParent.get(pid) || []).sort(sortFn).forEach((f) => {
        if (seen.has(f.id)) return;
        seen.add(f.id);
        out.push({ ...f, depth });
        walk(f.id, depth + 1);
      });
    };
    walk(null, 0);
    // Waisen (Elternordner nicht sichtbar/anderes Fach) trotzdem anzeigen
    subjectFolders.forEach((f) => {
      if (!seen.has(f.id)) out.push({ ...f, depth: 0 });
    });
    return out;
  })();

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--c-bg)', color: 'var(--c-text)',
      fontFamily: '"DM Sans", -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', padding: '0 20px',
        background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
        gap: 12, flexShrink: 0,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: accent }} />
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1, color: 'var(--c-text)', letterSpacing: -0.2 }}>
          LehrerMaps · {t('student.view')}
        </span>
        <button
          onClick={toggleTheme}
          title={isDark ? t('app.theme_light') : t('app.theme_dark')}
          aria-label={isDark ? t('app.theme_light') : t('app.theme_dark')}
          style={{
            width: 28, height: 28, border: '1px solid var(--c-border)', borderRadius: 6,
            background: 'transparent', cursor: 'pointer', color: 'var(--c-text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isDark ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M11.5 8.5A5 5 0 0 1 4.5 1.5a5 5 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          )}
        </button>
        <button
          onClick={onLogout}
          style={{
            height: 28, padding: '0 12px', border: '1px solid var(--c-border)', borderRadius: 6,
            background: 'transparent', color: 'var(--c-text-2)', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >{t('student.exit')}</button>
      </div>

      {/* Subject tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-tab-bg)', flexShrink: 0,
      }}>
        {SUBJECTS.map((s) => {
          const on = s.id === subjectId;
          return (
            <button
              key={s.id}
              onClick={() => { setSubjectId(s.id); setActiveFolder(null); setActiveFile(null); setStudentQuery(''); }}
              style={{
                appearance: 'none', border: 'none', font: 'inherit',
                padding: '10px 18px', cursor: 'pointer',
                background: 'transparent', borderBottom: on ? `2px solid ${s.color}` : '2px solid transparent',
                fontSize: 13, fontWeight: on ? 600 : 500,
                color: on ? 'var(--c-text)' : 'var(--c-text-2)',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'color .12s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: on ? 1 : 0.5 }} />
              {t('subject.' + s.id)}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Folder list */}
        <div style={{
          width: 220, background: 'var(--c-surface)', borderRight: '1px solid var(--c-border)',
          overflow: 'auto', padding: '10px 0', flexShrink: 0,
        }}>
          {loading ? (
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="lm-skeleton-shimmer" style={{
                  height: 30, borderRadius: 7,
                  background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                  opacity: 1 - i * 0.18,
                }} />
              ))}
            </div>
          ) : orderedFolders.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
              {t('folders.no_folders_title')}
            </div>
          ) : orderedFolders.map((f) => {
            const on = f.id === activeFolder?.id;
            return (
              <button
                key={f.id}
                onClick={() => { setActiveFolder(f); setActiveFile(null); setStudentQuery(''); }}
                style={{
                  appearance: 'none', border: 'none', font: 'inherit',
                  width: '100%', padding: `8px 14px 8px ${16 + f.depth * 14}px`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', textAlign: 'left',
                  background: on ? `${accent}14` : 'transparent',
                  borderLeft: on ? `3px solid ${accent}` : '3px solid transparent',
                  color: on ? 'var(--c-text)' : 'var(--c-text-2)',
                  fontSize: 13, fontWeight: on ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                <FolderIcon color={on ? accent : 'var(--c-text-3)'} size={15} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </span>
                {f.due_at ? (
                  <span style={{ fontSize: 10, color: '#DC2626', fontFamily: '"DM Mono", monospace' }}>
                    ⏰ {new Date(f.due_at).toLocaleDateString('de-DE')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* File list */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeFolder && (
            <div style={{
              padding: '12px 24px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                border: '1px solid var(--c-border)', borderRadius: 8,
                background: 'var(--c-surface)', padding: '0 10px', height: 32,
              }}>
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--c-text-3)', flexShrink: 0 }}>
                  <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder={t('search.placeholder')}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 12, color: 'var(--c-text)', fontFamily: 'inherit',
                  }}
                />
                {studentQuery && (
                  <button
                    onClick={() => setStudentQuery('')}
                    style={{
                      width: 16, height: 16, border: 'none', background: 'var(--c-hover)',
                      borderRadius: 3, color: 'var(--c-text-3)', cursor: 'pointer',
                      fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', flexShrink: 0 }}>
                {studentQuery
                  ? `${files.filter((f) => f.original_name.toLowerCase().includes(studentQuery.toLowerCase())).length} / ${files.length}`
                  : files.length}
              </span>
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px 18px' }}>
          {activeFolder ? (
            <FileTable
              files={files}
              links={[]}
              activeFileId={activeFile?.id}
              onFileSelect={(f) => setActiveFile(f)}
              accent={accent}
              query={studentQuery}
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 12, color: 'var(--c-text-3)',
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.3 }}>
                <path d="M6 34V10l10-6h18v30H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M6 10h10V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 20h12M14 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 13 }}>{t('preview.select')}</span>
            </div>
          )}
          </div>
        </div>

        {/* Preview */}
        {activeFolder && (
          <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--c-border)', overflow: 'hidden' }}>
            <FilePreview file={activeFile} accent={accent} />
          </div>
        )}
      </div>
    </div>
  );
}
