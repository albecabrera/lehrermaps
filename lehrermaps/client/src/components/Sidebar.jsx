import { useState, useRef, useEffect } from 'react';
import FolderIcon from './FolderIcon';
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
export default function Sidebar({
  subject, groups, folders, loading = false, width = 260,
  activeFolderId, onFolderSelect,
  onNewFolder, onNewFolderInGroup, onNewSubfolder,
  onRenameFolder, onDeleteFolder,
  onReorderFolders, onToggleFavorite,
  onMoveFileToFolder,
}) {
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(null);
  const [fileDropTargetId, setFileDropTargetId] = useState(null);
  const [draggingFileName, setDraggingFileName] = useState('');
  const accent = subject.color;

  const handleDragOver = (e, folderId) => {
    if (e.dataTransfer.types.includes('text/x-lm-file-id')) {
      e.preventDefault();
      setDraggingFileName(e.dataTransfer.getData('text/plain') || '');
      setFileDropTargetId(folderId);
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

  const clearFileDrop = () => { setFileDropTargetId(null); setDraggingFileName(''); };

  return (
    <div style={{
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
                    onDragOver={handleDragOver}
                    onDrop={handleFileDrop}
                    onDragLeave={clearFileDrop}
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
          onNewSubfolder={() => { onNewSubfolder?.(menu.folder); setMenu(null); }}
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
  fileDropTargetId, draggingFileName, onDragOver, onDrop, onDragLeave,
  t,
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [hovered, setHovered] = useState(false);

  const hasChildren = node.children?.length > 0;
  const isActive = node.id === activeFolderId;
  const isFileDrop = node.id === fileDropTargetId;
  const isFav = !!node.is_favorite;

  const handleToggle = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  const handleClick = () => {
    onSelect(node);
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

        <button
          onClick={handleClick}
          style={{
            appearance: 'none', border: 'none', font: 'inherit', textAlign: 'left',
            width: collapsed ? 44 : '100%',
            paddingLeft: collapsed ? 0 : depth * INDENT + 4,
            paddingRight: collapsed ? 0 : 10,
            paddingTop: 5, paddingBottom: 5,
            margin: collapsed ? '2px auto' : 0,
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 5, cursor: 'pointer',
            background: isActive ? `${accent}14` : 'transparent',
            borderLeft: !collapsed && isActive ? `3px solid ${accent}` : '3px solid transparent',
            borderRadius: collapsed ? 8 : 0,
            color: isActive ? 'var(--c-text)' : 'var(--c-text-2)',
            fontSize: 12.5, fontWeight: isActive ? 600 : 400,
            transition: 'background .08s, color .08s',
            minHeight: ROW_H,
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          onDragOver={(e) => onDragOver(e, node.id)}
          onDrop={(e) => { e.stopPropagation(); onDrop(e, node.id); }}
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
            color={isActive ? accent : (isFileDrop ? '#22C55E' : (hovered ? accent + 'cc' : 'var(--c-text-3)'))}
            size={14}
          />

          {!collapsed && (
            <span style={{
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
              onDragOver={onDragOver}
              onDrop={onDrop}
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
            <div key={row} style={{
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

function FolderContextMenu({ folder, x, y, accent, onClose, onRename, onDelete, onNewSubfolder, t }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050 }} onClick={onClose} />
      <div
        ref={ref}
        style={{
          position: 'fixed', left: x, top: y, zIndex: 1100,
          background: 'var(--c-surface)', borderRadius: 9, padding: 4, minWidth: 190,
          boxShadow: 'var(--c-shadow-pop)',
          fontFamily: '"DM Sans", -apple-system, sans-serif',
          border: '1px solid var(--c-border-soft)',
          animation: 'lmSlideUp .12s ease-out',
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
        <CMenuItem
          icon={
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 3.5h3V1.5h5.5v8H1V3.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M4 3.5V1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M6 5.5h2M6 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          }
          label="Neue Unterordner"
          onClick={onNewSubfolder}
          accent={accent}
        />
      </div>
    </>
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
