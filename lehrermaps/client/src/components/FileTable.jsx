import { useState, useMemo, useRef, useEffect } from 'react';
import FileBadge from './FileBadge';
import { detectKind } from '../constants/structure';
import { downloadFile, publicFileUrl } from '../lib/api';
import { useLang } from '../contexts/LangContext';

export default function FileTable({
  files, links = [], activeFileId, activeLinkId, activeFile2Id,
  onFileSelect, onFileSecondarySelect, onLinkSelect, accent = '#E8472A',
  query, onDelete, onRename, onDeleteLink, onUpload, onAddLink, onToggleShare,
  onTogglePublic,
  onSetDeadline,
  onShowLinkQr,
  onFileHover,
  keyboardMarkedFileId,
  onFileDragStart,
  hiddenIds = new Set(),
  onBulkDelete, onBulkShare, onBulkUnshare, onBulkDownload, onBulkMove,
}) {
  const { t } = useLang();
  const [menuFile, setMenuFile] = useState(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuLink, setMenuLink] = useState(null);
  const [linkAction, setLinkAction] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('numbering');
  const [sortDir, setSortDir] = useState('asc');
  const [dndMode, setDndMode] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const TYPE_GROUPS = useMemo(() => ({
    pdf: (k) => k === 'pdf',
    img: (k) => k === 'img',
    doc: (k) => ['doc', 'slide', 'sheet', 'text', 'markdown', 'code', 'notebook'].includes(k),
    video: (k) => k === 'video',
    audio: (k) => k === 'audio',
  }), []);

  const byQuery = query
    ? files.filter((f) => !hiddenIds.has(f.id) && f.original_name.toLowerCase().includes(query.toLowerCase()))
    : files.filter((f) => !hiddenIds.has(f.id));

  const filtered = filterType === 'all'
    ? byQuery
    : byQuery.filter((f) => TYPE_GROUPS[filterType]?.(detectKind(f.original_name)));

  const getLeadingNumber = (name = '') => {
    const m = String(name).trim().match(/^(\d+)[.)\-\s]?/);
    return m ? Number(m[1]) : null;
  };

  const availableTypes = useMemo(() => {
    return ['pdf', 'img', 'doc', 'video', 'audio'].filter((type) =>
      files.some((f) => TYPE_GROUPS[type]?.(detectKind(f.original_name)))
    );
  }, [files, TYPE_GROUPS]);

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'name') return a.original_name.localeCompare(b.original_name) * dir;
    if (sortBy === 'size') return ((a.size_bytes || 0) - (b.size_bytes || 0)) * dir;
    if (sortBy === 'numbering') {
      const na = getLeadingNumber(a.original_name);
      const nb = getLeadingNumber(b.original_name);
      if (na !== null && nb !== null && na !== nb) return (na - nb) * dir;
      if (na !== null && nb === null) return -1;
      if (na === null && nb !== null) return 1;
      return a.original_name.localeCompare(b.original_name, 'de', { numeric: true, sensitivity: 'base' }) * dir;
    }
    return (new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0)) * dir;
  });
  const videoFiles = sorted.filter((f) => detectKind(f.original_name) === 'video');

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    setMenuFile(file);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const selectedFiles = sorted.filter((f) => selectedIds.has(f.id));
  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

  const toggleSelected = (fileId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(sorted.map((f) => f.id)));
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir(key === 'name' || key === 'numbering' ? 'asc' : 'desc');
  };

  // Refs for keyboard navigation
  const gridRef = useRef(null);
  const btnRefsMap = useRef(new Map());
  const sortedRef = useRef(sorted);
  const activeFileIdRef = useRef(activeFileId);
  const onFileSelectRef = useRef(onFileSelect);

  useEffect(() => { sortedRef.current = sorted; }, [sorted]);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);
  useEffect(() => { onFileSelectRef.current = onFileSelect; }, [onFileSelect]);

  useEffect(() => {
    const getColumns = () => {
      if (!gridRef.current) return 1;
      const items = gridRef.current.children;
      if (items.length < 2) return 1;
      const firstY = items[0].getBoundingClientRect().top;
      let count = 1;
      for (let i = 1; i < items.length; i++) {
        if (Math.abs(items[i].getBoundingClientRect().top - firstY) < 4) count++;
        else break;
      }
      return count;
    };

    const handler = (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

      const items = sortedRef.current;
      if (!items.length) return;

      e.preventDefault();
      e.stopPropagation();

      const cols = getColumns();
      const curIdx = activeFileIdRef.current
        ? items.findIndex((f) => f.id === activeFileIdRef.current)
        : -1;

      let delta = 0;
      if (e.key === 'ArrowRight') delta = 1;
      else if (e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown') delta = cols;
      else if (e.key === 'ArrowUp') delta = -cols;

      const nextIdx = curIdx < 0
        ? 0
        : Math.max(0, Math.min(items.length - 1, curIdx + delta));

      const nextFile = items[nextIdx];
      if (nextFile) {
        onFileSelectRef.current?.(nextFile, { fromKeyboard: true });
        setTimeout(() => {
          btnRefsMap.current.get(nextFile.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }, 0);
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {selectedFiles.length > 0 && (onBulkDownload || onBulkShare || onBulkUnshare || onBulkDelete || onBulkMove) && (
        <div style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          border: '1px solid var(--c-border)',
          borderRadius: 10,
          background: 'var(--c-surface)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)' }}>
            {t('table.selected_count', { n: selectedFiles.length })}
          </span>
          <button onClick={() => onBulkDownload?.(selectedFiles)} style={bulkBtnStyle}>{t('table.ctx_download')}</button>
          <button onClick={() => onBulkShare?.(selectedFiles)} style={bulkBtnStyle}>{t('student.share_toggle')}</button>
          <button onClick={() => onBulkUnshare?.(selectedFiles)} style={bulkBtnStyle}>{t('student.unshare')}</button>
          {onBulkMove && (
            <button onClick={() => onBulkMove(selectedFiles)} style={bulkBtnStyle}>{t('table.bulk_move')}</button>
          )}
          <button onClick={() => onBulkDelete?.(selectedFiles)} style={{ ...bulkBtnStyle, color: 'var(--c-danger-text)' }}>{t('delete')}</button>
          <button onClick={() => setSelectedIds(new Set())} style={{ ...bulkBtnStyle, marginLeft: 'auto' }}>{t('table.clear_selection')}</button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState query={query} accent={accent} onUpload={onUpload} onAddLink={onAddLink} t={t} />
      ) : (
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 12, padding: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '4px 6px 10px',
            fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--c-text-3)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            </span>
            <button onClick={() => toggleSort('name')} style={thBtnStyle}>
              Name {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button className="lm-col-size" onClick={() => toggleSort('size')} style={thBtnStyle}>
              {t('table.col_size')} {sortBy === 'size' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button className="lm-col-date" onClick={() => toggleSort('date')} style={thBtnStyle}>
              {t('table.col_date')} {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button onClick={() => toggleSort('numbering')} style={thBtnStyle}>
              {t('table.col_numbering')} {sortBy === 'numbering' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setDndMode((v) => !v)}
              title={t('table.dnd_mode')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${dndMode ? accent : 'var(--c-border)'}`,
                background: dndMode ? `${accent}14` : 'transparent',
                color: dndMode ? accent : 'var(--c-text-3)',
                fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                textTransform: 'uppercase', fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
              </svg>
              {t('table.dnd_mode')}
            </button>
            {onFileSecondarySelect && (
              <span
                title="Strg+Klick öffnet Datei in zweiter Ansicht"
                style={{
                  fontSize: 9, color: 'var(--c-text-3)', letterSpacing: 0.4,
                  padding: '2px 6px', borderRadius: 4,
                  border: '1px solid var(--c-border)',
                  display: 'flex', alignItems: 'center', gap: 3,
                  userSelect: 'none',
                }}
              >
                <kbd style={{ fontFamily: '"DM Mono", monospace', fontSize: 9 }}>Strg</kbd>
                +Klick
              </span>
            )}
          </div>

          {availableTypes.length > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 6px 10px', flexWrap: 'wrap' }}>
              {['all', ...availableTypes].map((type) => {
                const on = filterType === type;
                const label = type === 'all' ? t('table.filter_all') : t(`table.filter_${type}`);
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    style={{
                      height: 22, padding: '0 9px', borderRadius: 11,
                      border: `1px solid ${on ? 'var(--c-text-3)' : 'var(--c-border)'}`,
                      background: on ? 'var(--c-text-3)' : 'transparent',
                      color: on ? 'var(--c-surface)' : 'var(--c-text-3)',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      letterSpacing: 0.3, transition: 'all .1s',
                    }}
                  >{label}</button>
                );
              })}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 260px)',
            gap: 10,
            alignItems: 'start',
          }}>
          <div
            ref={gridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 6,
            }}
          >
          {sorted.map((file, idx) => {
            const on = file.id === activeFileId;
            const on2 = file.id === activeFile2Id;
            const kbdMarked = keyboardMarkedFileId === file.id;
            const kind = detectKind(file.original_name);
            const sizeFmt = file.size_bytes ? formatBytes(file.size_bytes) : '—';
            const dateFmt = file.uploaded_at
              ? new Date(file.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
              : '—';
            const dueFmt = file.due_at
              ? new Date(file.due_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
              : null;

            return (
              <button
                key={file.id}
                ref={(el) => { if (el) btnRefsMap.current.set(file.id, el); else btnRefsMap.current.delete(file.id); }}
                data-file-btn
                onClick={(e) => {
                  if ((e.ctrlKey || e.metaKey) && onFileSecondarySelect) {
                    e.preventDefault();
                    onFileSecondarySelect(file);
                  } else {
                    onFileSelect(file, { sourceRect: e.currentTarget.getBoundingClientRect() });
                  }
                }}
                className="lm-spring lm-stagger-in"
                onDoubleClick={() => onRename?.(file)}
                onKeyDown={(e) => {
                  if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    onFileSelect?.(file, { sourceRect: e.currentTarget.getBoundingClientRect() });
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
                draggable={dndMode}
                onDragStart={dndMode ? (e) => {
                  e.dataTransfer.setData('text/x-lm-file-id', String(file.id));
                  e.dataTransfer.setData('text/plain', file.original_name);
                  onFileDragStart?.(file);
                } : undefined}
                style={{
                  appearance: 'none', font: 'inherit',
                  textAlign: 'left', width: '100%',
                  cursor: dndMode ? 'grab' : 'pointer',
                  background: on ? `${accent}12` : on2 ? 'rgba(14,165,233,0.10)' : kbdMarked ? `${accent}0D` : 'var(--c-surface-2)',
                  border: on ? `1px solid ${accent}66` : on2 ? '1px solid rgba(14,165,233,0.45)' : kbdMarked ? `1px solid ${accent}88` : dndMode ? `1px solid var(--c-border)` : '1px solid var(--c-border-soft)',
                  borderRadius: 10, padding: '7px 8px',
                  transition: 'background .1s, border-color .1s',
                  animationDelay: `${Math.min(14, idx) * 26}ms`,
                  boxShadow: kbdMarked ? `0 0 0 2px ${accent}22, 0 6px 16px ${accent}22` : undefined,
                }}
                onMouseEnter={(e) => { if (!on && !on2) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                onMouseEnterCapture={() => onFileHover?.(file)}
                onMouseMove={() => onFileHover?.(file)}
                onMouseLeave={(e) => { if (!on && !on2) e.currentTarget.style.background = 'var(--c-surface-2)'; }}
                onFocus={(e) => { if (!on && !on2) e.currentTarget.style.background = 'var(--c-hover-2)'; onFileHover?.(file); }}
                onBlur={(e) => { if (!on && !on2) e.currentTarget.style.background = 'var(--c-surface-2)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {dndMode && (
                    <span style={{ color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.5 }}>
                      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                        <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                        <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
                      </svg>
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); toggleSelected(file.id); }}>
                    <input type="checkbox" checked={selectedIds.has(file.id)} readOnly />
                  </span>
                  <FileBadge kind={kind} name={file.original_name} size={24} />
                  <span style={{
                    fontSize: 12.5, fontWeight: on ? 600 : 500,
                    color: 'var(--c-text)', minWidth: 0, flex: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {file.original_name}
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }}
                    style={{
                      width: 24, height: 24, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', borderRadius: 6, color: 'var(--c-text-3)',
                      fontSize: 13, cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >⋯</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                  {file.is_shared ? (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                      color: '#16A34A', background: 'rgba(22,163,74,0.12)',
                      border: '1px solid rgba(22,163,74,0.25)',
                      borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                    }}>✓</span>
                  ) : null}
                  <span style={{ fontSize: 10.5, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', letterSpacing: 0.2 }}>{sizeFmt}</span>
                  <span style={{
                    fontSize: 10.5, fontFamily: '"DM Mono", monospace', letterSpacing: 0.2,
                    color: dueFmt && new Date(file.due_at) < new Date() ? '#EF4444' : 'var(--c-text-3)',
                    fontWeight: dueFmt && new Date(file.due_at) < new Date() ? 700 : 400,
                  }}>
                    {dueFmt ? `⏰ ${dueFmt}` : dateFmt}
                  </span>
                </div>
              </button>
            );
          })}
          </div>

          <div style={{
            borderLeft: '1px solid var(--c-border)',
            paddingLeft: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {videoFiles.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 6 }}>
                  {t('table.filter_video')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {videoFiles.slice(0, 8).map((vf) => {
                    const onVideo = vf.id === activeFileId;
                    return (
                      <button
                        key={`video-rail-${vf.id}`}
                        onClick={() => onFileSelect?.(vf)}
                        style={{
                          appearance: 'none', border: `1px solid ${onVideo ? accent : 'var(--c-border)'}`,
                          background: onVideo ? `${accent}12` : 'var(--c-surface-2)',
                          color: 'var(--c-text)', borderRadius: 8, padding: '6px 8px',
                          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        🎬 {vf.original_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(links.length > 0 || onAddLink) && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--c-text-3)' }}>
                    {t('table.links_section')}
                  </div>
                  {onAddLink && (
                    <button
                      onClick={onAddLink}
                      style={{
                        height: 22, padding: '0 8px', border: `1px dashed ${accent}66`,
                        borderRadius: 5, background: `${accent}0A`, color: accent,
                        fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      + {t('table.add_link')}
                    </button>
                  )}
                </div>
                {links.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {links.map((link) => {
                      const onLink = link.id === activeLinkId;
                      return (
                        <button
                          key={`link-rail-${link.id}`}
                          onClick={() => setLinkAction(link)}
                          onContextMenu={(e) => { e.preventDefault(); setMenuLink(link); setMenuPos({ x: e.clientX, y: e.clientY }); }}
                          style={{
                            appearance: 'none', border: `1px solid ${onLink ? accent : 'var(--c-border)'}`,
                            background: onLink ? `${accent}0F` : 'var(--c-surface-2)',
                            borderRadius: 8, padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ fontSize: 11.5, fontWeight: onLink ? 700 : 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {link.title}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {link.url.replace(/^https?:\/\//, '')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {menuFile && (
        <FileContextMenu
          file={menuFile}
          x={menuPos.x} y={menuPos.y}
          accent={accent}
          onClose={() => setMenuFile(null)}
          onRename={() => { onRename?.(menuFile); setMenuFile(null); }}
          onDelete={() => { onDelete(menuFile); setMenuFile(null); }}
          onToggleShare={() => { onToggleShare?.(menuFile); setMenuFile(null); }}
          onTogglePublic={() => { onTogglePublic?.(menuFile.id); setMenuFile(null); }}
          onSetDeadline={() => { onSetDeadline?.(menuFile); setMenuFile(null); }}
          t={t}
        />
      )}
      {menuLink && (
        <LinkContextMenu
          link={menuLink}
          x={menuPos.x} y={menuPos.y}
          accent={accent}
          onClose={() => setMenuLink(null)}
          onDelete={() => { onDeleteLink?.(menuLink.id); setMenuLink(null); }}
          t={t}
        />
      )}
      {linkAction && (
        <LinkActionModal
          link={linkAction}
          accent={accent}
          onClose={() => setLinkAction(null)}
          onOpenBrowser={() => {
            window.open(normalizeExternalUrl(linkAction.url), '_blank', 'noopener,noreferrer');
            setLinkAction(null);
          }}
          onShowQr={() => {
            onShowLinkQr?.(linkAction);
            setLinkAction(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

function EmptyState({ query, accent, onUpload, onAddLink, t }) {
  return (
    <div style={{
      padding: '60px 24px', textAlign: 'center',
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 12,
    }}>
      {query ? (
        <>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
            {t('table.no_results')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)' }}>
            {t('table.no_results_hint', { q: query })}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
            {t('table.empty_title')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 20 }}>
            {t('table.empty_hint')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {onUpload && (
              <button
                onClick={onUpload}
                style={{
                  height: 36, padding: '0 20px', border: 'none', borderRadius: 8,
                  background: accent, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t('table.upload_file')}
              </button>
            )}
            {onAddLink && (
              <button
                onClick={onAddLink}
                style={{
                  height: 36, padding: '0 16px', border: '1px solid var(--c-border)', borderRadius: 8,
                  background: 'var(--c-surface-2)', color: 'var(--c-text)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t('table.add_link')}
              </button>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--c-text-3)' }}>
            {t('table.empty_drop_hint')}
          </div>
        </>
      )}
    </div>
  );
}

function FileContextMenu({ file, x, y, accent, onClose, onRename, onDelete, onToggleShare, onTogglePublic, onSetDeadline, t }) {
  const kind = detectKind(file.original_name);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050 }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1100,
        background: 'var(--c-surface)', color: 'var(--c-text)',
        borderRadius: 8, padding: 4, minWidth: 200,
        boxShadow: 'var(--c-shadow-pop)',
        border: '1px solid var(--c-border-soft)',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
        animation: 'lmSlideUp .12s ease-out',
      }}>
        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--c-border)', marginBottom: 4 }}>
          <FileBadge kind={kind} name={file.original_name} size={20} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.original_name}
            </div>
          </div>
        </div>
        <MenuItem icon="✎" label={t('rename')} onClick={onRename} />
        <MenuItem icon="↓" label={t('table.ctx_download')} onClick={() => { window.location.href = downloadFile(file.id); onClose(); }} />
        <MenuItem
          icon={file.is_shared ? '🔒' : '🔗'}
          label={file.is_shared ? t('student.unshare') : t('student.share_toggle')}
          onClick={onToggleShare}
        />
        <MenuItem
          icon={file.is_public ? '🌐' : '🧷'}
          label={file.is_public ? t('table.public_link_off') : t('table.public_link_on')}
          onClick={onTogglePublic}
        />
        {file.is_public && file.public_token ? (
          <MenuItem
            icon="⎘"
            label={t('student.copy_link')}
            onClick={() => { navigator.clipboard.writeText(publicFileUrl(file.public_token)); onClose(); }}
          />
        ) : null}
        <MenuItem icon="⏰" label={t('table.deadline')} onClick={onSetDeadline} />
        <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 2px' }} />
        <MenuItem icon="🗑" label={t('delete')} danger onClick={onDelete} />
      </div>
    </>
  );
}

function MenuItem({ icon, label, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 'none', width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: 5, background: 'transparent',
        cursor: 'pointer', font: 'inherit', fontSize: 12,
        color: danger ? 'var(--c-danger-text)' : 'var(--c-text)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = danger ? 'var(--c-danger-bg)' : 'var(--c-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ width: 14, textAlign: 'center', opacity: 0.7, fontSize: 11 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

function LinkContextMenu({ link, x, y, accent, onClose, onDelete, t }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050 }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1100,
        background: 'var(--c-surface)', color: 'var(--c-text)',
        borderRadius: 8, padding: 4, minWidth: 200,
        boxShadow: 'var(--c-shadow-pop)',
        border: '1px solid var(--c-border-soft)',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--c-border)', marginBottom: 4 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.title}</div>
          <div style={{ fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.url.replace(/^https?:\/\//, '')}</div>
        </div>
        <MenuItem icon="↗" label={t('table.ctx_open_browser')} onClick={() => { window.open(normalizeExternalUrl(link.url), '_blank', 'noopener,noreferrer'); onClose(); }} />
        <MenuItem icon="⎘" label={t('table.ctx_copy_url')} onClick={() => { navigator.clipboard.writeText(link.url); onClose(); }} />
        <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 2px' }} />
        <MenuItem icon="🗑" label={t('delete')} danger onClick={onDelete} />
      </div>
    </>
  );
}

function LinkActionModal({ link, accent, onClose, onOpenBrowser, onShowQr, t }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1198, background: 'var(--c-overlay)' }} onClick={onClose} />
      <div className="lm-modal-surface" style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1199, width: 'min(92vw, 380px)',
        background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)',
        borderRadius: 14, boxShadow: 'var(--c-shadow-modal)',
        padding: 14,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
          {t('table.link_action_title')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {link.title}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onOpenBrowser}
            style={{
              flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--c-border)',
              background: 'var(--c-surface-2)', color: 'var(--c-text)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t('table.ctx_open_browser')}
          </button>
          <button
            onClick={onShowQr}
            style={{
              flex: 1, height: 34, borderRadius: 8, border: 'none',
              background: accent, color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t('table.show_qr')}
          </button>
        </div>
      </div>
    </>
  );
}

function normalizeExternalUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const bulkBtnStyle = {
  height: 26,
  padding: '0 10px',
  border: '1px solid var(--c-border)',
  borderRadius: 6,
  background: 'var(--c-surface-2)',
  color: 'var(--c-text)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const thBtnStyle = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
};
