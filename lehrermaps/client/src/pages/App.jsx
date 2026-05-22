import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Sidebar from '../components/Sidebar';
import BulkMoveModal from '../components/BulkMoveModal';
import FileTable from '../components/FileTable';
import FilePreview from '../components/FilePreview';
import UploadModal from '../components/UploadModal';
import NewFolderModal from '../components/NewFolderModal';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmModal from '../components/ConfirmModal';
import DeadlineModal from '../components/DeadlineModal';
import GlobalSearch from '../components/GlobalSearch';
import QRModal from '../components/QRModal';
import KeyboardHelp from '../components/KeyboardHelp';
import Schedule from '../components/Schedule';
import { SUBJECTS } from '../constants/structure';
import { useFolders } from '../hooks/useFolders';
import { useFiles } from '../hooks/useFiles';
import { useLinks } from '../hooks/useLinks';
import { useRecents } from '../hooks/useRecents';
import { useRecentFiles } from '../hooks/useRecentFiles';
import { downloadFolderZip, downloadFilesZip, viewFile } from '../lib/api';
import AddLinkModal from '../components/AddLinkModal';
import LinkPreview from '../components/LinkPreview';
import RenameFolderModal from '../components/RenameFolderModal';
import NotesEditor from '../components/NotesEditor';
import FolderGallery from '../components/FolderGallery';
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
  const [filesView, setFilesView] = useState('list');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [deadlineModal, setDeadlineModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const deleteTimersRef = useRef(new Map());
  const [viewMode, setViewMode] = useState('subjects');
  const [dropOver, setDropOver] = useState(false);
  const [dropFiles, setDropFiles] = useState(null);
  const [dropUploading, setDropUploading] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeFile2, setActiveFile2] = useState(null);

  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const { folders, loading: foldersLoading, add: addFolder, remove: removeFolder, rename: renameFolder, reorder: reorderFolders, toggleFavorite, setDeadline: setFolderDeadline, setColor: setFolderColor, reload: reloadFolders } = useFolders();
  const { files, loading: filesLoading, upload, remove: removeFile, rename: renameFileHook, move: moveFileHook, toggleShare, setDeadline: setFileDeadline, togglePublic } = useFiles(activeFolder?.id);
  const { links, add: addLink, remove: removeLink } = useLinks(activeFolder?.id);
  const { recents, add: addRecent } = useRecents();
  const { recentFiles, trackFile } = useRecentFiles();
  const [pendingFileId, setPendingFileId] = useState(null);
  const [pendingLinkId, setPendingLinkId] = useState(null);
  const [folderOpenTick, setFolderOpenTick] = useState(0);
  const [folderZoom, setFolderZoom] = useState(null);
  const [previewHero, setPreviewHero] = useState(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [hapticPulse, setHapticPulse] = useState(null);
  const [backSwipe, setBackSwipe] = useState({ active: false, x: 0 });

  const [previewWidth, setPreviewWidth] = useState(320);
  const dragState = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const sidebarDragState = useRef(null);
  const [newFolderParentId, setNewFolderParentId] = useState(null);
  const contentPaneRef = useRef(null);
  const previewPaneRef = useRef(null);
  const backSwipeRef = useRef({ dragging: false, startX: 0, pointerId: null });
  const pullRef = useRef({ startY: 0, pulling: false, atTop: false });

  useEffect(() => {
    if (!toast) return;
    const tmr = setTimeout(() => setToast(null), toast.duration || 2200);
    return () => clearTimeout(tmr);
  }, [toast]);

  useEffect(() => {
    if (activeFile2 && previewWidth < 520) setPreviewWidth(640);
  }, [activeFile2]);

  useEffect(() => () => {
    for (const timer of deleteTimersRef.current.values()) clearTimeout(timer);
    deleteTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!pendingFileId || !files.length) return;
    const file = files.find((f) => f.id === pendingFileId);
    if (file) { setActiveFile(file); setPendingFileId(null); }
  }, [files, pendingFileId]);

  useEffect(() => {
    if (!pendingLinkId || !links.length) return;
    const link = links.find((l) => l.id === pendingLinkId);
    if (link) { setActiveLink(link); setPendingLinkId(null); }
  }, [links, pendingLinkId]);

  useEffect(() => {
    if (!folderZoom) return;
    const raf = requestAnimationFrame(() => {
      setFolderZoom((prev) => (prev ? { ...prev, phase: 'run' } : prev));
    });
    const t = setTimeout(() => setFolderZoom(null), 430);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [folderZoom]);

  useEffect(() => {
    if (!previewHero) return;
    const raf = requestAnimationFrame(() => {
      setPreviewHero((prev) => (prev ? { ...prev, phase: 'run' } : prev));
    });
    const t = setTimeout(() => setPreviewHero(null), 360);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [previewHero]);

  useEffect(() => {
    if (!hapticPulse) return;
    const t = setTimeout(() => setHapticPulse(null), 240);
    return () => clearTimeout(t);
  }, [hapticPulse]);

  // Keyboard shortcuts: Cmd/Ctrl+P, j/k navigation, space preview toggle
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setKeyboardHelpOpen((v) => !v);
        return;
      }
      if (isTyping || folderTab !== 'files' || !activeFolder || !files.length) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!activeFile) { setActiveFile(files[0]); return; }
        const idx = files.findIndex((f) => f.id === activeFile.id);
        const next = files[Math.min(files.length - 1, idx + 1)];
        if (next) setActiveFile(next);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!activeFile) { setActiveFile(files[0]); return; }
        const idx = files.findIndex((f) => f.id === activeFile.id);
        const prev = files[Math.max(0, idx - 1)];
        if (prev) setActiveFile(prev);
      } else if (e.key === 'Delete' && activeFile) {
        e.preventDefault();
        handleDeleteFile(activeFile);
      } else if (e.key === ' ') {
        e.preventDefault();
        setActiveFile((prev) => (prev ? null : files[0] || null));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeFile, activeFolder, files, folderTab]);

  const onSidebarResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    sidebarDragState.current = { startX: e.clientX, startWidth: sidebarWidth };
    const onMove = (ev) => {
      if (!sidebarDragState.current) return;
      const delta = ev.clientX - sidebarDragState.current.startX;
      const next = Math.min(500, Math.max(180, sidebarDragState.current.startWidth + delta));
      setSidebarWidth(next);
    };
    const onUp = () => {
      sidebarDragState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

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
    setActiveFile2(null);
    setQuery('');
    setViewMode('subjects');
  };

  const onFolderSelect = (folder, sourceRect = null) => {
    setActiveFolder(folder);
    setActiveFile(null);
    setActiveFile2(null);
    setActiveLink(null);
    setQuery('');
    setFolderTab('files');
    const color = SUBJECTS.find((s) => s.id === folder.subject)?.color;
    addRecent(folder, color);
    setFolderOpenTick((v) => v + 1);
    if (sourceRect && contentPaneRef.current) {
      const to = contentPaneRef.current.getBoundingClientRect();
      setFolderZoom({ from: sourceRect, to, accent: color || accent, phase: 'start' });
      setHapticPulse({
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
        color: color || accent,
      });
    }
  };

  const handleGlobalNavigate = (targetSubject, folderId, target = null) => {
    setSubjectId(targetSubject);
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      setActiveFolder(folder);
      setActiveFile(null);
      setActiveLink(null);
      if (target?.type === 'link' && target.id) setPendingLinkId(target.id);
      setQuery('');
      setFolderTab('files');
      const color = SUBJECTS.find((s) => s.id === targetSubject)?.color;
      addRecent(folder, color);
      setFolderOpenTick((v) => v + 1);
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
      setFolderOpenTick((v) => v + 1);
    }
  };

  const handleRecentFileClick = (rf) => {
    setSubjectId(rf.subjectId);
    const folder = folders.find((f) => f.id === rf.folderId);
    if (folder) {
      setActiveFolder(folder);
      setActiveFile(null);
      setActiveLink(null);
      setQuery('');
      setFolderTab('files');
      setPendingFileId(rf.id);
      addRecent(folder, SUBJECTS.find((s) => s.id === folder.subject)?.color);
      setFolderOpenTick((v) => v + 1);
    }
  };

  const handleUpload = async (file, onProgress, signal) => {
    try {
      const newFile = await upload(file, onProgress, signal);
      reloadFolders();
      return newFile;
    } catch (e) {
      if (e.name === 'CanceledError' || e.name === 'AbortError') throw e;
      setToast({ type: 'error', msg: t('toast.upload_error') });
      throw e;
    }
  };

  const triggerHapticAt = useCallback((x, y, color = accent) => {
    setHapticPulse({ x, y, color });
  }, [accent]);

  const closeFolderView = useCallback(() => {
    setActiveFolder(null);
    setActiveFile(null);
    setActiveFile2(null);
    setActiveLink(null);
    setQuery('');
    setBackSwipe({ active: false, x: 0 });
  }, []);

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
    setToast({
      type: failed ? 'error' : 'success',
      msg: failed
        ? t('toast.drop_done_error', { done, total: filesToUpload.length, failed })
        : t('toast.drop_done', { n: done }),
    });
    setTimeout(() => setDropUploading(null), 900);
  }, [activeFolder, reloadFolders, upload]);

  const handleNewFolder = async ({ subject: subjectKey, group_name, name, template, parent_id }) => {
    if (!template || parent_id) {
      await addFolder(subjectKey, group_name, name, parent_id ?? null);
      setNewFolderParentId(null);
      return;
    }
    const templates = {
      abitur: ['Material', 'Übungen', 'Hausaufgaben', 'Klausuren'],
      standard: ['Material', 'Arbeitsblätter', 'Abgaben'],
    };
    const parts = templates[template] || [];
    if (!parts.length) {
      await addFolder(subjectKey, group_name, name);
      setNewFolderParentId(null);
      return;
    }
    for (const part of parts) {
      await addFolder(subjectKey, group_name, `${name} · ${part}`);
    }
    setNewFolderParentId(null);
  };

  const handleDeleteFile = (file) => {
    setConfirmModal({
      title: t('confirm.delete'),
      message: t('confirm.delete_file_msg', { name: file.original_name }),
      onConfirm: async () => {
        setConfirmModal(null);
        enqueueDelete(file);
      },
    });
  };

  const enqueueDelete = (file) => {
    if (!file?.id) return;
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.add(file.id);
      return next;
    });
    if (activeFile?.id === file.id) setActiveFile(null);
    if (activeFile2?.id === file.id) setActiveFile2(null);

    const timer = setTimeout(async () => {
      deleteTimersRef.current.delete(file.id);
      try {
        await removeFile(file.id);
        setToast({ type: 'success', msg: t('toast.file_deleted') });
      } catch {
        setToast({ type: 'error', msg: t('toast.file_delete_error') });
      } finally {
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(file.id);
          return next;
        });
      }
    }, 5200);

    deleteTimersRef.current.set(file.id, timer);
    setToast({
      type: 'warning',
      msg: t('toast.file_delete_pending'),
      actionLabel: t('toast.undo'),
      action: () => undoDelete(file.id),
      duration: 5200,
    });
  };

  const undoDelete = (fileId) => {
    const timer = deleteTimersRef.current.get(fileId);
    if (timer) clearTimeout(timer);
    deleteTimersRef.current.delete(fileId);
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    setToast({ type: 'success', msg: t('toast.undo_done') });
  };

  const handleRenameFile = async (id, name) => {
    const updated = await renameFileHook(id, name);
    if (activeFile?.id === id) setActiveFile(updated);
  };

  const openFolderDeadlineModal = () => {
    if (!activeFolder) return;
    const current = activeFolder.due_at ? new Date(activeFolder.due_at).toISOString().slice(0, 10) : '';
    setDeadlineModal({ type: 'folder', id: activeFolder.id, initialDate: current });
  };

  const handleSetFileDeadline = async (file) => {
    const current = file?.due_at ? new Date(file.due_at).toISOString().slice(0, 10) : '';
    setDeadlineModal({ type: 'file', id: file.id, initialDate: current });
  };

  const handleBulkDeleteFiles = async (selectedFiles) => {
    const fileIds = selectedFiles.map((f) => f.id);
    for (const file of selectedFiles) {
      enqueueDelete(file);
    }
    setToast({
      type: 'warning',
      msg: t('toast.bulk_delete_pending', { n: selectedFiles.length }),
      duration: 5200,
      actionLabel: t('toast.undo'),
      action: () => fileIds.forEach(undoDelete),
    });
  };

  const handleBulkShareFiles = async (selectedFiles) => {
    const toShare = selectedFiles.filter((f) => !f.is_shared);
    if (!toShare.length) return;
    let failed = 0;
    for (const file of toShare) {
      try { await toggleShare(file.id); } catch { failed += 1; }
    }
    if (failed) setToast({ type: 'error', msg: t('toast.bulk_done_error', { failed, total: toShare.length }) });
    else setToast({ type: 'success', msg: t('toast.bulk_done') });
  };

  const handleBulkUnshareFiles = async (selectedFiles) => {
    const toUnshare = selectedFiles.filter((f) => f.is_shared);
    if (!toUnshare.length) return;
    let failed = 0;
    for (const file of toUnshare) {
      try { await toggleShare(file.id); } catch { failed += 1; }
    }
    if (failed) setToast({ type: 'error', msg: t('toast.bulk_done_error', { failed, total: toUnshare.length }) });
    else setToast({ type: 'success', msg: t('toast.bulk_done') });
  };

  const handleBulkDownloadFiles = (selectedFiles) => {
    if (!selectedFiles.length) return;
    window.location.href = downloadFilesZip(selectedFiles.map((f) => f.id));
  };

  const [bulkMoveFiles, setBulkMoveFiles] = useState(null); // array of files to move
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');

  const handleBulkMoveFiles = (selectedFiles) => {
    setBulkMoveFiles(selectedFiles);
    setBulkMoveTarget('');
  };

  const executeBulkMove = async () => {
    if (!bulkMoveTarget || !bulkMoveFiles?.length) return;
    const targetId = Number(bulkMoveTarget);
    let failed = 0;
    for (const file of bulkMoveFiles) {
      try { await moveFileHook(file.id, targetId); } catch { failed += 1; }
    }
    setBulkMoveFiles(null);
    if (failed) setToast({ type: 'error', msg: t('toast.bulk_done_error', { failed, total: bulkMoveFiles.length }) });
    else {
      const target = folders.find((f) => f.id === targetId);
      setToast({ type: 'success', msg: t('toast.file_moved', { folder: target?.name || '…' }) });
    }
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
        try {
          await removeFolder(folder.id);
          if (activeFolder?.id === folder.id) {
            setActiveFolder(null);
            setActiveFile(null);
            setActiveLink(null);
          }
          setToast({ type: 'success', msg: t('toast.folder_deleted') });
        } catch {
          setToast({ type: 'error', msg: t('toast.folder_delete_error') });
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

  const handleMoveFileToFolder = async (fileId, targetFolderId) => {
    if (!activeFolder || activeFolder.id === targetFolderId) return;
    try {
      await moveFileHook(fileId, targetFolderId);
      if (activeFile?.id === fileId) setActiveFile(null);
      reloadFolders();
      const targetFolder = folders.find((f) => f.id === targetFolderId);
      setToast({ type: 'success', msg: t('toast.file_moved', { folder: targetFolder?.name || '—' }) });
    } catch {
      setToast({ type: 'error', msg: t('toast.file_move_error') });
    }
  };

  const accent = subject.color;
  const subjectFolders = folders.filter((f) => f.subject === subjectId);
  const filteredCount = query
    ? files.filter((f) => f.original_name.toLowerCase().includes(query.toLowerCase())).length
    : null;

  const hasModalOpen = globalSearchOpen || uploadOpen || addLinkOpen || newFolderOpen || !!renamingFolder || !!renamingFile || !!bulkMoveFiles || !!confirmModal || !!deadlineModal || keyboardHelpOpen || qrOpen;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--c-bg)', color: 'var(--c-text)',
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      fontFeatureSettings: '"ss01", "cv11"',
    }}>
      <div className={hasModalOpen ? 'lm-depth-scene' : ''} style={{ display: 'contents' }}>
      {/* Tab bar */}
      <div className="lm-tabbar" style={{
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
              className="lm-spring"
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
          className="lm-spring"
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
            className="lm-spring"
            onClick={() => setGlobalSearchOpen(true)}
            onMouseDown={(e) => triggerHapticAt(e.clientX, e.clientY, accent)}
            title="Suche (⌘P)"
            style={{
              width: 30, height: 30, padding: 0, border: '0.5px solid var(--c-border)', borderRadius: 7,
              background: 'var(--c-hover)', color: 'var(--c-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-border)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
          >
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Lang toggle */}
          <button
            className="lm-spring"
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
            className="lm-spring"
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
            className="lm-spring"
            onClick={() => setUploadOpen(true)}
            onMouseDown={(e) => { if (activeFolder) triggerHapticAt(e.clientX, e.clientY, accent); }}
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
            className="lm-spring"
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
      <div
        style={{ flex: 1, minHeight: 0, display: 'flex' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          setParallax({ x: nx, y: ny });
        }}
        onMouseLeave={() => setParallax({ x: 0, y: 0 })}
      >
        {viewMode === 'schedule' ? (
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Schedule onNavigate={(subjectId) => { onSubjectChange(subjectId); }} />
          </div>
        ) : <>
        <div style={{ transform: `translate3d(${parallax.x * -4}px, ${parallax.y * -2}px, 0)`, transition: 'transform .25s cubic-bezier(.2,.8,.2,1)' }}>
          <Sidebar
            subject={subject}
            groups={subject.groups}
            folders={subjectFolders}
            loading={foldersLoading}
            width={sidebarWidth}
            activeFolderId={activeFolder?.id}
            onFolderSelect={onFolderSelect}
            onNewFolder={() => { setNewFolderGroup(null); setNewFolderOpen(true); }}
            onNewFolderInGroup={(g) => { setNewFolderGroup(g); setNewFolderOpen(true); }}
            onNewSubfolder={(folder) => { setNewFolderParentId(folder.id); setNewFolderGroup(folder.group_name); setNewFolderOpen(true); }}
            onRenameFolder={setRenamingFolder}
            onDeleteFolder={handleDeleteFolder}
            onReorderFolders={reorderFolders}
            onToggleFavorite={toggleFavorite}
            onSetFolderColor={setFolderColor}
            onMoveFileToFolder={handleMoveFileToFolder}
            recentFiles={recentFiles}
            onRecentFileClick={handleRecentFileClick}
          />
        </div>
        <div
          onMouseDown={onSidebarResizeMouseDown}
          style={{
            width: 4, flexShrink: 0, cursor: 'col-resize',
            background: 'transparent', position: 'relative',
            transition: 'background .15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = accent + '55'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        />

        <div
          ref={contentPaneRef}
          style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}
          onPointerDown={(e) => {
            if (!activeFolder || e.pointerType === 'mouse' && e.clientX > 28) return;
            if (e.clientX > 28) return;
            backSwipeRef.current = { dragging: true, startX: e.clientX, pointerId: e.pointerId };
            setBackSwipe({ active: true, x: 0 });
          }}
          onPointerMove={(e) => {
            if (!backSwipeRef.current.dragging) return;
            const delta = Math.max(0, e.clientX - backSwipeRef.current.startX);
            setBackSwipe({ active: true, x: Math.min(delta, 260) });
          }}
          onPointerUp={() => {
            if (!backSwipeRef.current.dragging) return;
            const shouldBack = backSwipe.x > 110;
            backSwipeRef.current.dragging = false;
            if (shouldBack) {
              closeFolderView();
            } else {
              setBackSwipe({ active: false, x: 0 });
            }
          }}
          onTouchStart={(e) => {
            const el = e.currentTarget;
            pullRef.current.atTop = el.scrollTop <= 0;
            pullRef.current.startY = e.touches[0].clientY;
            pullRef.current.pulling = pullRef.current.atTop && !activeFolder;
          }}
          onTouchMove={(e) => {
            if (!pullRef.current.pulling) return;
            const dy = e.touches[0].clientY - pullRef.current.startY;
            if (dy > 70) {
              pullRef.current.pulling = false;
              setGlobalSearchOpen(true);
            }
          }}
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
                  ? t(dropUploading.failed ? 'toast.drop_overlay_error' : 'toast.drop_overlay', {
                    done: dropUploading.done,
                    total: dropUploading.total,
                    failed: dropUploading.failed,
                  })
                  : t('modal.upload.drop_active')}
              </span>
            </div>
          )}
          {activeFolder ? (
            <div
              key={`folder-open-${activeFolder.id}-${folderOpenTick}`}
              className="lm-folder-open-shell"
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transform: `translate3d(${parallax.x * 2 + (backSwipe.active ? backSwipe.x : 0)}px, ${parallax.y * 1.5}px, 0)`,
                transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
              }}
            >
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
                      onClick={openFolderDeadlineModal}
                      style={{
                        marginLeft: 8, height: 26, padding: '0 10px',
                        borderRadius: 6, background: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                        color: activeFolder?.due_at && new Date(activeFolder.due_at) < new Date() ? '#EF4444' : 'var(--c-text-3)',
                        border: activeFolder?.due_at && new Date(activeFolder.due_at) < new Date() ? '1px solid #EF444455' : '1px solid var(--c-border)',
                      }}
                    >
                      ⏰ {activeFolder?.due_at ? new Date(activeFolder.due_at).toLocaleDateString('de-DE') : t('table.deadline')}
                    </button>
                    <button
                      onClick={() => setQrOpen(true)}
                      title={t('qr.student_access')}
                      style={{
                        marginLeft: 8, height: 26, padding: '0 10px',
                        border: '1px solid var(--c-border)', borderRadius: 6,
                        background: 'transparent', color: 'var(--c-text-3)',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontFamily: 'inherit', transition: 'background .1s, color .1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                        <rect x="7" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                        <rect x="1" y="7" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M7 8h1v1H7zM9 8h2M9 10h2M7 10h1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                      </svg>
                      QR
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
                        className="lm-spring"
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
                    <div style={{ marginLeft: 'auto', alignSelf: 'center', paddingRight: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="lm-spring"
                        onClick={() => setFilesView((v) => (v === 'list' ? 'gallery' : 'list'))}
                        style={{ height: 24, padding: '0 10px', border: '1px solid var(--c-border)', borderRadius: 6, background: 'transparent', color: 'var(--c-text-2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {filesView === 'list' ? t('table.gallery') : t('table.list')}
                      </button>
                      <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                        {filteredCount !== null
                          ? t('files.filter', { filtered: filteredCount, total: files.length, q: query })
                          : (files.length === 1
                              ? t('files.count_one', { n: 1 })
                              : t('files.count_many', { n: files.length }))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, minHeight: 0, overflow: folderTab === 'files' ? 'auto' : 'hidden' }}>
                {folderTab === 'files' ? (
                  <div style={{ padding: '18px 28px' }}>
                    {filesLoading ? (
                      <FilesSkeleton />
                    ) : filesView === 'gallery' ? (
                      <FolderGallery
                        files={files}
                        activeFileId={activeFile?.id}
                        onSelect={(f) => { setActiveFile(f); setActiveLink(null); trackFile(f, activeFolder?.id, subjectId); }}
                        accent={accent}
                      />
                    ) : (
                      <FileTable
                        key={activeFolder?.id}
                        files={files}
                        hiddenIds={pendingDeleteIds}
                        links={links}
                        activeFileId={activeFile?.id}
                        activeFile2Id={activeFile2?.id}
                        activeLinkId={activeLink?.id}
                        onFileSelect={(f, meta) => {
                          setActiveFile(f);
                          setActiveLink(null);
                          trackFile(f, activeFolder?.id, subjectId);
                          const from = meta?.sourceRect;
                          const to = previewPaneRef.current?.getBoundingClientRect();
                          if (from && to) setPreviewHero({ from, to, accent, phase: 'start' });
                        }}
                        onFileSecondarySelect={(f) => { setActiveFile2(f); trackFile(f, activeFolder?.id, subjectId); }}
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
                        onFileDragStart={(file) => {
                          if (!activeFile || activeFile.id !== file.id) {
                            setActiveFile(file);
                            setActiveLink(null);
                          }
                        }}
                        onBulkDelete={handleBulkDeleteFiles}
                        onBulkShare={handleBulkShareFiles}
                        onBulkUnshare={handleBulkUnshareFiles}
                        onBulkDownload={handleBulkDownloadFiles}
                        onBulkMove={handleBulkMoveFiles}
                      />
                    )}
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

        {/* Preview panel — resizable, optional split */}
        {activeFolder && (
          <div
            style={{
              width: previewWidth, flexShrink: 0, display: 'flex', overflow: 'hidden',
              transform: `translate3d(${parallax.x * 3}px, ${parallax.y * 1.5}px, 0)`,
              transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
            }}
          >
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
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}>
              {/* Slot 1 */}
              <div
                ref={previewPaneRef}
                style={{
                flex: 1, minWidth: 0, overflow: 'hidden',
                borderRight: activeFile2 ? '1px solid var(--c-border)' : 'none',
              }}>
                {activeLink
                  ? <LinkPreview link={activeLink} accent={accent} onDelete={handleDeleteLink} />
                  : <FilePreview
                      file={activeFile}
                      accent={accent}
                      onClose={activeFile2 ? () => { setActiveFile(activeFile2); setActiveFile2(null); } : null}
                    />
                }
              </div>
              {/* Slot 2 */}
              {activeFile2 && (
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <FilePreview
                    file={activeFile2}
                    accent={accent}
                    onClose={() => setActiveFile2(null)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        </>}
      </div>
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
      {hasModalOpen && <div className="lm-depth-overlay" />}
      {folderZoom && (
        <div
          style={{
            position: 'fixed',
            left: folderZoom.phase === 'run' ? folderZoom.to.left : folderZoom.from.left,
            top: folderZoom.phase === 'run' ? folderZoom.to.top : folderZoom.from.top,
            width: folderZoom.phase === 'run' ? folderZoom.to.width : folderZoom.from.width,
            height: folderZoom.phase === 'run' ? folderZoom.to.height : folderZoom.from.height,
            borderRadius: folderZoom.phase === 'run' ? 0 : 14,
            background: `${folderZoom.accent}22`,
            border: `1px solid ${folderZoom.accent}55`,
            boxShadow: `0 18px 42px ${folderZoom.accent}33`,
            transition: 'all .42s cubic-bezier(.2,.9,.2,1)',
            pointerEvents: 'none',
            zIndex: 1500,
            opacity: folderZoom.phase === 'run' ? 0 : 1,
          }}
        />
      )}
      {previewHero && (
        <div
          style={{
            position: 'fixed',
            left: previewHero.phase === 'run' ? previewHero.to.left + 12 : previewHero.from.left,
            top: previewHero.phase === 'run' ? previewHero.to.top + 12 : previewHero.from.top,
            width: previewHero.phase === 'run' ? Math.max(120, previewHero.to.width - 24) : previewHero.from.width,
            height: previewHero.phase === 'run' ? 74 : previewHero.from.height,
            borderRadius: 10,
            background: `${previewHero.accent}16`,
            border: `1px solid ${previewHero.accent}66`,
            transition: 'all .34s cubic-bezier(.2,.9,.2,1)',
            pointerEvents: 'none',
            zIndex: 1499,
            opacity: previewHero.phase === 'run' ? 0 : 0.96,
          }}
        />
      )}
      {hapticPulse && (
        <div
          style={{
            position: 'fixed',
            left: hapticPulse.x - 22,
            top: hapticPulse.y - 22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: `1px solid ${hapticPulse.color}99`,
            background: `${hapticPulse.color}22`,
            boxShadow: `0 0 0 8px ${hapticPulse.color}22`,
            animation: 'lmHapticPulse .24s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 1700,
          }}
        />
      )}

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => { setNewFolderOpen(false); setNewFolderParentId(null); }}
        onSave={handleNewFolder}
        subject={subject}
        defaultGroup={newFolderGroup}
        parentFolder={newFolderParentId ? folders.find((f) => f.id === newFolderParentId) ?? null : null}
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

      {bulkMoveFiles && (
        <BulkMoveModal
          files={bulkMoveFiles}
          folders={folders.filter((f) => f.id !== activeFolder?.id)}
          targetId={bulkMoveTarget}
          onTargetChange={setBulkMoveTarget}
          onConfirm={executeBulkMove}
          onClose={() => setBulkMoveFiles(null)}
          accent={accent}
          t={t}
        />
      )}

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
      {keyboardHelpOpen && <KeyboardHelp onClose={() => setKeyboardHelpOpen(false)} />}
      {qrOpen && (
        <QRModal
          url={window.location.origin + '/?student'}
          title={t('qr.student_access')}
          onClose={() => setQrOpen(false)}
        />
      )}
      <DeadlineModal
        open={!!deadlineModal}
        title={deadlineModal?.type === 'folder' ? t('modal.deadline.folder_title') : t('modal.deadline.file_title')}
        initialDate={deadlineModal?.initialDate}
        accent={accent}
        onClose={() => setDeadlineModal(null)}
      onSave={async (value) => {
          if (!deadlineModal) return;
          const due_at = value?.trim() ? `${value.trim()} 23:59:59` : null;
          try {
            if (deadlineModal.type === 'folder') {
              const updated = await setFolderDeadline(deadlineModal.id, due_at);
              setActiveFolder(updated);
              setToast({ type: 'success', msg: t('toast.deadline_saved') });
            } else {
              const updated = await setFileDeadline(deadlineModal.id, due_at);
              if (activeFile?.id === deadlineModal.id) setActiveFile(updated);
              setToast({ type: 'success', msg: t('toast.deadline_saved') });
            }
          } catch {
            setToast({ type: 'error', msg: t('toast.deadline_error') });
          } finally {
            setDeadlineModal(null);
          }
        }}
      />
      {toast && (
        <div style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 1300,
          minWidth: 220, maxWidth: 360, padding: '10px 12px',
          borderRadius: 8, border: '1px solid var(--c-border-soft)',
          background: toast.type === 'error'
            ? 'var(--c-danger-bg)'
            : toast.type === 'warning'
              ? 'rgba(245,158,11,0.14)'
              : 'var(--c-surface)',
          color: toast.type === 'error'
            ? 'var(--c-danger-text)'
            : toast.type === 'warning'
              ? '#92400E'
              : 'var(--c-text)',
          boxShadow: 'var(--c-shadow-pop)', fontSize: 12, fontWeight: 600,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>{toast.msg}</span>
            {toast.action && toast.actionLabel && (
              <button
                onClick={toast.action}
                style={{
                  border: '1px solid var(--c-border)', background: 'transparent',
                  borderRadius: 6, height: 24, padding: '0 8px', cursor: 'pointer',
                  fontSize: 11, fontFamily: 'inherit', color: 'inherit',
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilesSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, padding: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="lm-skeleton-shimmer" style={{ height: 64, borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)' }} />
      ))}
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} accent={accent} onClick={(rect) => onFolderSelect(f, rect)} t={t} />
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

const SUBJECT_COVERS = {
  spanisch: {
    gradient: 'linear-gradient(145deg, #7c2d12 0%, #c2410c 38%, #ea580c 68%, #fb923c 100%)',
    orb1: 'rgba(251,146,60,0.25)', orb2: 'rgba(124,45,18,0.4)',
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M6 8h24a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H16l-6 6v-6H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z"
          fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4"/>
        <path d="M22 8v24M6 8l8 12 8-12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="34" cy="12" r="7" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
        <path d="M31 12h6M34 9v6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  informatik: {
    gradient: 'linear-gradient(145deg, #0f2150 0%, #1d4ed8 40%, #3b82f6 72%, #22d3ee 110%)',
    orb1: 'rgba(34,211,238,0.2)', orb2: 'rgba(15,33,80,0.5)',
    icon: (
      <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
        <path d="M14 8L4 18l10 10" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M34 8l10 10-10 10" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M28 4L20 32" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  sport: {
    gradient: 'linear-gradient(145deg, #14532d 0%, #15803d 40%, #16a34a 70%, #4ade80 110%)',
    orb1: 'rgba(74,222,128,0.2)', orb2: 'rgba(20,83,45,0.45)',
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="15" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
        <path d="M22 7c0 0-5 6-5 15s5 15 5 15" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3"/>
        <path d="M7 22h30" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3"/>
        <path d="M10 12c4 2 8 3 12 3s8-1 12-3M10 32c4-2 8-3 12-3s8 1 12 3"
          stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  klasse: {
    gradient: 'linear-gradient(145deg, #3b0764 0%, #7c3aed 42%, #9333ea 70%, #c084fc 110%)',
    orb1: 'rgba(192,132,252,0.22)', orb2: 'rgba(59,7,100,0.45)',
    icon: (
      <svg width="46" height="40" viewBox="0 0 46 40" fill="none">
        <path d="M23 4L2 16l21 12 21-12z" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M8 22v10c0 0 5 6 15 6s15-6 15-6V22" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M40 16v12" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="40" cy="30" r="2.5" fill="rgba(255,255,255,0.5)"/>
      </svg>
    ),
  },
};

function FolderCard({ folder, accent, onClick, t }) {
  const cover = SUBJECT_COVERS[folder.subject] || SUBJECT_COVERS.klasse;

  return (
    <button
      onClick={(e) => onClick?.(e.currentTarget.getBoundingClientRect())}
      className="lm-spring"
      style={{
        appearance: 'none', border: '1px solid var(--c-border)', borderRadius: 14,
        background: 'var(--c-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'box-shadow .18s, transform .12s',
        animation: 'lmStaggerIn .42s cubic-bezier(.22,.9,.2,1) both',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,0.16), 0 0 0 1px ${accent}44`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Cover area */}
      {folder.thumbnail_file_id ? (
        <div style={{ width: '100%', height: 112, overflow: 'hidden', background: 'var(--c-surface-2)', flexShrink: 0 }}>
          <img
            src={viewFile(folder.thumbnail_file_id)}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div style={{
          width: '100%', height: 112, flexShrink: 0,
          background: cover.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Orbs */}
          <div style={{
            position: 'absolute', top: -24, right: -24, width: 96, height: 96,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${cover.orb1} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -20, left: -16, width: 72, height: 72,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${cover.orb2} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          {/* Grid texture */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.05,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            pointerEvents: 'none',
          }} />
          {/* Icon */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cover.icon}
          </div>
          {/* Group label badge */}
          <div style={{
            position: 'absolute', bottom: 8, left: 10,
            background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 6, padding: '2px 7px',
            fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
            letterSpacing: 0.4, textTransform: 'uppercase',
          }}>
            {folder.group_name}
          </div>
          {/* File count badge */}
          {folder.file_count > 0 && (
            <div style={{
              position: 'absolute', bottom: 8, right: 10,
              background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 6, padding: '2px 7px',
              fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
              fontFamily: '"DM Mono", monospace',
            }}>
              {folder.file_count}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '10px 13px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: accent, flexShrink: 0 }} />
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
          }}>{folder.name}</div>
          {folder.is_favorite ? <span style={{ fontSize: 11, color: '#F59E0B', flexShrink: 0 }}>★</span> : null}
        </div>
        {folder.due_at && (
          <div style={{
            fontSize: 9.5, color: new Date(folder.due_at) < new Date() ? '#EF4444' : 'var(--c-text-3)',
            fontFamily: '"DM Mono", monospace', marginTop: 1,
          }}>
            ⏰ {new Date(folder.due_at).toLocaleDateString('de-DE')}
          </div>
        )}
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
