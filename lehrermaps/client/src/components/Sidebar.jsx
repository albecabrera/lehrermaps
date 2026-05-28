import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import FolderIcon from './FolderIcon';
import FileBadge from './FileBadge';
import NotebookSidebar from './Notebooks/NotebookSidebar';
import { detectKind } from '../constants/structure';
import { useLang } from '../contexts/LangContext';

const INDENT = 20;   // px per depth level
const ROW_H = 30;    // approximate row height for tree line calculation

// ── Tree builder ───────────────────────────────────────────────────────────
function buildTree(folders, parentId = null) {
  const pid = parentId === null ? null : parentId;
  return folders
    .filter((f) => (f.parent_id ?? null) === pid)
    .sort((a, b) => {
      if ((b.is_favorite || 0) !== (a.is_favorite || 0))
        return (b.is_favorite || 0) - (a.is_favorite || 0);
      return (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name);
    })
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }));
}

// ── Main Sidebar ───────────────────────────────────────────────────────────
const FOLDER_COLORS = [
  null,
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

export default function Sidebar({
  subject, groups, folders, loading = false, width = 260,
  activeFolderId, onFolderSelect,
  onNewFolder, onNewFolderInGroup, onNewSubfolder, onNewOrdner, onNewHauptordner,
  onRenameFolder, onDeleteFolder,
  onReorderFolders, onToggleFavorite,
  onSetFolderColor,
  onMoveFileToFolder,
  onMoveFolder,

}) {
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(null);
  const [fileDropTargetId, setFileDropTargetId] = useState(null);
  const [draggingFileName, setDraggingFileName] = useState('');
  const [folderDropTargetId, setFolderDropTargetId] = useState(null);
  const [draggingFolderId, setDraggingFolderId] = useState(null);
  const accent = subject.color;

  const handleDragOver = (e, folderId) => {
    if (e.dataTransfer.types.includes('text/x-lm-file-id')) {
      e.preventDefault();
      setDraggingFileName(e.dataTransfer.getData('text/plain') || '');
      setFileDropTargetId(folderId);
    } else if (e.dataTransfer.types.includes('text/x-lm-folder-id')) {
      e.preventDefault();
      setFolderDropTargetId(folderId);
    }
  };

  const handleFileDrop = async (e, folderId) => {
    e.preventDefault();
    const fileId = Number(e.dataTransfer.getData('text/x-lm-file-id'));
    if (Number.isInteger(fileId) && fileId > 0 && folderId) {
      await onMoveFileToFolder?.(fileId, folderId);
    }
    setFileDropTargetId(null);
    setDraggingFileName('');
  };

  const handleFolderDrop = async (e, targetFolderId) => {
    e.preventDefault();
    const folderId = Number(e.dataTransfer.getData('text/x-lm-folder-id'));
    if (folderId && folderId !== targetFolderId) {
      await onMoveFolder?.(folderId, targetFolderId);
    }
    setFolderDropTargetId(null);
    setDraggingFolderId(null);
  };

  const clearDrop = () => {
    setFileDropTargetId(null);
    setDraggingFileName('');
    setFolderDropTargetId(null);
  };

  return (
    <div className="lm-sidebar" style={{
      width: collapsed ? 52 : width,
      background: 'var(--c-surface)',
      borderRight: '1px solid var(--c-border)',
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      transition: collapsed ? 'width .22s cubic-bezier(.4,.7,.3,1)' : 'none',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center',
        padding: collapsed ? '0' : '0 10px 0 16px',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--c-border)', flexShrink: 0,
      }}>
        {!collapsed && (
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
            textTransform: 'uppercase', color: 'var(--c-text-3)',
          }}>
            {t('subject.' + subject.id)}
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          style={{
            width: 26, height: 26, border: 'none', borderRadius: 6,
            background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d={collapsed ? 'M4 3l4 4-4 4' : 'M10 3L6 7l4 4'}
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Tree area */}
      <div style={{ flex: 1, overflow: 'auto', padding: collapsed ? '8px 4px' : '8px 0' }}>

        {!collapsed && <NotebookSidebar />}
        {loading ? (
          <SidebarSkeleton collapsed={collapsed} accent={accent} />
        ) : (
          groups.map((g) => {
            const groupFolders = folders.filter((f) => f.group_name === g.name);
            const tree = buildTree(groupFolders);
            return (
              <div key={g.id} style={{ marginBottom: collapsed ? 6 : 14 }}>
                {!collapsed && (
                  <GroupHeader
                    group={g} accent={accent}
                    onAdd={() => onNewFolderInGroup?.(g.name)}
                    t={t}
                  />
                )}
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    collapsed={collapsed}
                    accent={accent}
                    activeFolderId={activeFolderId}
                    onSelect={onFolderSelect}
                    onMenu={(folder, x, y) => setMenu({ folder, x, y })}
                    onToggleFavorite={onToggleFavorite}
                    fileDropTargetId={fileDropTargetId}
                    draggingFileName={draggingFileName}
                    folderDropTargetId={folderDropTargetId}
                    draggingFolderId={draggingFolderId}
                    onFolderDragStart={(id) => setDraggingFolderId(id)}
                    onFolderDragEnd={() => { setDraggingFolderId(null); setFolderDropTargetId(null); }}
                    onDragOver={handleDragOver}
                    onFileDrop={handleFileDrop}
                    onFolderDrop={handleFolderDrop}
                    onDragLeave={clearDrop}
                    t={t}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* New folder button */}
      {!collapsed && onNewFolder && (
        <div style={{ padding: 10, borderTop: '1px solid var(--c-border)', flexShrink: 0 }}>
          <button
            onClick={onNewFolder}
            style={{
              width: '100%', height: 32, border: '1px dashed var(--c-border)',
              borderRadius: 7, background: 'transparent', cursor: 'pointer',
              fontSize: 12, color: 'var(--c-text-3)', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {t('sidebar.new_folder')}
          </button>
        </div>
      )}

      {menu && (
        <FolderContextMenu
          folder={menu.folder}
          x={menu.x} y={menu.y}
          accent={accent}
          onClose={() => setMenu(null)}
          onRename={() => { onRenameFolder?.(menu.folder); setMenu(null); }}
          onDelete={() => { onDeleteFolder?.(menu.folder); setMenu(null); }}
          onNewHauptordner={() => { onNewHauptordner?.(menu.folder); setMenu(null); }}
          onNewOrdner={() => { onNewOrdner?.(menu.folder); setMenu(null); }}
          onNewSubfolder={() => { onNewSubfolder?.(menu.folder); setMenu(null); }}
          onSetColor={(color) => { onSetFolderColor?.(menu.folder.id, color); setMenu(null); }}
          t={t}
        />
      )}
    </div>
  );
}

// ── TreeNode ───────────────────────────────────────────────────────────────
function TreeNode({
  node, depth, collapsed, accent, activeFolderId,
  onSelect, onMenu, onToggleFavorite,
  fileDropTargetId, draggingFileName,
  folderDropTargetId, draggingFolderId,
  onFolderDragStart, onFolderDragEnd,
  onDragOver, onFileDrop, onFolderDrop, onDragLeave,
  t,
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [hovered, setHovered] = useState(false);

  const hasChildren = node.children?.length > 0;
  const isActive = node.id === activeFolderId;
  const isFileDrop = node.id === fileDropTargetId;
  const isFolderDrop = node.id === folderDropTargetId && draggingFolderId !== node.id;
  const isDragging = node.id === draggingFolderId;
  const isFav = !!node.is_favorite;
  const nodeAccent = node.color || accent;

  const handleToggle = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  const handleClick = (e) => {
    onSelect(node, e.currentTarget.getBoundingClientRect());
    if (hasChildren && !expanded) setExpanded(true);
  };

  // Tree line X for this depth (center of expand toggle)
  const lineX = depth * INDENT + 8;

  return (
    <div>
      {/* Row */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Horizontal connector from parent's vertical line */}
        {!collapsed && depth > 0 && (
          <div
            style={{
              position: 'absolute',
              left: (depth - 1) * INDENT + 8,
              width: INDENT - 4,
              top: '50%',
              height: 1,
              background: 'var(--c-tree-line, var(--c-border))',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* File drop highlight */}
        {isFileDrop && !collapsed && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 6,
            border: '2px solid #22C55E', background: 'rgba(34,197,94,0.07)',
            pointerEvents: 'none', zIndex: 1,
          }}/>
        )}

        {/* Folder drop highlight */}
        {isFolderDrop && !collapsed && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 6,
            border: `2px solid ${accent}`, background: `${accent}18`,
            pointerEvents: 'none', zIndex: 1,
          }}/>
        )}

        <button
          onClick={handleClick}
          className="lm-spring"
          draggable={!collapsed}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/x-lm-folder-id', String(node.id));
            e.dataTransfer.setData('text/plain', node.name);
            onFolderDragStart?.(node.id);
          }}
          onDragEnd={onFolderDragEnd}
          onKeyDown={(e) => {
            if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
              e.preventDefault();
              handleClick(e);
            }
          }}
          onContextMenu={(e) => { e.preventDefault(); onMenu(node, e.clientX, e.clientY); }}
          style={{
            appearance: 'none', border: 'none', font: 'inherit', textAlign: 'left',
            width: collapsed ? 44 : '100%',
            paddingLeft: collapsed ? 0 : depth * INDENT + 4,
            paddingRight: collapsed ? 0 : 10,
            paddingTop: 5, paddingBottom: 5,
            margin: collapsed ? '2px auto' : 0,
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 5, cursor: isDragging ? 'grabbing' : 'pointer',
            background: isActive ? `${nodeAccent}14` : 'transparent',
            borderLeft: !collapsed && isActive ? `3px solid ${nodeAccent}` : '3px solid transparent',
            borderRadius: collapsed ? 8 : 0,
            color: isActive ? 'var(--c-text)' : depth === 0 ? 'var(--c-text)' : 'var(--c-text-2)',
            fontSize: depth === 0 ? 13.5 : 12.5,
            fontWeight: isActive ? 700 : depth === 0 ? 600 : 400,
            transition: 'background .08s, color .08s, opacity .1s',
            minHeight: depth === 0 ? 34 : ROW_H,
            opacity: isDragging ? 0.4 : 1,
            userSelect: 'none',
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          onDragOver={(e) => onDragOver(e, node.id)}
          onDrop={(e) => {
            e.stopPropagation();
            if (e.dataTransfer.getData('text/x-lm-folder-id')) {
              onFolderDrop(e, node.id);
            } else {
              onFileDrop(e, node.id);
            }
          }}
          onDragLeave={onDragLeave}
        >
          {/* Expand toggle (only when not collapsed) */}
          {!collapsed && (
            <span
              onMouseDown={hasChildren ? handleToggle : undefined}
              style={{
                width: 14, height: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: hasChildren ? 'pointer' : 'default',
                borderRadius: 3, color: 'var(--c-text-3)',
              }}
            >
              {hasChildren && (
                <svg
                  width="8" height="8" viewBox="0 0 8 8" fill="none"
                  style={{
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform .18s cubic-bezier(.4,.7,.3,1)',
                  }}
                >
                  <path d="M2 1.5l3.5 2.5L2 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
          )}

          <FolderIcon
            color={isFileDrop ? '#22C55E' : isFolderDrop ? accent : isActive ? nodeAccent : depth === 0 ? nodeAccent + 'dd' : hovered ? nodeAccent + 'cc' : (node.color ? node.color + '99' : 'var(--c-text-3)')}
            size={depth === 0 ? 16 : 14}
          />

          {!collapsed && (
            <span title={node.name} style={{
              flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.35,
            }}>
              {node.name}
            </span>
          )}

          {!collapsed && !hovered && (
            <span style={{
              fontSize: 9, color: isFav ? '#F59E0B' : 'var(--c-text-3)',
              fontFamily: '"DM Mono", monospace', flexShrink: 0, marginLeft: 2,
            }}>
              {isFav ? '★' : (node.total_size_bytes > 0 ? fmtSize(node.total_size_bytes) : (node.file_count > 0 ? node.file_count : ''))}
            </span>
          )}
        </button>

        {/* Hover action buttons */}
        {!collapsed && hovered && (
          <div style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', gap: 2,
          }}>
            <button
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onToggleFavorite?.(node.id); }}
              title={isFav ? t('sidebar.unpin') : t('sidebar.pin')}
              style={hoverBtnStyle(isFav ? 'rgba(245,158,11,0.15)' : undefined, isFav ? '#F59E0B' : undefined)}
            >
              {isFav ? '★' : '☆'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMenu(node, e.clientX, e.clientY); }}
              style={hoverBtnStyle()}
            >⋯</button>
          </div>
        )}
      </div>

      {/* Children subtree */}
      {!collapsed && hasChildren && expanded && (
        <div style={{ position: 'relative' }}>
          {/* Vertical guide line */}
          <div
            style={{
              position: 'absolute',
              left: lineX,
              top: 0,
              bottom: ROW_H / 2,
              width: 1,
              background: 'var(--c-tree-line, var(--c-border))',
              pointerEvents: 'none',
            }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              accent={accent}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              onMenu={onMenu}
              onToggleFavorite={onToggleFavorite}
              fileDropTargetId={fileDropTargetId}
              draggingFileName={draggingFileName}
              folderDropTargetId={folderDropTargetId}
              draggingFolderId={draggingFolderId}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
              onDragOver={onDragOver}
              onFileDrop={onFileDrop}
              onFolderDrop={onFolderDrop}
              onDragLeave={onDragLeave}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function hoverBtnStyle(bg, color) {
  return {
    width: 20, height: 20, border: 'none', borderRadius: 4,
    background: bg || 'var(--c-hover)', color: color || 'var(--c-text-3)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontFamily: 'inherit',
  };
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function SidebarSkeleton({ collapsed, accent }) {
  return (
    <div style={{ padding: collapsed ? '4px 0' : '0 0 8px' }}>
      {[1, 2, 3].map((group) => (
        <div key={group} style={{ marginBottom: collapsed ? 8 : 14 }}>
          {!collapsed && (
            <div style={{ padding: '0 8px 8px 16px' }}>
              <div style={{ height: 9, width: 80, borderRadius: 999, background: `${accent}18` }} />
            </div>
          )}
          {[1, 2, 3].map((row) => (
            <div key={row} className="lm-skeleton-shimmer" style={{
              height: collapsed ? 28 : ROW_H,
              margin: collapsed ? '4px auto' : `3px 12px 3px ${16 + row * 4}px`,
              borderRadius: 7, background: 'var(--c-surface-2)',
              border: '1px solid var(--c-border)',
              opacity: 1 - row * 0.18,
            }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

function GroupHeader({ group, accent, onAdd, t }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ padding: '0 8px 5px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, opacity: 0.6, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
        textTransform: 'uppercase', color: 'var(--c-text-3)',
      }}>
        {group.name}
      </span>
      <button
        onClick={onAdd}
        title={t('sidebar.create_in', { group: group.name })}
        style={{
          width: 18, height: 18, border: 'none', borderRadius: 4, padding: 0,
          background: hovered ? `${accent}18` : 'transparent',
          color: hovered ? accent : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .1s, color .1s', flexShrink: 0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

function FolderContextMenu({ folder, x, y, accent, onClose, onRename, onDelete, onNewHauptordner, onNewOrdner, onNewSubfolder, onSetColor, t }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, visible: false });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 8;
    setPos({
      left: Math.min(x, vw - width - MARGIN),
      top:  Math.min(y, vh - height - MARGIN),
      visible: true,
    });
  }, [x, y]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050 }} onClick={onClose} />
      <div
        ref={ref}
        style={{
          position: 'fixed', left: pos.left, top: pos.top, zIndex: 1100,
          visibility: pos.visible ? 'visible' : 'hidden',
          background: 'var(--c-surface)', borderRadius: 9, padding: 4, minWidth: 190,
          boxShadow: 'var(--c-shadow-pop)',
          fontFamily: '"DM Sans", -apple-system, sans-serif',
          border: '1px solid var(--c-border-soft)',
          animation: pos.visible ? 'lmSlideUp .12s ease-out' : 'none',
        }}
      >
        <div style={{
          padding: '7px 10px 6px', borderBottom: '1px solid var(--c-border)',
          marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <FolderIcon color={accent} size={13} />
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {folder.name}
          </div>
        </div>
        <CMenuItem
          icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 9.5h2l5.5-5.5-2-2-5.5 5.5v2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          }
          label={t('rename')}
          onClick={onRename}
        />
        <CMenuItem
          icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 3h1.5l.5 6h5l.5-6H10M2.5 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label={t('delete')}
          danger
          onClick={onDelete}
        />
        <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 2px' }} />
        <div style={{ padding: '5px 10px 3px', fontSize: 9.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text-3)' }}>Neu erstellen</div>
        <CMenuItem
          icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="1" y="3" width="9" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 5h9" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3.5 1.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          }
          label="Hauptordner"
          onClick={onNewHauptordner}
          accent={accent}
        />
        <CMenuItem
          icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 4h9v5.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 4V3a1 1 0 0 1 1-1h2.5l1 1.5H9a1 1 0 0 1 1 1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          }
          label="Ordner"
          onClick={onNewOrdner}
          accent={accent}
        />
        <CMenuItem
          icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M3 2.5h6v7H3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M1 1h4.5l1 1.5H10v7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M5 5.5h2M5 7h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          }
          label="Unterordner"
          onClick={onNewSubfolder}
          accent={accent}
        />
        <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 2px' }} />
        <div style={{ padding: '6px 10px 4px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 6 }}>Farbe</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {FOLDER_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => onSetColor(c)}
                title={c || 'Standard'}
                style={{
                  width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
                  border: (folder.color === c || (!folder.color && c === null))
                    ? '2px solid var(--c-text)'
                    : '1.5px solid var(--c-border)',
                  background: c || 'var(--c-surface-2)',
                  flexShrink: 0, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {c === null && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2L2 8" stroke="var(--c-text-3)" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function CMenuItem({ icon, label, danger, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 'none', width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: 5, background: 'transparent',
        cursor: 'pointer', font: 'inherit', fontSize: 12,
        color: danger ? 'var(--c-danger-text)' : 'var(--c-text)',
        display: 'flex', alignItems: 'center', gap: 9,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'var(--c-danger-bg)' : accent ? `${accent}12` : 'var(--c-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7, color: accent || 'inherit' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
