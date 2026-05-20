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

  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const { folders, loading } = useFolders();
  const { files } = useFiles(activeFolder?.id);

  const subjectFolders = folders.filter((f) => f.subject === subjectId);
  const accent = subject.color;

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
              onClick={() => { setSubjectId(s.id); setActiveFolder(null); setActiveFile(null); }}
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
            <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text-3)' }}>{t('loading')}</div>
          ) : subjectFolders.map((f) => {
            const on = f.id === activeFolder?.id;
            return (
              <button
                key={f.id}
                onClick={() => { setActiveFolder(f); setActiveFile(null); }}
                style={{
                  appearance: 'none', border: 'none', font: 'inherit',
                  width: '100%', padding: '7px 14px 7px 16px',
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
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '18px 24px' }}>
          {activeFolder ? (
            <FileTable
              files={files}
              links={[]}
              activeFileId={activeFile?.id}
              onFileSelect={(f) => setActiveFile(f)}
              accent={accent}
              query=""
            />
          ) : (
            <div style={{ color: 'var(--c-text-3)', fontSize: 13, paddingTop: 24 }}>
              {t('preview.select')}
            </div>
          )}
        </div>

        {/* Preview */}
        {activeFolder && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--c-border)', overflow: 'hidden' }}>
            <FilePreview file={activeFile} accent={accent} />
          </div>
        )}
      </div>
    </div>
  );
}
