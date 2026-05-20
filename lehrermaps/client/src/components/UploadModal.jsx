import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fileKindColor, detectKind } from '../constants/structure';
import { SUPPORTED_TYPES } from '../constants/structure';
import { useLang } from '../contexts/LangContext';

export default function UploadModal({ open, onClose, accent, targetFolder, onUpload, initialFiles }) {
  const { t } = useLang();
  const [dragOver, setDragOver] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (incoming) => {
    const files = [...incoming].slice(0, 20);
    if (!files.length) return;

    const list = files.map((f) => ({ file: f, progress: 0, status: 'pending' }));
    setFileList(list);
    setUploading(true);

    let allOk = true;
    for (let i = 0; i < list.length; i++) {
      setFileList((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item));
      try {
        await onUpload(list[i].file, (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setFileList((prev) => prev.map((item, idx) => idx === i ? { ...item, progress: pct } : item));
          }
        });
        setFileList((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'done', progress: 100 } : item));
      } catch {
        allOk = false;
        setFileList((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item));
      }
    }

    setUploading(false);
    if (allOk) setTimeout(() => { setFileList([]); onClose(); }, 700);
  }, [onUpload, onClose]);

  useEffect(() => {
    if (open && initialFiles?.length) {
      handleFiles(initialFiles);
    }
    if (!open) setFileList([]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const handleClose = () => {
    if (uploading) return;
    setFileList([]);
    onClose();
  };

  const doneCount = fileList.filter((f) => f.status === 'done').length;
  const showList = fileList.length > 0;

  return createPortal(
    <div
      onClick={!uploading ? handleClose : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--c-overlay)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'lmFadeIn .15s ease-out',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600, maxHeight: '90vh',
          background: 'var(--c-surface)', color: 'var(--c-text)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: 'var(--c-shadow-modal)',
          display: 'flex', flexDirection: 'column',
          animation: 'lmSlideUp .2s cubic-bezier(.4,.7,.3,1)',
          border: '1px solid var(--c-border-soft)',
        }}
      >
        <div style={{
          padding: '18px 22px 14px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          borderBottom: '1px solid var(--c-border)',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
              {t('modal.upload.title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 3 }}>
              {t('modal.upload.target')}: <strong style={{ color: 'var(--c-text)' }}>{targetFolder || t('modal.upload.active_folder')}</strong>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            style={{
              width: 28, height: 28, border: 'none', borderRadius: 7,
              background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer',
              fontSize: 18, lineHeight: 1, fontFamily: 'inherit',
              opacity: uploading ? 0.4 : 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >×</button>
        </div>

        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {/* Drop zone — always visible unless uploading */}
          {!showList && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? accent : 'var(--c-border)'}`,
                background: dragOver ? `${accent}11` : 'var(--c-surface-2)',
                borderRadius: 10, padding: '28px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                textAlign: 'center', transition: 'all .15s', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: `${accent}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 14V4M6 9l5-5 5 5M3 16v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"
                    stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>
                {dragOver ? t('modal.upload.drop_active') : t('modal.upload.drop')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                oder <span style={{ color: accent, fontWeight: 600 }}>{t('modal.upload.browse')}</span>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* File progress list */}
          {showList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fileList.map((item, i) => {
                const kind = detectKind(item.file.name);
                const color = fileKindColor(kind);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--c-surface-2)', borderRadius: 8,
                      padding: '10px 14px', border: '1px solid var(--c-border)',
                    }}
                  >
                    <div style={{
                      width: 28, height: 32, borderRadius: 4, background: color,
                      color: '#fff', display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center', paddingBottom: 3, flexShrink: 0,
                      fontFamily: '"DM Mono", monospace', fontSize: 8, fontWeight: 700,
                    }}>
                      {item.file.name.split('.').pop().toUpperCase().slice(0, 5)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--c-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        marginBottom: 4,
                      }}>{item.file.name}</div>
                      {item.status !== 'done' && item.status !== 'error' && (
                        <div style={{ height: 3, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', background: accent, borderRadius: 2,
                            width: item.status === 'pending' ? '0%' : `${item.progress}%`,
                            transition: 'width .2s',
                          }} />
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 14 }}>
                      {item.status === 'done' && <span style={{ color: '#16A34A' }}>✓</span>}
                      {item.status === 'error' && <span style={{ color: '#DC2626' }}>✗</span>}
                      {item.status === 'uploading' && (
                        <span style={{ fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace' }}>
                          {item.progress}%
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {uploading && (
                <div style={{ fontSize: 11, color: 'var(--c-text-3)', textAlign: 'center', marginTop: 4, fontFamily: '"DM Mono", monospace' }}>
                  {doneCount} / {fileList.length}
                </div>
              )}
            </div>
          )}

          {/* Supported types — only when no list */}
          {!showList && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
                textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 10,
              }}>{t('modal.upload.formats')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {SUPPORTED_TYPES.map((grp) => (
                  <div key={grp.group} style={{
                    border: '1px solid var(--c-border)', borderRadius: 8,
                    padding: '10px 12px', background: 'var(--c-surface)',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <div style={{
                      width: 26, height: 30, flexShrink: 0,
                      background: fileKindColor(grp.kind), color: '#fff',
                      borderRadius: 3, display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center', fontFamily: '"DM Mono", ui-monospace, monospace',
                      fontSize: 8, fontWeight: 700, paddingBottom: 3, marginTop: 1,
                    }}>{grp.exts[0].toUpperCase().slice(0, 4)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', marginBottom: 3 }}>{grp.group}</div>
                      <div style={{
                        fontSize: 10, color: 'var(--c-text-3)',
                        fontFamily: '"DM Mono", monospace', lineHeight: 1.5,
                      }}>.{grp.exts.join(' .')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 22px', borderTop: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-surface-2)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-3)', flex: 1 }}>
            {t('modal.upload.max')}
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            style={{
              height: 32, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 7,
              background: 'transparent', color: 'var(--c-text-2)', fontSize: 12, fontWeight: 500,
              cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.5 : 1,
            }}
          >{t('cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
