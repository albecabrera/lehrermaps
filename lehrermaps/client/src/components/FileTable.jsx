import { useState } from 'react';
import FileBadge from './FileBadge';
import { detectKind } from '../constants/structure';
import { downloadFile } from '../lib/api';
import { useLang } from '../contexts/LangContext';

export default function FileTable({
  files, links = [], activeFileId, activeLinkId,
  onFileSelect, onLinkSelect, accent = '#E8472A',
  query, onDelete, onRename, onDeleteLink, onUpload, onAddLink, onToggleShare,
}) {
  const { t } = useLang();
  const [menuFile, setMenuFile] = useState(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuLink, setMenuLink] = useState(null);

  const filtered = query
    ? files.filter((f) => f.original_name.toLowerCase().includes(query.toLowerCase()))
    : files;

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    setMenuFile(file);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div style={{ position: 'relative' }}>
      {filtered.length === 0 ? (
        <EmptyState query={query} accent={accent} onUpload={onUpload} t={t} />
      ) : (
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 12, overflow: 'hidden',
          containerType: 'inline-size',
        }}>
          <div className="lm-filerow" style={{
            padding: '8px 16px', borderBottom: '1px solid var(--c-border)',
            fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
            textTransform: 'uppercase', color: 'var(--c-text-3)',
          }}>
            <span />
            <span>Name</span>
            <span className="lm-col-size">{t('table.col_size')}</span>
            <span className="lm-col-date">{t('table.col_date')}</span>
            <span />
          </div>

          {filtered.map((file, i) => {
            const on = file.id === activeFileId;
            const kind = detectKind(file.original_name);
            const sizeFmt = file.size_bytes ? formatBytes(file.size_bytes) : '—';
            const dateFmt = file.uploaded_at
              ? new Date(file.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
              : '—';

            return (
              <button
                key={file.id}
                onClick={() => onFileSelect(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                className="lm-filerow"
                style={{
                  appearance: 'none', border: 'none', font: 'inherit',
                  textAlign: 'left', width: '100%',
                  padding: '10px 16px', alignItems: 'center', cursor: 'pointer',
                  background: on ? `${accent}0F` : 'transparent',
                  borderTop: i > 0 ? '1px solid var(--c-border)' : 'none',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-hover-2)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = on ? `${accent}0F` : 'transparent'; }}
              >
                <FileBadge kind={kind} name={file.original_name} size={26} />
                <span style={{
                  fontSize: 13, fontWeight: on ? 600 : 500,
                  color: 'var(--c-text)', minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {file.original_name}
                </span>
                {file.is_shared ? (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                    color: '#16A34A', background: 'rgba(22,163,74,0.12)',
                    border: '1px solid rgba(22,163,74,0.25)',
                    borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                  }}>✓</span>
                ) : null}
                <span className="lm-col-size" style={{
                  fontSize: 11, color: 'var(--c-text-3)',
                  fontFamily: '"DM Mono", monospace',
                }}>{sizeFmt}</span>
                <span className="lm-col-date" style={{
                  fontSize: 11, color: 'var(--c-text-3)',
                  fontFamily: '"DM Mono", monospace',
                }}>{dateFmt}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }}
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', borderRadius: 6, color: 'var(--c-text-3)',
                    fontSize: 14, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >⋯</span>
              </button>
            );
          })}
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

function EmptyState({ query, accent, onUpload, t }) {
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
        </>
      )}
    </div>
  );
}

function FileContextMenu({ file, x, y, accent, onClose, onRename, onDelete, onToggleShare, t }) {
  const kind = detectKind(file.original_name);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050 }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1100,
        background: 'var(--c-surface)', color: 'var(--c-text)',
        borderRadius: 8, padding: 4, minWidth: 200,
        boxShadow: '0 12px 40px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(0,0,0,0.1)',
        border: '1px solid var(--c-border)',
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
        color: danger ? '#DC2626' : 'var(--c-text)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = danger ? 'rgba(220,38,38,0.08)' : 'var(--c-hover)'}
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
        boxShadow: '0 12px 40px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(0,0,0,0.1)',
        border: '1px solid var(--c-border)',
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
