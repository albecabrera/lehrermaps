import { useState } from 'react';
import FileBadge from './FileBadge';
import { detectKind } from '../constants/structure';
import { downloadFile, publicFileUrl } from '../lib/api';
import { useLang } from '../contexts/LangContext';

export default function FileTable({
  files, links = [], activeFileId, activeLinkId,
  onFileSelect, onLinkSelect, accent = '#E8472A',
  query, onDelete, onRename, onDeleteLink, onUpload, onAddLink, onToggleShare,
  onTogglePublic,
  onSetDeadline,
  onFileDragStart,
  hiddenIds = new Set(),
  onBulkDelete, onBulkShare, onBulkUnshare, onBulkDownload, onBulkMove,
}) {
  const { t } = useLang();
  const [menuFile, setMenuFile] = useState(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuLink, setMenuLink] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [dndMode, setDndMode] = useState(false);

  const filtered = query
    ? files.filter((f) => !hiddenIds.has(f.id) && f.original_name.toLowerCase().includes(query.toLowerCase()))
    : files.filter((f) => !hiddenIds.has(f.id));

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'name') return a.original_name.localeCompare(b.original_name) * dir;
    if (sortBy === 'size') return ((a.size_bytes || 0) - (b.size_bytes || 0)) * dir;
    return (new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0)) * dir;
  });

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
    setSortDir(key === 'name' ? 'asc' : 'desc');
  };

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
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 8,
          }}>
          {sorted.map((file) => {
            const on = file.id === activeFileId;
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
                onClick={() => onFileSelect(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                draggable={dndMode}
                onDragStart={dndMode ? (e) => {
                  e.dataTransfer.setData('text/x-lm-file-id', String(file.id));
                  e.dataTransfer.setData('text/plain', file.original_name);
                  onFileDragStart?.(file);
                } : undefined}
                style={{
                  appearance: 'none', border: 'none', font: 'inherit',
                  textAlign: 'left', width: '100%',
                  cursor: dndMode ? 'grab' : 'pointer',
                  background: on ? `${accent}12` : 'var(--c-surface-2)',
                  border: on ? `1px solid ${accent}66` : dndMode ? `1px solid var(--c-border)` : '1px solid var(--c-border-soft)',
                  borderRadius: 10, padding: '9px 10px',
                  transition: 'background .1s, border-color .1s',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-surface-2)'; }}
                onFocus={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                onBlur={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-surface-2)'; }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
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
        </div>
      )}

      {(links.length > 0 || onAddLink) && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--c-text-3)' }}>
              {t('table.links_section')}
            </div>
            {onAddLink && (
              <button
                onClick={onAddLink}
                style={{
                  height: 24, padding: '0 10px', border: `1px dashed ${accent}66`,
                  borderRadius: 5, background: `${accent}0A`, color: accent,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 9 9"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                {t('table.add_link')}
              </button>
            )}
          </div>
          {links.length > 0 && (
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
              {links.map((link, i) => {
                const on = link.id === activeLinkId;
                return (
                  <button
                    key={link.id}
                    onClick={() => onLinkSelect?.(link)}
                    onContextMenu={(e) => { e.preventDefault(); setMenuLink(link); setMenuPos({ x: e.clientX, y: e.clientY }); }}
                    style={{
                      appearance: 'none', border: 'none', font: 'inherit', textAlign: 'left',
                      width: '100%', padding: '10px 16px', cursor: 'pointer',
                      background: on ? `${accent}0F` : 'transparent',
                      borderTop: i > 0 ? '1px solid var(--c-border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = on ? `${accent}0F` : 'transparent'; }}
                    onFocus={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                    onBlur={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M6.5 9.5a4 4 0 0 0 5.656 0l1.415-1.414a4 4 0 0 0-5.657-5.657L7.5 3.843" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M9.5 6.5a4 4 0 0 0-5.656 0L2.43 7.914a4 4 0 0 0 5.657 5.657l.414-.414" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {link.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {link.url.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
                      <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                      <rect x="5" y="5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5 3h2v2M3 5v2h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
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
        <MenuItem icon="↗" label={t('table.ctx_open_browser')} onClick={() => { window.open(link.url, '_blank'); onClose(); }} />
        <MenuItem icon="⎘" label={t('table.ctx_copy_url')} onClick={() => { navigator.clipboard.writeText(link.url); onClose(); }} />
        <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 2px' }} />
        <MenuItem icon="🗑" label={t('delete')} danger onClick={onDelete} />
      </div>
    </>
  );
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
