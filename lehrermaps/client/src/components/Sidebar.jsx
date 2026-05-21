import { useState, useRef, useEffect } from 'react';
import FolderIcon from './FolderIcon';
import { useLang } from '../contexts/LangContext';

export default function Sidebar({
  subject, groups, folders, loading = false,
  activeFolderId, onFolderSelect,
  onNewFolder, onNewFolderInGroup,
  onRenameFolder, onDeleteFolder,
  onReorderFolders, onToggleFavorite,
  onMoveFileToFolder,
}) {
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [fileDropTargetId, setFileDropTargetId] = useState(null);
  const [draggingFileName, setDraggingFileName] = useState('');
  const accent = subject.color;

  const handleDragStart = (e, folderId) => {
    e.dataTransfer.setData('text/x-lm-folder-id', String(folderId));
    setDraggingId(folderId);
  };

  const handleDragOver = (e, folderId) => {
    const fileId = e.dataTransfer.getData('text/x-lm-file-id');
    if (fileId) {
      e.preventDefault();
      setDraggingFileName(e.dataTransfer.getData('text/plain') || '');
      setFileDropTargetId(folderId);
      return;
    }
    e.preventDefault();
    if (folderId !== draggingId) setDropTargetId(folderId);
  };

  const handleDrop = async (e, groupName) => {
    e.preventDefault();
    const fileId = Number(e.dataTransfer.getData('text/x-lm-file-id'));
    if (Number.isInteger(fileId) && fileId > 0) {
      if (fileDropTargetId) await onMoveFileToFolder?.(fileId, fileDropTargetId);
      setDraggingId(null); setDropTargetId(null); setFileDropTargetId(null); setDraggingFileName('');
      return;
    }
    if (!draggingId || !dropTargetId || draggingId === dropTargetId) {
      setDraggingId(null); setDropTargetId(null); setFileDropTargetId(null); setDraggingFileName(''); return;
    }
    const groupFolders = folders.filter((f) => f.group_name === groupName);
    const from = groupFolders.findIndex((f) => f.id === draggingId);
    const to = groupFolders.findIndex((f) => f.id === dropTargetId);
    if (from === -1 || to === -1) { setDraggingId(null); setDropTargetId(null); setFileDropTargetId(null); setDraggingFileName(''); return; }
    const reordered = [...groupFolders];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    onReorderFolders?.(reordered.map((f) => f.id));
    setDraggingId(null); setDropTargetId(null); setFileDropTargetId(null); setDraggingFileName('');
  };

  const handleDragEnd = () => { setDraggingId(null); setDropTargetId(null); setFileDropTargetId(null); setDraggingFileName(''); };

  return (
    <div style={{
      width: collapsed ? 56 : 240,
      background: 'var(--c-surface)', borderRight: '1px solid var(--c-border)',
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      transition: 'width .22s cubic-bezier(.4,.7,.3,1)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center',
        padding: collapsed ? '0' : '0 12px 0 16px',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--c-border)', flexShrink: 0,
      }}>
        {!collapsed && (
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase', color: 'var(--c-text-3)' }}>
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
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d={collapsed ? 'M4 3l4 4-4 4' : 'M10 3L6 7l4 4'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: collapsed ? '8px 6px' : '10px 0' }}>
        {loading ? (
          <SidebarSkeleton collapsed={collapsed} accent={accent} />
        ) : (
          groups.map((g) => {
          const groupFolders = folders
            .filter((f) => f.group_name === g.name)
            .sort((a, b) => {
              if ((b.is_favorite || 0) !== (a.is_favorite || 0))
                return (b.is_favorite || 0) - (a.is_favorite || 0);
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
          return (
            <div
              key={g.id}
              style={{ marginBottom: collapsed ? 8 : 16 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, g.name)}
            >
              {!collapsed && (
                <GroupHeader
                  group={g}
                  accent={accent}
                  onAdd={() => onNewFolderInGroup?.(g.name)}
                  t={t}
                />
              )}
              {groupFolders.map((f) => {
                const on = f.id === activeFolderId;
                return (
                  <FolderRow
                    key={f.id}
                    folder={f}
                    on={on}
                    collapsed={collapsed}
                    accent={accent}
                    groupName={g.name}
                    isDragging={f.id === draggingId}
                    isDropTarget={f.id === dropTargetId}
                    isFileDropTarget={f.id === fileDropTargetId}
                    onClick={() => onFolderSelect(f)}
                    onMenu={(x, y) => setMenu({ folder: f, x, y })}
                    onDragStart={(e) => handleDragStart(e, f.id)}
                    onDragOver={(e) => handleDragOver(e, f.id)}
                    onDrop={(e) => { e.stopPropagation(); handleDrop(e, g.name); }}
                    onDragEnd={handleDragEnd}
                    onToggleFavorite={() => onToggleFavorite?.(f.id)}
                    draggingFileName={draggingFileName}
                    t={t}
                  />
                );
              })}
            </div>
          );
          })
        )}
      </div>

      {!collapsed && onNewFolder && (
        <div style={{ padding: 10, borderTop: '1px solid var(--c-border)' }}>
          <button
            onClick={onNewFolder}
            style={{
              width: '100%', height: 32, border: '1px dashed var(--c-border)',
              borderRadius: 7, background: 'transparent', cursor: 'pointer',
              fontSize: 12, color: 'var(--c-text-3)', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background .1s, color .1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)'; }}
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
          t={t}
        />
      )}
    </div>
  );
}

function SidebarSkeleton({ collapsed, accent }) {
  return (
    <div style={{ padding: collapsed ? '4px 0' : '0 0 8px' }}>
      {[1, 2, 3].map((group) => (
        <div key={group} style={{ marginBottom: collapsed ? 8 : 14 }}>
          {!collapsed && (
            <div style={{ padding: '0 8px 8px 16px' }}>
              <div style={{ height: 10, width: 90, borderRadius: 999, background: `${accent}18` }} />
            </div>
          )}
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              style={{
                height: collapsed ? 28 : 32,
                margin: collapsed ? '4px auto' : '4px 12px 4px 16px',
                borderRadius: 8,
                background: 'var(--c-surface-2)',
                border: '1px solid var(--c-border)',
              }}
            />
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
      style={{ padding: '0 8px 6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, opacity: 0.6, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--c-text-3)' }}>
        {group.name}
      </span>
      <button
        onClick={onAdd}
        title={t('sidebar.create_in', { group: group.name })}
        style={{
          width: 18, height: 18, border: 'none', borderRadius: 4,
          background: hovered ? `${accent}18` : 'transparent',
          color: hovered ? accent : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .1s, color .1s', flexShrink: 0, padding: 0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

function FolderRow({ folder, on, collapsed, accent, groupName, onClick, onMenu, onToggleFavorite,
  isDragging, isDropTarget, isFileDropTarget, onDragStart, onDragOver, onDrop, onDragEnd, draggingFileName, t }) {
  const [hovered, setHovered] = useState(false);
  const isFav = !!folder.is_favorite;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(isDropTarget || isFileDropTarget) && !collapsed && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: 16, right: 16, height: 2,
            background: isFileDropTarget ? '#22C55E' : accent, borderRadius: 1, zIndex: 2, pointerEvents: 'none',
          }} />
          {isFileDropTarget && (
            <div style={{
              position: 'absolute', right: 8, top: -8, zIndex: 3,
              fontSize: 10, fontWeight: 700, color: '#166534',
              background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.35)',
              padding: '2px 6px', borderRadius: 999,
            }}>
              {t('sidebar.drop_to_move', { file: draggingFileName || '…' })}
            </div>
          )}
        </>
      )}
      <button
        onClick={onClick}
        draggable={!collapsed}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        title={collapsed ? `${groupName} · ${folder.name}` : undefined}
        style={{
          appearance: 'none', border: 'none', font: 'inherit',
          width: collapsed ? 44 : '100%',
          padding: collapsed ? '8px 0' : '7px 14px 7px 16px',
          margin: collapsed ? '2px auto' : 0,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, cursor: isDragging ? 'grabbing' : 'pointer', textAlign: 'left',
          background: on ? `${accent}14` : 'transparent',
          borderLeft: !collapsed && on ? `3px solid ${accent}` : '3px solid transparent',
          borderRadius: collapsed ? 8 : 0,
          color: on ? 'var(--c-text)' : 'var(--c-text-2)',
          fontSize: 13, fontWeight: on ? 600 : 400,
          transition: 'background .1s, color .1s, opacity .1s',
          opacity: isDragging ? 0.4 : 1,
        }}
        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = on ? `${accent}14` : 'transparent'; }}
        onFocus={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
        onBlur={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
      >
        <FolderIcon color={on ? accent : 'var(--c-text-3)'} size={16} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {folder.name}
            </span>
            <span style={{ fontSize: 10, color: isFav ? '#F59E0B' : 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', flexShrink: 0 }}>
              {hovered ? '' : (isFav ? '★' : (folder.total_size_bytes > 0 ? fmtSize(folder.total_size_bytes) : (folder.file_count ?? 0)))}
            </span>
          </>
        )}
      </button>

      {!collapsed && hovered && (
        <div style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', gap: 3,
        }}>
          <button
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onToggleFavorite?.(); }}
            title={isFav ? t('sidebar.unpin') : t('sidebar.pin')}
            style={{
              width: 22, height: 22, border: 'none', borderRadius: 5,
              background: isFav ? 'rgba(245,158,11,0.15)' : 'var(--c-hover)',
              color: isFav ? '#F59E0B' : 'var(--c-text-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}
          >{isFav ? '★' : '☆'}</button>
          <button
            onClick={(e) => { e.stopPropagation(); onMenu(e.clientX, e.clientY); }}
            style={{
              width: 22, height: 22, border: 'none', borderRadius: 5,
              background: on ? `${accent}22` : 'var(--c-hover)',
              color: 'var(--c-text-2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, lineHeight: 1,
            }}
          >⋯</button>
        </div>
      )}
    </div>
  );
}

function fmtSize(bytes) {
  if (!bytes) return '0';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FolderContextMenu({ folder, x, y, accent, onClose, onRename, onDelete, t }) {
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
          background: 'var(--c-surface)', borderRadius: 8, padding: 4, minWidth: 180,
          boxShadow: 'var(--c-shadow-pop)',
          fontFamily: '"DM Sans", -apple-system, sans-serif',
          border: '1px solid var(--c-border-soft)',
        }}
      >
        <div style={{ padding: '7px 10px 6px', borderBottom: '1px solid var(--c-border)', marginBottom: 4 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {folder.name}
          </div>
        </div>
        <CMenuItem icon="✎" label={t('rename')} onClick={onRename} />
        <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 2px' }} />
        <CMenuItem icon="🗑" label={t('delete')} danger onClick={onDelete} />
      </div>
    </>
  );
}

function CMenuItem({ icon, label, danger, onClick }) {
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
      <span>{label}</span>
    </button>
  );
}
