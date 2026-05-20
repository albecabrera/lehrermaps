import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import FileTable from '../components/FileTable';
import FilePreview from '../components/FilePreview';
import UploadModal from '../components/UploadModal';
import NewFolderModal from '../components/NewFolderModal';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmModal from '../components/ConfirmModal';
import GlobalSearch from '../components/GlobalSearch';
import Schedule from '../components/Schedule';
import { SUBJECTS } from '../constants/structure';
import { useFolders } from '../hooks/useFolders';
import { useFiles } from '../hooks/useFiles';
import { useLinks } from '../hooks/useLinks';
import { useRecents } from '../hooks/useRecents';
import { downloadFolderZip, downloadFilesZip } from '../lib/api';
import AddLinkModal from '../components/AddLinkModal';
import LinkPreview from '../components/LinkPreview';
import RenameFolderModal from '../components/RenameFolderModal';
import NotesEditor from '../components/NotesEditor';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';

export default function App({ onLogout }) {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { lang, t, setLang } = useLang();

  const [subjectId, setSubjectId] = useState('spanisch');
  const [activeFolder, setActiveFolder] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [query, setQuery] = useState('');
  const [activeLink, setActiveLink] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [newFolderGroup, setNewFolderGroup] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renamingFile, setRenamingFile] = useState(null);
  const [hoverSubject, setHoverSubject] = useState(null);
  const [folderTab, setFolderTab] = useState('files');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [viewMode, setViewMode] = useState('subjects');
  const [dropOver, setDropOver] = useState(false);
  const [dropFiles, setDropFiles] = useState(null);
  const [dropUploading, setDropUploading] = useState(null);

  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const { folders, loading: foldersLoading, add: addFolder, remove: removeFolder, rename: renameFolder, reorder: reorderFolders, toggleFavorite, setDeadline: setFolderDeadline, reload: reloadFolders } = useFolders();
  const { files, upload, remove: removeFile, rename: renameFileHook, toggleShare, setDeadline: setFileDeadline, togglePublic } = useFiles(activeFolder?.id);
  const { links, add: addLink, remove: removeLink } = useLinks(activeFolder?.id);
  const { recents, add: addRecent } = useRecents();

  const [previewWidth, setPreviewWidth] = useState(320);
  const dragState = useRef(null);

  // Cmd+K global search shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: previewWidth };
    const onMove = (ev) => {
      if (!dragState.current) return;
      const delta = dragState.current.startX - ev.clientX;
      const next = Math.min(700, Math.max(180, dragState.current.startWidth + delta));
      setPreviewWidth(next);
    };
    const onUp = () => {
      dragState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [previewWidth]);

  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[subjectId];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [subjectId]);

  const onSubjectChange = (id) => {
    setSubjectId(id);
    setActiveFolder(null);
    setActiveFile(null);
    setQuery('');
  };

  const onFolderSelect = (folder) => {
    setActiveFolder(folder);
    setActiveFile(null);
    setActiveLink(null);
    setQuery('');
    setFolderTab('files');
    const color = SUBJECTS.find((s) => s.id === folder.subject)?.color;
    addRecent(folder, color);
  };

  const handleGlobalNavigate = (targetSubject, folderId) => {
    setSubjectId(targetSubject);
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      setActiveFolder(folder);
      setActiveFile(null);
      setActiveLink(null);
      setQuery('');
      setFolderTab('files');
      const color = SUBJECTS.find((s) => s.id === targetSubject)?.color;
      addRecent(folder, color);
    }
    setGlobalSearchOpen(false);
  };

  const handleRecentClick = (recent) => {
    setSubjectId(recent.subject);
    const folder = folders.find((f) => f.id === recent.id);
    if (folder) {
      setActiveFolder(folder);
      setActiveFile(null);
      setActiveLink(null);
      setQuery('');
      setFolderTab('files');
    }
  };

  const handleUpload = async (file, onProgress) => {
    const newFile = await upload(file, onProgress);
    reloadFolders();
    return newFile;
  };

  const handleDirectDropUpload = useCallback(async (incomingFiles) => {
    const filesToUpload = [...incomingFiles].slice(0, 20);
    if (!filesToUpload.length || !activeFolder) return;

    setDropUploading({ total: filesToUpload.length, done: 0, failed: 0 });

    let done = 0;
    let failed = 0;
    for (const file of filesToUpload) {
      try {
        await upload(file);
        done += 1;
      } catch {
        failed += 1;
      } finally {
        setDropUploading({ total: filesToUpload.length, done, failed });
      }
    }

    reloadFolders();
    setTimeout(() => setDropUploading(null), 900);
  }, [activeFolder, reloadFolders, upload]);

  const handleNewFolder = async ({ subject: subjectKey, group_name, name }) => {
    await addFolder(subjectKey, group_name, name);
  };

  const handleDeleteFile = (file) => {
    setConfirmModal({
      title: t('confirm.delete'),
      message: t('confirm.delete_file_msg', { name: file.original_name }),
      onConfirm: async () => {
        setConfirmModal(null);
        await removeFile(file.id);
        if (activeFile?.id === file.id) setActiveFile(null);
      },
    });
  };

  const handleRenameFile = async (id, name) => {
    const updated = await renameFileHook(id, name);
    if (activeFile?.id === id) setActiveFile(updated);
  };

  const handleSetFolderDeadline = async () => {
    if (!activeFolder) return;
    const current = activeFolder.due_at ? new Date(activeFolder.due_at).toISOString().slice(0, 10) : '';
    const value = window.prompt('Fecha límite carpeta (YYYY-MM-DD). Vacío para quitar:', current);
    if (value === null) return;
    const due_at = value.trim() ? `${value.trim()} 23:59:59` : null;
    const updated = await setFolderDeadline(activeFolder.id, due_at);
    setActiveFolder(updated);
  };

  const handleSetFileDeadline = async (file) => {
    const current = file?.due_at ? new Date(file.due_at).toISOString().slice(0, 10) : '';
    const value = window.prompt('Fecha límite archivo (YYYY-MM-DD). Vacío para quitar:', current);
    if (value === null) return;
    const due_at = value.trim() ? `${value.trim()} 23:59:59` : null;
    const updated = await setFileDeadline(file.id, due_at);
    if (activeFile?.id === file.id) setActiveFile(updated);
  };

  const handleBulkDeleteFiles = async (selectedFiles) => {
    for (const file of selectedFiles) {
      await removeFile(file.id);
      if (activeFile?.id === file.id) setActiveFile(null);
    }
  };

  const handleBulkShareFiles = async (selectedFiles) => {
    for (const file of selectedFiles) {
      if (!file.is_shared) await toggleShare(file.id);
    }
  };

  const handleBulkUnshareFiles = async (selectedFiles) => {
    for (const file of selectedFiles) {
      if (file.is_shared) await toggleShare(file.id);
    }
  };

  const handleBulkDownloadFiles = (selectedFiles) => {
    if (!selectedFiles.length) return;
    window.location.href = downloadFilesZip(selectedFiles.map((f) => f.id));
  };

  const handleAddLink = async (title, url) => {
    await addLink(title, url);
  };

  const handleDeleteFolder = (folder) => {
    setConfirmModal({
      title: t('confirm.delete'),
      message: t('confirm.delete_folder_msg', { name: folder.name }),
      warning: folder.file_count > 0
        ? t('confirm.folder_cascade', { n: folder.file_count })
        : null,
      onConfirm: async () => {
        setConfirmModal(null);
        await removeFolder(folder.id);
        if (activeFolder?.id === folder.id) {
          setActiveFolder(null);
          setActiveFile(null);
          setActiveLink(null);
        }
      },
    });
  };

  const handleRenameFolder = async (id, name) => {
    const updated = await renameFolder(id, name);
    if (activeFolder?.id === id) setActiveFolder(updated);
  };

  const handleDeleteLink = async (id) => {
    await removeLink(id);
    if (activeLink?.id === id) setActiveLink(null);
  };

  const accent = subject.color;
  const subjectFolders = folders.filter((f) => f.subject === subjectId);
  const filteredCount = query
    ? files.filter((f) => f.original_name.toLowerCase().includes(query.toLowerCase())).length
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--c-bg)', color: 'var(--c-text)',
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      fontFeatureSettings: '"ss01", "cv11"',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', padding: '8px 16px 0',
        background: 'var(--c-tab-bg)', borderBottom: '1px solid var(--c-border)',
        position: 'relative', flexShrink: 0, gap: 2,
        minHeight: 56,
      }}>
        {SUBJECTS.map((s) => {
          const on = s.id === subjectId;
          const hovered = hoverSubject === s.id;
          return (
            <button
              key={s.id}
              ref={(el) => (tabRefs.current[s.id] = el)}
              onClick={() => onSubjectChange(s.id)}
              onMouseEnter={() => setHoverSubject(s.id)}
              onMouseLeave={() => setHoverSubject(null)}
              style={{
                appearance: 'none', border: 'none', font: 'inherit',
                padding: '10px 18px 12px', cursor: 'pointer',
                background: on ? 'var(--c-surface)' : hovered ? 'var(--c-hover-2)' : 'transparent',
                borderRadius: '10px 10px 0 0',
                marginBottom: on ? -1 : 0,
                display: 'flex', alignItems: 'center', gap: 9,
                borderLeft: on ? '1px solid var(--c-border)' : '1px solid transparent',
                borderRight: on ? '1px solid var(--c-border)' : '1px solid transparent',
                position: 'relative', transition: 'background .12s',
              }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: 3, background: s.color,
                opacity: on || hovered ? 1 : 0.55,
                boxShadow: on ? `0 0 0 2px ${s.color}26` : 'none',
                transition: 'all .15s',
              }} />
              <span style={{
                fontSize: 13, fontWeight: on ? 600 : 500,
                color: on ? 'var(--c-text)' : 'var(--c-text-2)', letterSpacing: -0.1,
              }}>{t('subject.' + s.id)}</span>
            </button>
          );
        })}

        {/* Sliding tab indicator */}
        <div style={{
          position: 'absolute', bottom: -1, height: 2,
          left: indicator.left, width: indicator.width,
          background: accent,
          transition: 'left .25s cubic-bezier(.4,.7,.3,1), width .25s cubic-bezier(.4,.7,.3,1)',
          borderRadius: '2px 2px 0 0',
        }} />

        {/* Stundenplan toggle */}
        <button
          onClick={() => setViewMode((m) => m === 'schedule' ? 'subjects' : 'schedule')}
          style={{
            appearance: 'none', border: 'none', font: 'inherit',
            padding: '10px 16px 12px', cursor: 'pointer',
            background: viewMode === 'schedule' ? 'var(--c-surface)' : 'transparent',
            borderRadius: '10px 10px 0 0',
            marginBottom: viewMode === 'schedule' ? -1 : 0,
            display: 'flex', alignItems: 'center', gap: 8,
            borderLeft: viewMode === 'schedule' ? '1px solid var(--c-border)' : '1px solid transparent',
            borderRight: viewMode === 'schedule' ? '1px solid var(--c-border)' : '1px solid transparent',
            transition: 'background .12s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: viewMode === 'schedule' ? '#0EA5E9' : 'var(--c-text-3)' }}>
            <rect x="1" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 6h12M5 1v3M9 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span style={{
            fontSize: 13, fontWeight: viewMode === 'schedule' ? 600 : 500,
            color: viewMode === 'schedule' ? 'var(--c-text)' : 'var(--c-text-2)',
            letterSpacing: -0.1,
          }}>{t('schedule.title')}</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Right controls */}
        <div style={{ paddingBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Global search button */}
          <button
            onClick={() => setGlobalSearchOpen(true)}
            title="Suche (⌘K)"
            style={{
              height: 30, padding: '0 10px', border: '0.5px solid var(--c-border)', borderRadius: 7,
              background: 'var(--c-hover)', color: 'var(--c-text-2)',
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit', minWidth: 140,
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-border)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
          >
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span style={{ flex: 1 }}>{t('search.placeholder')}</span>
            <kbd style={{
              fontSize: 9, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 4, padding: '1px 4px', fontFamily: '"DM Mono", monospace',
              color: 'var(--c-text-3)',
            }}>⌘K</kbd>
          </button>

          <SearchField value={query} onChange={setQuery} accent={accent}
            placeholder={t('app.search_placeholder', { subject: t('subject.' + subjectId) })} />

          {/* Lang toggle */}
          <button
            onClick={() => setLang(lang === 'de' ? 'es' : 'de')}
            title={lang === 'de' ? t('app.lang_es') : t('app.lang_de')}
            style={{
              height: 30, padding: '0 10px', border: '1px solid var(--c-border)', borderRadius: 7,
              background: 'transparent', color: 'var(--c-text-2)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', letterSpacing: 0.3, transition: 'background .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {lang === 'de' ? 'DE' : 'ES'}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? t('app.theme_light') : t('app.theme_dark')}
            style={{
              width: 30, height: 30, border: '1px solid var(--c-border)', borderRadius: 7,
              background: 'transparent', cursor: 'pointer', color: 'var(--c-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M11.5 8.5A5 5 0 0 1 4.5 1.5a5 5 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Upload */}
          <button
            onClick={() => setUploadOpen(true)}
            disabled={!activeFolder}
            style={{
              height: 30, padding: '0 14px', border: 'none', borderRadius: 7,
              background: activeFolder ? accent : 'var(--c-border)',
              color: activeFolder ? '#fff' : 'var(--c-text-3)',
              fontSize: 12, fontWeight: 600, cursor: activeFolder ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: activeFolder ? `0 2px 6px ${accent}40` : 'none',
              transition: 'background .15s, transform .1s',
              fontFamily: 'inherit',
            }}
            onMouseDown={(e) => { if (activeFolder) e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={(e) => e.currentTarget.style.transform = ''}
            onMouseLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            {t('app.upload')}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            title={t('app.logout')}
            style={{
              width: 30, height: 30, border: 'none', borderRadius: 7,
              background: 'transparent', cursor: 'pointer', color: 'var(--c-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 7h7M9 4l3 3-3 3M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {viewMode === 'schedule' ? (
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Schedule
              folders={folders}
              onNavigate={(subject, folderId) => { setViewMode('subjects'); handleGlobalNavigate(subject, folderId); }}
            />
          </div>
        ) : <>
        <Sidebar
          subject={subject}
          groups={subject.groups}
          folders={subjectFolders}
          activeFolderId={activeFolder?.id}
          onFolderSelect={onFolderSelect}
          onNewFolder={() => { setNewFolderGroup(null); setNewFolderOpen(true); }}
          onNewFolderInGroup={(g) => { setNewFolderGroup(g); setNewFolderOpen(true); }}
          onRenameFolder={setRenamingFolder}
          onDeleteFolder={handleDeleteFolder}
          onReorderFolders={reorderFolders}
          onToggleFavorite={toggleFavorite}
        />

        <div
          style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}
          onDragOver={(e) => { if (!activeFolder || folderTab !== 'files') return; e.preventDefault(); setDropOver(true); }}
          onDragEnter={(e) => { if (!activeFolder || folderTab !== 'files') return; e.preventDefault(); setDropOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false); }}
          onDrop={async (e) => {
            e.preventDefault();
            setDropOver(false);
            if (!activeFolder || folderTab !== 'files' || !e.dataTransfer.files.length) return;
            await handleDirectDropUpload(e.dataTransfer.files);
          }}
        >
          {(dropOver || dropUploading) && activeFolder && folderTab === 'files' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: `${accent}14`,
              border: `2px dashed ${accent}`,
              borderRadius: 0, pointerEvents: 'none',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 24V10M11 17l7-7 7 7M6 28v3a1 1 0 0 0 1 1h22a1 1 0 0 0 1-1v-3"
                  stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 600, color: accent }}>
                {dropUploading
                  ? `Subiendo ${dropUploading.done}/${dropUploading.total}${dropUploading.failed ? ` · ${dropUploading.failed} error` : ''}`
                  : t('modal.upload.drop_active')}
              </span>
            </div>
          )}
          {activeFolder ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Folder header */}
              <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
                <Breadcrumb
                  items={[
                    t('subject.' + subjectId),
                    activeFolder.group_name,
                    activeFolder.name,
                  ]}
                  accent={accent}
                />
                <div style={{
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                  marginTop: 8, marginBottom: 0, gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1 style={{
                      fontSize: 24, fontWeight: 600, margin: 0,
                      letterSpacing: -0.5, color: 'var(--c-text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{activeFolder.name}</h1>
                    {activeFolder.is_favorite ? (
                      <span style={{ color: '#F59E0B', fontSize: 16 }}>★</span>
                    ) : null}
                    <a
                      href={downloadFolderZip(activeFolder.id)}
                      title={t('folder.download_zip')}
                      style={{
                        marginLeft: 8, height: 26, padding: '0 10px',
                        border: '1px solid var(--c-border)', borderRadius: 6,
                        background: 'transparent', color: 'var(--c-text-3)',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        textDecoration: 'none', transition: 'background .1s, color .1s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)'; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 1v6M3 5l2.5 2.5L8 5M1 9h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      ZIP
                    </a>
                    <button
                      onClick={handleSetFolderDeadline}
                      style={{
                        marginLeft: 8, height: 26, padding: '0 10px',
                        border: '1px solid var(--c-border)', borderRadius: 6,
                        background: 'transparent', color: 'var(--c-text-3)',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontFamily: 'inherit',
                      }}
                    >
                      ⏰ {activeFolder?.due_at ? new Date(activeFolder.due_at).toLocaleDateString('de-DE') : 'Deadline'}
                    </button>
                  </div>
                </div>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '1px solid var(--c-border)' }}>
                  {[
                    { key: 'files', label: t('notes.files_tab') },
                    { key: 'notes', label: t('notes.tab') },
                  ].map(({ key, label }) => {
                    const on = folderTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFolderTab(key)}
                        style={{
                          appearance: 'none', border: 'none', background: 'transparent',
                          padding: '8px 16px', fontSize: 13, fontWeight: on ? 600 : 500,
                          color: on ? accent : 'var(--c-text-2)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          borderBottom: on ? `2px solid ${accent}` : '2px solid transparent',
                          marginBottom: -1, transition: 'color .12s',
                        }}
                      >{label}</button>
                    );
                  })}
                  {folderTab === 'files' && (
                    <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginLeft: 'auto', alignSelf: 'center', paddingRight: 4 }}>
                      {filteredCount !== null
                        ? t('files.filter', { filtered: filteredCount, total: files.length, q: query })
                        : (files.length === 1
                            ? t('files.count_one', { n: 1 })
                            : t('files.count_many', { n: files.length }))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, minHeight: 0, overflow: folderTab === 'files' ? 'auto' : 'hidden' }}>
                {folderTab === 'files' ? (
                  <div style={{ padding: '18px 28px' }}>
                    <FileTable
                      files={files}
                      links={links}
                      activeFileId={activeFile?.id}
                      activeLinkId={activeLink?.id}
                      onFileSelect={(f) => { setActiveFile(f); setActiveLink(null); }}
                      onLinkSelect={(l) => { setActiveLink(l); setActiveFile(null); }}
                      accent={accent}
                      query={query}
                      onDelete={handleDeleteFile}
                      onRename={setRenamingFile}
                      onDeleteLink={handleDeleteLink}
                      onUpload={() => setUploadOpen(true)}
                      onAddLink={() => setAddLinkOpen(true)}
                      onToggleShare={toggleShare}
                      onTogglePublic={togglePublic}
                      onSetDeadline={handleSetFileDeadline}
                      onBulkDelete={handleBulkDeleteFiles}
                      onBulkShare={handleBulkShareFiles}
                      onBulkUnshare={handleBulkUnshareFiles}
                      onBulkDownload={handleBulkDownloadFiles}
                    />
                  </div>
                ) : (
                  <NotesEditor
                    folderId={activeFolder.id}
                    folderName={activeFolder.name}
                    initialContent={activeFolder.notes || ''}
                    accent={accent}
                  />
                )}
              </div>
            </div>
          ) : (
            <WelcomeView
              subject={subject}
              folders={subjectFolders}
              foldersLoading={foldersLoading}
              recents={recents}
              onFolderSelect={onFolderSelect}
              onRecentClick={handleRecentClick}
              onNewFolder={() => setNewFolderOpen(true)}
              t={t}
            />
          )}
        </div>

        {/* Preview panel — resizable */}
        {activeFolder && (
          <div style={{ width: previewWidth, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
            <div
              onMouseDown={onResizeMouseDown}
              style={{
                width: 4, flexShrink: 0, cursor: 'col-resize',
                background: 'transparent', position: 'relative',
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = accent + '55'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            />
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {activeLink
                ? <LinkPreview link={activeLink} accent={accent} onDelete={handleDeleteLink} />
                : <FilePreview file={activeFile} accent={accent} />
              }
            </div>
          </div>
        )}
        </>}
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); setDropFiles(null); }}
        accent={accent}
        targetFolder={activeFolder
          ? `${t('subject.' + subjectId)} › ${activeFolder.group_name} › ${activeFolder.name}`
          : undefined}
        onUpload={handleUpload}
        initialFiles={dropFiles}
      />

      <AddLinkModal
        open={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        onSave={handleAddLink}
        accent={accent}
      />

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onSave={handleNewFolder}
        subject={subject}
        defaultGroup={newFolderGroup}
      />
      <RenameFolderModal
        folder={renamingFolder}
        accent={accent}
        onClose={() => setRenamingFolder(null)}
        onSave={handleRenameFolder}
      />
      <RenameFolderModal
        folder={renamingFile ? { id: renamingFile.id, name: renamingFile.original_name } : null}
        accent={accent}
        onClose={() => setRenamingFile(null)}
        onSave={handleRenameFile}
      />

      {confirmModal && (
        <ConfirmModal
          open
          title={confirmModal.title}
          message={confirmModal.message}
          warning={confirmModal.warning}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      <GlobalSearch
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={handleGlobalNavigate}
      />
    </div>
  );
}

function WelcomeView({ subject, folders, foldersLoading, recents, onFolderSelect, onRecentClick, onNewFolder, t }) {
  const accent = subject.color;
  return (
    <div style={{ padding: '32px 28px' }}>
      {/* Recientes section */}
      {recents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
            textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 10,
          }}>{t('sidebar.recents')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {recents.map((r) => (
              <button
                key={r.id}
                onClick={() => onRecentClick(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: 30, padding: '0 12px', border: '1px solid var(--c-border)',
                  borderRadius: 20, background: 'var(--c-surface)', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, color: 'var(--c-text-2)',
                  transition: 'background .1s, color .1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-text-2)'; }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
              {subject.short}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: 'var(--c-text)' }}>
            {t('subject.' + subject.id)}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: 0 }}>
          {t('folders.overview_hint', { n: folders.length })}
        </p>
      </div>

      {foldersLoading ? (
        <div style={{ color: 'var(--c-text-3)', fontSize: 13 }}>{t('loading')}</div>
      ) : folders.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>{t('folders.no_folders_title')}</div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 20 }}>
            {t('folders.no_folders_hint', { subject: t('subject.' + subject.id) })}
          </div>
          <button
            onClick={onNewFolder}
            style={{
              height: 36, padding: '0 20px', border: 'none', borderRadius: 8,
              background: accent, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{t('folders.create')}</button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} accent={accent} onClick={() => onFolderSelect(f)} t={t} />
          ))}
          <button
            onClick={onNewFolder}
            style={{
              height: 88, border: '1.5px dashed var(--c-border)', borderRadius: 10,
              background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6, color: 'var(--c-text-3)', fontSize: 12,
              transition: 'background .1s, color .1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--c-hover)';
              e.currentTarget.style.color = 'var(--c-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--c-text-3)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {t('folders.new_folder_btn')}
          </button>
        </div>
      )}
    </div>
  );
}

function FolderCard({ folder, accent, onClick, t }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: '1px solid var(--c-border)', borderRadius: 10,
        background: 'var(--c-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
        transition: 'box-shadow .15s, transform .1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <div style={{
          width: 32, height: 28, borderRadius: 4, background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="14" viewBox="0 0 24 20" fill="none">
            <path d="M0 4a2 2 0 0 1 2-2h7l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Z"
              fill={accent} opacity="0.92"/>
            <path d="M0 6h24v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6Z" fill={accent}/>
          </svg>
        </div>
        {folder.is_favorite ? <span style={{ fontSize: 12, color: '#F59E0B' }}>★</span> : null}
      </div>
      <div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{folder.name}</div>
        <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 2, fontFamily: '"DM Mono", monospace' }}>
          {folder.group_name} · {t('folders.files', { n: folder.file_count ?? 0 })}
        </div>
      </div>
    </button>
  );
}

function SearchField({ value, onChange, accent, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 30, padding: '0 10px', borderRadius: 7,
      background: 'var(--c-hover)', border: '0.5px solid var(--c-border)',
      fontSize: 12, color: 'var(--c-text-2)',
      minWidth: 160, flex: '1 1 180px', maxWidth: 260,
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: 'none', background: 'transparent', outline: 'none',
          font: 'inherit', fontSize: 12, color: 'var(--c-text)', flex: 1, minWidth: 0,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--c-text-3)', fontSize: 14, lineHeight: 1, padding: 0,
          }}
        >×</button>
      )}
    </div>
  );
}
