import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';

export default function RenameFolderModal({ folder, accent = '#E8472A', onClose, onSave }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (folder) { setName(folder.name); setSaving(false); setTimeout(() => { inputRef.current?.select(); }, 60); }
  }, [folder]);

  const handleSave = async () => {
    if (!name.trim() || name.trim() === folder.name) { onClose(); return; }
    setSaving(true);
    try { await onSave(folder.id, name.trim()); onClose(); }
    catch { setSaving(false); }
  };

  if (!folder) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'var(--c-overlay)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, background: 'var(--c-surface)', borderRadius: 12,
          boxShadow: 'var(--c-shadow-modal)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>{t('modal.rename.title')}</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
            maxLength={100}
            style={{
              width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--c-border)',
              borderRadius: 7, fontSize: 13, fontFamily: 'inherit',
              outline: 'none', color: 'var(--c-text)', background: 'var(--c-input-bg)',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = accent}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
          />
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--c-surface-2)' }}>
          <button onClick={onClose} style={{ height: 32, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'transparent', color: 'var(--c-text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{ height: 32, padding: '0 16px', border: 'none', borderRadius: 7, background: accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !name.trim() ? 0.5 : 1 }}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
