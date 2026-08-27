import { lazy, Suspense, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Sidebar from '../components/Sidebar';
import BulkMoveModal from '../components/BulkMoveModal';
import FileTable, { MATERIAL_ROLES } from '../components/FileTable';
import FilePreview from '../components/FilePreview';
import UploadModal from '../components/UploadModal';
import NewFolderModal from '../components/NewFolderModal';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmModal from '../components/ConfirmModal';
import DeadlineModal from '../components/DeadlineModal';
import TimerModal from '../components/TimerModal';
import GlobalSearch from '../components/GlobalSearch';
import SearchModal from '../components/SearchModal';
import KeyboardHelp from '../components/KeyboardHelp';
import { SUBJECTS, detectKind, compareFolderNames } from '../constants/structure';
import { useFolders } from '../hooks/useFolders';
import { useFiles } from '../hooks/useFiles';
import { useLinks } from '../hooks/useLinks';
import { useRecentFiles } from '../hooks/useRecentFiles';
import { downloadFolderZip, downloadFilesZip, getLessonSessions, viewFile } from '../lib/api';
import AddLinkModal from '../components/AddLinkModal';
import LinkPreview from '../components/LinkPreview';
import RenameFolderModal from '../components/RenameFolderModal';
import TodayDashboard from '../components/TodayDashboard';
import FolderGallery from '../components/FolderGallery';
import FolderIcon from '../components/FolderIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { useNotebook } from '../contexts/NotebookContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { MobileBottomNav, MobileMoreSheet, navIcons } from '../components/MobileNav';
import TeachingMode from '../components/TeachingMode';
import LessonDashboard from '../components/LessonDashboard';

// Opened views are split into on-demand chunks without changing their layout.
const Schedule = lazy(() => import('../components/Schedule'));
const ExamBoard = lazy(() => import('../components/ExamBoard'));
const NotesEditor = lazy(() => import('../components/NotesEditor'));
const AnnualPlanning = lazy(() => import('../components/AnnualPlanning'));
const PageCanvas = lazy(() => import('../components/Canvas/PageCanvas'));
const FocusMode = lazy(() => import('../components/FocusMode'));

export default function App({ onLogout }) {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { t } = useLang();
  const { activePageId, setActivePageId } = useNotebook();
  const isMobile = useIsMobile();
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

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
  const [folderTab, setFolderTab] = useState('files');
  const [filesView, setFilesView] = useState('list');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [oneNoteSearchOpen, setOneNoteSearchOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [deadlineModal, setDeadlineModal] = useState(null);
  const [timerModal, setTimerModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const deleteTimersRef = useRef(new Map());
  const [viewMode, setViewMode] = useState('subjects');
  const [examBoardOpen, setExamBoardOpen] = useState(false);
  const [dropOver, setDropOver] = useState(false);
  const [dropFiles, setDropFiles] = useState(null);
  const [dropUploading, setDropUploading] = useState(null);
  const [activeFile2, setActiveFile2] = useState(null);
  const [hoveredFile, setHoveredFile] = useState(null);
  const [hoveredFolder, setHoveredFolder] = useState(null);
  const [kbdMarkedFileId, setKbdMarkedFileId] = useState(null);
  const [kbdMarkedFolderId, setKbdMarkedFolderId] = useState(null);
  const [folderLessonSessions, setFolderLessonSessions] = useState([]);
  const [lessonSessions, setLessonSessions] = useState([]);
  const [teachingMode, setTeachingMode] = useState(false);
  const [startNewLessonPlanning, setStartNewLessonPlanning] = useState(false);

  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const accent = subject.color;
  const { folders, loading: foldersLoading, add: addFolder, remove: removeFolder, rename: renameFolder, reorder: reorderFolders, toggleFavorite, setDeadline: setFolderDeadline, setColor: setFolderColor, moveToParent: moveFolderToParent, reload: reloadFolders } = useFolders();
  const { files, loading: filesLoading, upload, remove: removeFile, rename: renameFileHook, move: moveFileHook, toggleShare, setDeadline: setFileDeadline, setTimer: setFileTimer, togglePublic, setRole: setFileRole, setBulkRole: setFilesRole, commitVersion: commitFileVersion } = useFiles(activeFolder?.id);
  const { links, add: addLink, remove: removeLink, toggleShare: toggleLinkShare } = useLinks(activeFolder?.id);
  const { trackFile, trackLink } = useRecentFiles();

  useEffect(() => {
    if (!activeFolder?.id) { setFolderLessonSessions([]); return undefined; }
    let cancelled = false;
    getLessonSessions()
      .then((sessions) => {
        if (!cancelled) setFolderLessonSessions((sessions || []).filter((session) => Number(session.folder_id) === Number(activeFolder.id)));
      })
      .catch(() => { if (!cancelled) setFolderLessonSessions([]); });
    return () => { cancelled = true; };
  }, [activeFolder?.id]);
  useEffect(() => { getLessonSessions().then((sessions) => setLessonSessions(sessions || [])).catch(() => setLessonSessions([])); }, [teachingMode]);
  const subjectFolders = folders.filter((f) => f.subject === subjectId);
  const subjectRootFolders = subjectFolders.filter((f) => !f.parent_id);
  // Ahnenkette des aktiven Ordners (Wurzel → aktiv) für den Breadcrumb
  const activeFolderPath = (() => {
    if (!activeFolder) return [];
    const byId = new Map(folders.map((f) => [f.id, f]));
    const chain = [];
    let cur = byId.get(activeFolder.id) || activeFolder;
    let guard = 0;
    while (cur && guard++ < 20) {
      chain.unshift(cur);
      cur = cur.parent_id != null ? byId.get(cur.parent_id) : null;
    }
    return chain;
  })();
  const planningFolder = activeFolderPath[0] || activeFolder;
  // Direkte Unterordner des aktiven Ordners (gleiche Sortierung wie im Sidebar-Baum)
  const childFolders = activeFolder
    ? folders
        .filter((f) => (f.parent_id ?? null) === activeFolder.id)
        .sort((a, b) =>
          ((a.sort_order || 0) - (b.sort_order || 0)) ||
          compareFolderNames(a, b))
    : [];
  const [pendingFileId, setPendingFileId] = useState(null);
  const [pendingLinkId, setPendingLinkId] = useState(null);
  const [folderOpenTick, setFolderOpenTick] = useState(0);
  const [folderZoom, setFolderZoom] = useState(null);
  const [previewHero, setPreviewHero] = useState(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [hapticPulse, setHapticPulse] = useState(null);
  const [backSwipe, setBackSwipe] = useState({ active: false, x: 0 });
  const [heroQrLink, setHeroQrLink] = useState(null);
  const [focusMode, setFocusMode] = useState(false);

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
    if (activeFolder) setHoveredFolder(null);
  }, [activeFolder]);

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
      if (e.key === 'Escape' && document.fullscreenElement) {
        e.preventDefault();
        document.exitFullscreen();
        return;
      }
      if (globalSearchOpen || oneNoteSearchOpen || uploadOpen || addLinkOpen || newFolderOpen || !!confirmModal || !!deadlineModal || keyboardHelpOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }
      // ⌘K abre la búsqueda global (contrato documentado en KeyboardHelp).
      // Ctrl+K queda para la búsqueda de notas (OneNote) en Windows/Linux.
      if (e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOneNoteSearchOpen(true);
        return;
      }
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setKeyboardHelpOpen((v) => !v);
        return;
      }
      const isSpaceKey = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      if (isSpaceKey && isTyping) return;
      if (isSpaceKey) {
        e.preventDefault();
        e.stopPropagation();
        if (activeFolder && folderTab === 'files' && files.length) {
          const targetFile = files.find((f) => f.id === kbdMarkedFileId) || hoveredFile || activeFile || files[0] || null;
          if (!targetFile) return;
          setActiveLink(null);
          setActiveFile(targetFile);
          return;
        }
        if (!activeFolder) {
          const targetFolder = subjectRootFolders.find((f) => f.id === kbdMarkedFolderId) || hoveredFolder;
          if (targetFolder) onFolderSelect(targetFolder);
        }
        return;
      }

      if (!isTyping && !activeFolder && subjectRootFolders.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const idx = subjectRootFolders.findIndex((f) => f.id === kbdMarkedFolderId);
        const base = idx >= 0 ? idx : -1;
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(subjectRootFolders.length - 1, base + 1)
          : Math.max(0, (base < 0 ? 0 : base - 1));
        const nextFolder = subjectRootFolders[nextIdx];
        if (nextFolder) {
          setKbdMarkedFolderId(nextFolder.id);
          setHoveredFolder(nextFolder);
        }
        return;
      }

      if (isTyping || folderTab !== 'files' || !activeFolder || !files.length) return;
      if (e.key === 'Delete' && activeFile) {
        e.preventDefault();
        handleDeleteFile(activeFile);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const targetFile = hoveredFile || activeFile || files[0] || null;
        if (!targetFile) return;
        setActiveLink(null);
        setActiveFile(targetFile);
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeFile, activeFolder, files, folderTab, hoveredFile, hoveredFolder, kbdMarkedFileId, kbdMarkedFolderId, subjectRootFolders, globalSearchOpen, oneNoteSearchOpen, uploadOpen, addLinkOpen, newFolderOpen, confirmModal, deadlineModal, keyboardHelpOpen]);

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

  const onSubjectChange = (id) => {
    setSubjectId(id);
    setActivePageId(null);
    setActiveFolder(null);
    setActiveFile(null);
    setActiveFile2(null);
    setQuery('');
    setViewMode('subjects');
  };

  const onFolderSelect = (folder, sourceRect = null) => {
    setActivePageId(null);
    setActiveFolder(folder);
    setActiveFile(null);
    setActiveFile2(null);
    setActiveLink(null);
    setQuery('');
    setFolderTab('files');
    const color = SUBJECTS.find((s) => s.id === folder.subject)?.color;
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
      setFolderOpenTick((v) => v + 1);
    }
    setGlobalSearchOpen(false);
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

  const handleSetFileTimer = (file) => {
    setTimerModal({ id: file.id, initialMinutes: file.timer_minutes || '' });
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

  const handleSetFileRole = async (fileId, role) => {
    try {
      const updated = await setFileRole(fileId, role);
      if (activeFile?.id === fileId) setActiveFile(updated);
      if (activeFile2?.id === fileId) setActiveFile2(updated);
      setToast({ type: 'success', msg: t('toast.role_saved') });
    } catch {
      setToast({ type: 'error', msg: t('toast.role_error') });
    }
  };

  const handleBulkSetFileRole = async (selectedFiles, role) => {
    try {
      await setFilesRole(selectedFiles, role);
      setToast({ type: 'success', msg: t('toast.role_saved') });
    } catch {
      setToast({ type: 'error', msg: t('toast.role_error') });
    }
  };

  const handleCommitFileVersion = async (fileId, file) => {
    const updated = await commitFileVersion(fileId, file);
    setActiveFile(updated);
    setActiveFile2(null);
    setToast({ type: 'success', msg: t('toast.version_saved') });
    return updated;
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

  const handleAddLink = async (title, url, is_shared) => {
    await addLink(title, url, is_shared);
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

  const handleMoveFolder = async (folderId, targetFolderId, placement = 'inside') => {
    if (!folderId || folderId === targetFolderId) return;
    try {
      await moveFolderToParent(folderId, targetFolderId, placement);
      await reloadFolders();
      const targetFolder = folders.find((folder) => folder.id === targetFolderId);
      const message = placement === 'inside'
        ? `Ordner nach „${targetFolder?.name || 'Zielordner'}“ verschachtelt`
        : `Ordner ${placement === 'before' ? 'davor' : 'danach'} verschoben`;
      setToast({ type: 'success', msg: message });
    } catch {
      setToast({ type: 'error', msg: 'Ordner konnte nicht verschoben werden' });
    }
  };

  const isCompactPreview = !!activeLink || detectKind(activeFile?.original_name) === 'video';
  const effectivePreviewWidth = isCompactPreview ? Math.min(previewWidth, 280) : previewWidth;
  const filteredCount = query
    ? files.filter((f) => f.original_name.toLowerCase().includes(query.toLowerCase())).length
    : null;

  const hasModalOpen = globalSearchOpen || oneNoteSearchOpen || uploadOpen || addLinkOpen || newFolderOpen || !!renamingFolder || !!renamingFile || !!bulkMoveFiles || !!confirmModal || !!deadlineModal || !!timerModal || keyboardHelpOpen;

  // Props geteilt zwischen der festen Desktop-Sidebar und der mobilen Drawer-Variante
  const sidebarProps = {
    subject,
    subjects: SUBJECTS,
    groups: subject.groups,
    folders: subjectFolders,
    loading: foldersLoading,
    activeSubjectId: subjectId,
    onSubjectSelect: onSubjectChange,
    activeFolderId: activeFolder?.id,
    onNewFolder: () => { setNewFolderGroup(null); setNewFolderOpen(true); },
    onNewFolderInGroup: (g) => { setNewFolderGroup(g); setNewFolderOpen(true); },
    onMoveFolder: handleMoveFolder,
    onNewHauptordner: (folder) => { setNewFolderParentId(null); setNewFolderGroup(folder.group_name); setNewFolderOpen(true); },
    onNewOrdner: (folder) => { setNewFolderParentId(folder.parent_id ?? null); setNewFolderGroup(folder.group_name); setNewFolderOpen(true); },
    onNewSubfolder: (folder) => { setNewFolderParentId(folder.id); setNewFolderGroup(folder.group_name); setNewFolderOpen(true); },
    onRenameFolder: setRenamingFolder,
    onDeleteFolder: handleDeleteFolder,
    onReorderFolders: reorderFolders,
    onToggleFavorite: toggleFavorite,
    onSetFolderColor: setFolderColor,
    onMoveFileToFolder: handleMoveFileToFolder,
  };

  return (
    <Suspense fallback={null}>
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
        minHeight: 56, overflowX: 'auto', overflowY: 'visible',
      }}>
        {isMobile && (
          <button
            className="lm-spring"
            onClick={() => setSidebarDrawerOpen(true)}
            title={t('sidebar.expand')}
            aria-label={t('sidebar.expand')}
            style={{
              flexShrink: 0, width: 34, height: 34, marginBottom: 10,
              border: '1px solid var(--c-border)', borderRadius: 8,
              background: 'var(--c-surface)', color: 'var(--c-text-2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1.5 4h12M1.5 7.5h12M1.5 11h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Mobil wandern Stundenplan/Termine/Notion/Miro in Bottom-Nav + Mehr-Sheet */}
        {!isMobile && <>
        {/* Heute / Startseite */}
        <button
          className="lm-spring"
          onClick={() => { setViewMode('today'); setActivePageId(null); closeFolderView(); }}
          style={{
            appearance: 'none', border: 'none', font: 'inherit',
            padding: '10px 16px 12px', cursor: 'pointer',
            background: viewMode === 'today' ? 'var(--c-surface)' : 'transparent',
            borderRadius: '10px 10px 0 0', marginBottom: viewMode === 'today' ? -1 : 0,
            display: 'flex', alignItems: 'center', gap: 8,
            borderLeft: viewMode === 'today' ? '1px solid var(--c-border)' : '1px solid transparent',
            borderRight: viewMode === 'today' ? '1px solid var(--c-border)' : '1px solid transparent',
          }}
        >
          <span style={{ fontSize: 13 }}>⌂</span>
          <span style={{ fontSize: 13, fontWeight: viewMode === 'today' ? 600 : 500, color: viewMode === 'today' ? 'var(--c-text)' : 'var(--c-text-2)' }}>Heute</span>
        </button>
        <button className="lm-spring" onClick={() => { setViewMode('lessons'); setActivePageId(null); closeFolderView(); }} style={{ appearance: 'none', border: 'none', font: 'inherit', padding: '10px 16px 12px', cursor: 'pointer', background: viewMode === 'lessons' ? 'var(--c-surface)' : 'transparent', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', gap: 8, color: viewMode === 'lessons' ? accent : 'var(--c-text-2)' }} aria-label="Lehrerhilfe">✦ <span style={{ fontSize: 13, fontWeight: viewMode === 'lessons' ? 600 : 500 }}>Lehrerhilfe</span></button>
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

        {/* Termine (ExamBoard) toggle */}
        <button
          className="lm-spring"
          onClick={() => setExamBoardOpen(true)}
          style={{
            appearance: 'none', border: 'none', font: 'inherit',
            padding: '10px 16px 12px', cursor: 'pointer',
            background: 'transparent',
            borderRadius: '10px 10px 0 0',
            display: 'flex', alignItems: 'center', gap: 8,
            borderLeft: '1px solid transparent',
            borderRight: '1px solid transparent',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--c-text-3)' }}>
            <rect x="1" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 6h12M5 1v3M9 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M4 9h2M8 9h2" stroke="#E8472A" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-2)', letterSpacing: -0.1 }}>
            Termine
          </span>
        </button>

        {/* Notion */}
        <a
          href="https://www.notion.so/acabreraes/Q1-Apuntes-36d29f35ce65804bb227ea3b08dbfc0e?source=copy_link"
          target="_blank"
          rel="noopener noreferrer"
          className="lm-spring"
          style={{
            appearance: 'none', textDecoration: 'none', font: 'inherit',
            padding: '10px 16px 12px', cursor: 'pointer',
            background: 'transparent',
            borderRadius: '10px 10px 0 0',
            display: 'flex', alignItems: 'center', gap: 8,
            borderLeft: '1px solid transparent',
            borderRight: '1px solid transparent',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="13" height="13" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--c-text-3)', flexShrink: 0 }}>
            <path d="M6.6 7.3C10.5 10.4 11.9 10.2 19.4 9.7L85.3 5.9c1.4 0 0.2-1.4-0.3-1.6L73.9 0.2C71.7-0.3 69.3 0.2 66.5 0.7L3.2 5.1C1.1 5.4 0.6 6.5 1.4 7.3L6.6 7.3z" fill="currentColor"/>
            <path d="M11.9 18.7v60.5c0 3.3 1.6 4.5 5.3 4.3l73.4-4.3c3.7-0.2 4.6-2.4 4.6-5.2V13.8c0-2.8-1.1-4.3-3.5-4.1l-76.3 4.5c-2.6 0.2-3.5 1.6-3.5 4.5z" fill="currentColor" opacity="0.1"/>
            <path d="M11.9 18.7v60.5c0 3.3 1.6 4.5 5.3 4.3l73.4-4.3c3.7-0.2 4.6-2.4 4.6-5.2V13.8c0-2.8-1.1-4.3-3.5-4.1l-76.3 4.5c-2.6 0.2-3.5 1.6-3.5 4.5z" stroke="currentColor" strokeWidth="4"/>
            <path d="M64.1 17.5l-20.2 1.2c-2.4 0.1-3 0.2-3.8 1.7-0.8 1.4-0.5 2.9 0.5 3.8l2.3 1.8v30.7l-3.1 1.9c-2.8 1.7-4 2.4-4 4.3 0 2.1 1.6 3.4 4.3 3.2L62 64.4c2.7-0.2 3.6-1.8 3.6-3.8v-2l-3.5 0.2V32.1l4.2 15.3c1.2 4.3 2.8 6.1 5.8 5.9 3-0.2 5-2.5 5-8.4V19.6c0-1.8-1.2-2.5-3.2-2.4l-2.6 0.2c-2 0.1-3.2 1.2-3.2 3v24.2l-3.5-12.8c-0.9-3.2-2.2-4.8-4.6-4.6-2.4 0.1-3.6 1.9-3.6 5.7v29.5L54.4 62v-29l-3 0.2V19.7c0-1.3 0.8-2.1 2.2-2.2h10.5z" fill="currentColor"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-2)', letterSpacing: -0.1 }}>
            Notion
          </span>
        </a>

        {/* Miro */}
        <a
          href="https://miro.com/app/board/uXjVHNOkJ6I=/?share_link_id=189842556230"
          target="_blank"
          rel="noopener noreferrer"
          className="lm-spring"
          style={{
            appearance: 'none', textDecoration: 'none', font: 'inherit',
            padding: '10px 16px 12px', cursor: 'pointer',
            background: 'transparent',
            borderRadius: '10px 10px 0 0',
            display: 'flex', alignItems: 'center', gap: 8,
            borderLeft: '1px solid transparent',
            borderRight: '1px solid transparent',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="48" height="48" rx="10" fill="#FFD02F"/>
            <path d="M32.8 8h-5.6l5.4 8.8-6.3-8.8H21l5.4 8.8-6.3-8.8h-5.3l9.6 16-9.6 16h5.3l6.3-8.8L21 40h5.3l6.3-8.8L27.2 40h5.6l8-16-8-16z" fill="#050038"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-2)', letterSpacing: -0.1 }}>
            Miro
          </span>
        </a>
        </>}

        <div style={{ flex: 1 }} />

        {/* Right controls — mobil ersetzt durch Bottom-Nav + Mehr-Sheet */}
        {!isMobile && <div style={{ paddingBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="lm-spring"
            onClick={() => setFocusMode((v) => !v)}
            title={focusMode ? 'Exit Focus (ESC)' : 'Focus mode'}
            style={{
              height: 30, padding: '0 10px', border: '0.5px solid var(--c-border)', borderRadius: 7,
              background: focusMode ? `${accent}20` : 'var(--c-hover)', color: focusMode ? accent : 'var(--c-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'background .12s', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {focusMode ? 'Focus ON' : 'Focus'}
          </button>
          {/* Global search button */}
          <button
            className="lm-spring"
            onClick={() => setGlobalSearchOpen(true)}
            onMouseDown={(e) => triggerHapticAt(e.clientX, e.clientY, accent)}
            title="Suche (⌘P)"
            aria-label="Suche"
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

          {/* Theme toggle */}
          <button
            className="lm-spring"
            onClick={toggleTheme}
            title={isDark ? t('app.theme_light') : t('app.theme_dark')}
            aria-label={isDark ? t('app.theme_light') : t('app.theme_dark')}
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
            onMouseDown={(e) => {
              if (!activeFolder) return;
              triggerHapticAt(e.clientX, e.clientY, accent);
              e.currentTarget.style.transform = 'scale(0.97)';
            }}
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
            aria-label={t('app.logout')}
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
        </div>}
      </div>

      {/* Body */}
      <FocusMode active={focusMode} onExit={() => setFocusMode(false)}>
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
        {viewMode === 'today' ? (
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {!focusMode && !isMobile && <>
              <Sidebar {...sidebarProps} width={sidebarWidth} onFolderSelect={onFolderSelect} />
              <div onMouseDown={onSidebarResizeMouseDown} style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: 'transparent' }} />
            </>}
            <TodayDashboard
              subject={subject}
              folders={subjectFolders}
              onOpenSubjects={() => { setViewMode('subjects'); if (isMobile) setSidebarDrawerOpen(true); }}
              onOpenSchedule={() => setViewMode('schedule')}
              onOpenSearch={() => setGlobalSearchOpen(true)}
            onOpenNotes={() => { setViewMode('subjects'); setActiveFolder(subjectRootFolders[0] || null); setFolderTab('notes'); }}
              onUpload={() => activeFolder ? setUploadOpen(true) : setToast({ type: 'warning', msg: 'Bitte zuerst einen Ordner auswählen.' })}
            />
          </div>
        ) : viewMode === 'schedule' ? (
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Schedule onNavigate={(subjectId) => { onSubjectChange(subjectId); }} />
          </div>
        ) : viewMode === 'lessons' ? (
          <LessonDashboard sessions={lessonSessions} folders={folders} accent={accent} onOpen={(folder) => { setActiveFolder(folder); setSubjectId(folder.subject); setTeachingMode(true); }} />
        ) : <>
        {!focusMode && !isMobile && <div style={{
          display: 'flex', flexShrink: 0, minHeight: 0, height: '100%',
          transform: `translate3d(${parallax.x * -4}px, ${parallax.y * -2}px, 0)`,
          transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
        }}>
          <Sidebar
            {...sidebarProps}
            width={sidebarWidth}
            onFolderSelect={onFolderSelect}
          />
        </div>}
        {!focusMode && !isMobile && <div
          onMouseDown={onSidebarResizeMouseDown}
          style={{
            width: 4, flexShrink: 0, cursor: 'col-resize',
            background: 'transparent', position: 'relative',
            transition: 'background .15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = accent + '55'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        />}

        {/* Mobile: Sidebar als Drawer statt fester Spalte — 260px+Vorschau
            passen nicht auf ein Telefon, also Overlay mit Backdrop. */}
        {!focusMode && isMobile && sidebarDrawerOpen && createPortal(
          <>
            <div
              onClick={() => setSidebarDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1220, background: 'var(--c-overlay)', backdropFilter: 'blur(4px)', animation: 'lmFadeIn .15s ease-out' }}
            />
            <div className="lm-drawer" style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1221,
              width: 'min(84vw, 300px)', boxShadow: 'var(--c-shadow-modal)',
              display: 'flex', alignItems: 'stretch',
              animation: 'lmSlideInLeft .22s cubic-bezier(.4,.7,.3,1)',
            }}>
              <Sidebar
                {...sidebarProps}
                width={280}
                onSubjectSelect={(id) => { onSubjectChange(id); setSidebarDrawerOpen(false); }}
                onFolderSelect={(folder, rect) => { onFolderSelect(folder, rect); setSidebarDrawerOpen(false); }}
              />
            </div>
          </>,
          document.body
        )}

        <div
          ref={contentPaneRef}
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
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
          {activePageId ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <PageCanvas pageId={activePageId} />
            </div>
          ) : activeFolder ? (
            <div
              key={`folder-open-${activeFolder.id}-${folderOpenTick}`}
              className="lm-folder-open-shell"
              style={{
                flex: 1, minHeight: 0,
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
                    { label: t('subject.' + subjectId), onClick: closeFolderView },
                    { label: activeFolder.group_name, onClick: closeFolderView },
                    ...activeFolderPath.slice(0, -1).map((f) => ({
                      label: f.name,
                      onClick: () => onFolderSelect(f),
                    })),
                    { label: activeFolder.name },
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
                      onClick={() => { setStartNewLessonPlanning(false); setTeachingMode(true); }}
                      title={t('teach.open')}
                      style={{
                        marginLeft: 8, height: 26, padding: '0 12px',
                        border: 'none', borderRadius: 6, background: accent, color: '#fff',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
                      }}
                    >
                      ▶ {t('teach.open')}
                    </button>
                    <button
                      onClick={() => { setStartNewLessonPlanning(true); setTeachingMode(true); }}
                      title="Neue Stunde planen"
                      aria-label="Neue Stunde planen"
                      style={{
                        marginLeft: 8, height: 26, padding: '0 12px',
                        border: `1px solid ${accent}66`, borderRadius: 6, background: 'transparent', color: accent,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
                      }}
                    >
                      ＋ Neue Stunde planen
                    </button>
                  </div>
                </div>

                {folderLessonSessions.length > 0 && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    {folderLessonSessions.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => setTeachingMode(true)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '12px 14px',
                          border: `1px solid ${accent}55`, borderRadius: 10,
                          background: `${accent}0d`, color: 'var(--c-text)', cursor: 'pointer',
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase', color: accent }}>Geplante Unterrichtsstunde</span>
                          <strong style={{ display: 'block', marginTop: 3, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.title}</strong>
                          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: 'var(--c-text-2)' }}>{lesson.class_name || activeFolder.group_name} · {lesson.lesson_date ? new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString('de-DE') : 'ohne Datum'}</span>
                        </span>
                        <span style={{ flexShrink: 0, padding: '6px 9px', borderRadius: 7, background: accent, color: '#fff', fontSize: 11, fontWeight: 700 }}>Lehrerhilfe öffnen →</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '1px solid var(--c-border)' }}>
                  {[
                    { key: 'annual', label: t('annual.tab') },
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
              <div style={{ flex: 1, minHeight: 0, overflow: folderTab === 'notes' ? 'hidden' : 'auto' }}>
                {folderTab === 'files' ? (
                  <div style={{ padding: '12px 20px' }}>
                    {/* Unterordner direkt im Inhalt — Struktur bleibt ohne Sidebar greifbar */}
                    {childFolders.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {childFolders.map((cf) => (
                          <button
                            key={cf.id}
                            className="lm-spring"
                            draggable
                            onClick={(e) => onFolderSelect(cf, e.currentTarget.getBoundingClientRect())}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/x-lm-folder-id', String(cf.id));
                              e.dataTransfer.setData('text/plain', cf.name);
                            }}
                            onDragOver={(e) => {
                              if (e.dataTransfer.types.includes('text/x-lm-folder-id')) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const sourceId = Number(e.dataTransfer.getData('text/x-lm-folder-id'));
                              const rect = e.currentTarget.getBoundingClientRect();
                              const relativeX = (e.clientX - rect.left) / Math.max(rect.width, 1);
                              const placement = relativeX < 0.28 ? 'before' : relativeX > 0.72 ? 'after' : 'inside';
                              handleMoveFolder(sourceId, cf.id, placement);
                            }}
                            title={cf.name}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7,
                              height: 32, padding: '0 12px 0 10px',
                              border: '1px solid var(--c-border)', borderRadius: 8,
                              background: 'var(--c-surface)', cursor: 'pointer',
                              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                              color: 'var(--c-text)', maxWidth: 260,
                              transition: 'border-color .12s, background .12s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = `${cf.color || accent}66`;
                              e.currentTarget.style.background = `${cf.color || accent}0d`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--c-border)';
                              e.currentTarget.style.background = 'var(--c-surface)';
                            }}
                          >
                            <FolderIcon color={cf.color || accent} size={14} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cf.name}
                            </span>
                            {cf.file_count > 0 && (
                              <span style={{ fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', flexShrink: 0 }}>
                                {cf.file_count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
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
                        isMobile={isMobile}
                        files={files}
                        hiddenIds={pendingDeleteIds}
                        links={links}
                        activeFileId={activeFile?.id}
                        activeFile2Id={activeFile2?.id}
                        activeLinkId={activeLink?.id}
                        onFileSelect={(f, meta) => {
                          setActiveFile(f);
                          setActiveLink(null);
                          if (meta?.fromKeyboard) setActiveFile2(null);
                          trackFile(f, activeFolder?.id, subjectId);
                          const from = meta?.sourceRect;
                          const to = previewPaneRef.current?.getBoundingClientRect();
                          if (from && to) setPreviewHero({ from, to, accent, phase: 'start' });
                        }}
                        onFileSecondarySelect={(f) => { setActiveFile2(f); trackFile(f, activeFolder?.id, subjectId); }}
                        onLinkSelect={(l) => { setActiveLink(l); setActiveFile(null); trackLink(l, activeFolder?.id, subjectId); }}
                        accent={accent}
                        query={query}
                        onDelete={handleDeleteFile}
                        onRename={setRenamingFile}
                        onDeleteLink={handleDeleteLink}
                        onToggleLinkShare={toggleLinkShare}
                        onUpload={() => setUploadOpen(true)}
                        onAddLink={() => setAddLinkOpen(true)}
                        onToggleShare={toggleShare}
                        onTogglePublic={togglePublic}
                        onSetDeadline={handleSetFileDeadline}
                        onSetTimer={handleSetFileTimer}
                        onShowLinkQr={(link) => setHeroQrLink(link)}
                        onFileHover={setHoveredFile}
                        keyboardMarkedFileId={kbdMarkedFileId}
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
                        onSetRole={handleSetFileRole}
                        onBulkRole={handleBulkSetFileRole}
                      />
                    )}
                  </div>
                ) : folderTab === 'notes' ? (
                  <NotesEditor
                    folderId={activeFolder.id}
                    folderName={activeFolder.name}
                    initialContent={activeFolder.notes || ''}
                    accent={accent}
                  />
                ) : (
                  <AnnualPlanning rootFolder={planningFolder} accent={accent} />
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <WelcomeView
                subject={subject}
                folders={subjectRootFolders}
                foldersLoading={foldersLoading}
                onFolderSelect={onFolderSelect}
                onFolderHover={setHoveredFolder}
                keyboardMarkedFolderId={kbdMarkedFolderId}
                onNewFolder={() => setNewFolderOpen(true)}
                onMoveFolder={handleMoveFolder}
                t={t}
              />
            </div>
          )}
        </div>

        {/* Preview panel — resizable, optional split (Desktop) */}
        {activeFolder && !focusMode && !isMobile && (
          <div
            style={{
              width: effectivePreviewWidth, flexShrink: 0, display: 'flex', overflow: 'hidden',
              // Klammer: Vorschau darf den Inhalt nie unter ~300px quetschen
              // (schmale Desktop-Fenster + 640px-Split-Vorschau)
              maxWidth: `calc(100vw - ${sidebarWidth + 300}px)`,
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
                      onCommitVersion={handleCommitFileVersion}
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
                    onCommitVersion={handleCommitFileVersion}
                    onClose={() => setActiveFile2(null)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile: Vorschau als Vollbild-Overlay statt Seitenspalte —
            geöffnete Datei/Link verdeckt den Ordnerinhalt, Zurück schließt sie. */}
        {isMobile && !focusMode && (activeFile || activeLink) && createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1230,
            background: 'var(--c-bg)', display: 'flex', flexDirection: 'column',
            animation: 'lmSlideUp .18s cubic-bezier(.4,.7,.3,1)',
          }}>
            {activeLink ? (
              <>
                <div style={{
                  padding: '10px 8px', borderBottom: '1px solid var(--c-border)',
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                }}>
                  <button
                    onClick={() => setActiveLink(null)}
                    title={t('login.back')}
                    aria-label={t('login.back')}
                    style={{
                      width: 30, height: 30, border: 'none', borderRadius: 7,
                      background: 'transparent', color: 'var(--c-text)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <LinkPreview link={activeLink} accent={accent} onDelete={handleDeleteLink} />
                </div>
              </>
            ) : (
              <FilePreview
                file={activeFile}
                accent={accent}
                onClose={() => { setActiveFile(null); setActiveFile2(null); }}
              />
            )}
          </div>,
          document.body
        )}
        </>}
      </div>
      {teachingMode && activeFolder && (
        <TeachingMode
          folder={activeFolder}
          files={files}
          links={links}
          accent={accent}
          t={t}
          startWithPlanner={startNewLessonPlanning}
          onClose={() => { setTeachingMode(false); setStartNewLessonPlanning(false); }}
        />
      )}
      </FocusMode>

      {/* Mobile Bottom-Navigation — Daumen-Zone. Flex-Kind, verdeckt nie Inhalt. */}
      {isMobile && !focusMode && (
        <MobileBottomNav
          accent={accent}
          active={moreSheetOpen ? 'more' : viewMode === 'schedule' ? 'schedule' : 'home'}
          items={[
            { id: 'home', label: 'Heute', icon: navIcons.subjects, onClick: () => { setViewMode('today'); setActivePageId(null); closeFolderView(); } },
            { id: 'search', label: t('mobile.search'), icon: navIcons.search, onClick: () => setGlobalSearchOpen(true) },
            { id: 'schedule', label: t('schedule.title'), icon: navIcons.schedule, onClick: () => setViewMode('schedule') },
            { id: 'more', label: t('mobile.more'), icon: navIcons.more, onClick: () => setMoreSheetOpen(true) },
          ]}
        />
      )}
      </div>

      <MobileMoreSheet
        open={isMobile && moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        t={t}
        accent={accent}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onExams={() => setExamBoardOpen(true)}
        onWorksheet={() => setWorksheetGenOpen(true)}
        onUpload={() => setUploadOpen(true)}
        uploadDisabled={!activeFolder}
        onLogout={onLogout}
        showTeacherLinks
      />

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
      {heroQrLink && (
        <HeroQrOverlay
          link={heroQrLink}
          onClose={() => setHeroQrLink(null)}
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
          confirmLabel={confirmModal.confirmLabel}
          confirmColor={confirmModal.confirmColor}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      <GlobalSearch
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={handleGlobalNavigate}
      />
      <SearchModal
        open={oneNoteSearchOpen}
        onClose={() => setOneNoteSearchOpen(false)}
      />
      {keyboardHelpOpen && <KeyboardHelp onClose={() => setKeyboardHelpOpen(false)} />}
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
      <TimerModal
        open={!!timerModal}
        initialMinutes={timerModal?.initialMinutes}
        accent={accent}
        onClose={() => setTimerModal(null)}
        onSave={async (value) => {
          if (!timerModal) return;
          const trimmed = String(value ?? '').trim();
          const minutes = trimmed === '' ? null : Number(trimmed);
          try {
            const updated = await setFileTimer(timerModal.id, minutes);
            if (activeFile?.id === timerModal.id) setActiveFile(updated);
            setToast({ type: 'success', msg: t('toast.timer_saved') });
          } catch (e) {
            setToast({ type: 'error', msg: e.response?.data?.error || t('toast.timer_error') });
          } finally {
            setTimerModal(null);
          }
        }}
      />
      {examBoardOpen && <ExamBoard onDismiss={() => setExamBoardOpen(false)} />}

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
    </Suspense>
  );
}

function FilesSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, padding: 6 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="lm-skeleton-shimmer" style={{ height: 58, borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)' }} />
      ))}
    </div>
  );
}

function HeroQrOverlay({ link, onClose }) {
  const [qrSrc, setQrSrc] = useState(null);
  const safeUrl = normalizeExternalUrl(link?.url || '');

  useEffect(() => {
    if (!safeUrl) return;
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(safeUrl, { width: 980, margin: 2, color: { dark: '#111827', light: '#ffffff' } }))
      .then((src) => { if (!cancelled) setQrSrc(src); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [safeUrl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1800,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, cursor: 'zoom-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 900px)',
          maxHeight: '92vh',
          background: '#fff',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: '#4B5563', fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {safeUrl.replace(/^https?:\/\//, '')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          {qrSrc ? (
            <img src={qrSrc} alt="QR Fullscreen" style={{ width: 'min(78vw, 760px)', height: 'auto' }} />
          ) : (
            <div style={{ fontSize: 13, color: '#6B7280' }}>Generando QR…</div>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeExternalUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}


function LegacyTeachingMode({ folder, files, links, accent, t, onClose }) {
  const [active, setActive] = useState(null);
  const [showSolutions, setShowSolutions] = useState(false);
  const visibleFiles = files.filter((file) => showSolutions || (file.material_role || 'other') !== 'solution');
  const grouped = MATERIAL_ROLES
    .filter((role) => showSolutions || role.key !== 'solution')
    .map((role) => ({ ...role, files: visibleFiles.filter((file) => (file.material_role || 'other') === role.key) }))
    .filter((role) => role.files.length > 0);
  const current = active || visibleFiles[0] || null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--c-bg)', color: 'var(--c-text)', display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)' }}>
      <aside style={{ borderRight: '1px solid var(--c-border)', background: 'var(--c-surface)', padding: 18, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: accent }}>{t('teach.mode')}</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, letterSpacing: -0.4 }}>{folder.name}</h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, border: '1px solid var(--c-border)', borderRadius: 8, background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer' }}>×</button>
        </div>
        <button onClick={() => setShowSolutions((v) => !v)} style={{ width: '100%', height: 34, border: `1px solid ${showSolutions ? '#DC262655' : 'var(--c-border)'}`, borderRadius: 9, background: showSolutions ? '#DC262611' : 'var(--c-surface-2)', color: showSolutions ? '#DC2626' : 'var(--c-text-2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 14 }}>
          {showSolutions ? t('teach.hide_solutions') : t('teach.show_solutions')}
        </button>
        {grouped.map((group) => (
          <section key={group.key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-3)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>{t(group.labelKey)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.files.map((file) => (
                <button key={file.id} onClick={() => setActive(file)} style={{ appearance: 'none', border: `1px solid ${current?.id === file.id ? accent : 'var(--c-border)'}`, background: current?.id === file.id ? `${accent}12` : 'var(--c-surface-2)', borderRadius: 9, padding: '9px 10px', color: 'var(--c-text)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.original_name}
                </button>
              ))}
            </div>
          </section>
        ))}
        {links.length > 0 && (
          <section>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-3)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>{t('table.links_section')}</div>
            {links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '8px 0', color: accent, fontSize: 12, fontWeight: 700 }}>{link.title}</a>)}
          </section>
        )}
      </aside>
      <main style={{ minWidth: 0, overflow: 'hidden', background: '#0B0E14' }}>
        {current ? (
          <FilePreview file={current} accent={accent} />
        ) : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>{t('teach.empty')}</div>
        )}
      </main>
    </div>,
    document.body
  );
}

function WelcomeView({ subject, folders, foldersLoading, onFolderSelect, onFolderHover, keyboardMarkedFolderId, onNewFolder, onMoveFolder, t }) {
  const accent = subject.color;
  const orderedFolders = [...folders].sort((a, b) =>
    ((a.sort_order || 0) - (b.sort_order || 0)) || compareFolderNames(a, b)
  );
  return (
    <div className="lm-folder-overview" style={{ padding: '32px 28px' }}>
      <div className="lm-folder-overview-heading" style={{ marginBottom: 28 }}>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="lm-skeleton-shimmer" style={{
              height: 168, borderRadius: 14,
              background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
              opacity: 1 - i * 0.12,
            }} />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="lm-folder-grid" style={{
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
        <div className="lm-folder-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {orderedFolders.map((f) => (
            <FolderCard key={f.id} folder={f} accent={accent} selected={keyboardMarkedFolderId === f.id} onClick={(rect) => onFolderSelect(f, rect)} onHover={() => onFolderHover?.(f)} onMoveFolder={onMoveFolder} t={t} />
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

function FolderCard({ folder, accent, selected = false, onClick, onHover, onMoveFolder, t }) {
  const cover = SUBJECT_COVERS[folder.subject] || SUBJECT_COVERS.klasse;
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <button
      onClick={(e) => onClick?.(e.currentTarget.getBoundingClientRect())}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/x-lm-folder-id', String(folder.id));
        e.dataTransfer.setData('text/plain', folder.name);
      }}
      onDragEnd={() => setDragOver(false)}
      onDragOver={(e) => {
        if (Number(e.dataTransfer.getData('text/x-lm-folder-id')) === folder.id) return;
        if (!e.dataTransfer.types.includes('text/x-lm-folder-id')) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const sourceId = Number(e.dataTransfer.getData('text/x-lm-folder-id'));
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeX = (e.clientX - rect.left) / Math.max(rect.width, 1);
        const placement = relativeX < 0.28 ? 'before' : relativeX > 0.72 ? 'after' : 'inside';
        onMoveFolder?.(sourceId, folder.id, placement);
      }}
      className="lm-spring lm-folder-card"
      onFocus={() => onHover?.()}
      onMouseMove={() => onHover?.()}
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          onClick?.(e.currentTarget.getBoundingClientRect());
        }
      }}
      style={{
        appearance: 'none', border: '1px solid var(--c-border)', borderRadius: 14,
        background: hovered && !selected ? 'var(--c-hover-2)' : 'var(--c-surface)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'background .08s, box-shadow .12s, border-color .12s',
        animation: 'lmStaggerIn .42s cubic-bezier(.22,.9,.2,1) both',
        borderColor: dragOver ? `${accent}` : (selected ? `${accent}99` : (hovered ? `${accent}55` : 'var(--c-border)')),
        boxShadow: dragOver ? `0 0 0 3px ${accent}44, 0 10px 26px rgba(0,0,0,0.14)` : (selected ? `0 0 0 2px ${accent}66, 0 10px 26px rgba(0,0,0,0.14)` : (hovered ? `0 0 0 1px ${accent}44` : 'none')),
      }}
      onMouseEnter={(e) => {
        onHover?.();
        setHovered(true);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
      }}
    >
      {/* Cover area */}
      {folder.thumbnail_file_id ? (
        <div className="lm-folder-card-cover" style={{ width: '100%', height: 112, overflow: 'hidden', background: 'var(--c-surface-2)', flexShrink: 0 }}>
          <img
            src={viewFile(folder.thumbnail_file_id)}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div className="lm-folder-card-cover" style={{
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
          <div className="lm-folder-card-group" style={{
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
            <div className="lm-folder-card-count" style={{
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
      <div className="lm-folder-card-info" style={{ padding: '10px 13px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: accent, flexShrink: 0 }} />
          <div className="lm-folder-card-name" style={{
            fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
          }}>{folder.name}</div>
          {folder.is_favorite ? <span style={{ fontSize: 11, color: '#F59E0B', flexShrink: 0 }}>★</span> : null}
        </div>
        {folder.due_at && (
          <div className="lm-folder-card-deadline" style={{
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
