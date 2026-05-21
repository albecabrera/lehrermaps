import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SUBJECTS } from '../constants/structure';
import { useLang } from '../contexts/LangContext';

export default function NewFolderModal({ open, onClose, onSave, subject, defaultGroup, parentFolder = null }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [template, setTemplate] = useState('');
  const [saving, setSaving] = useState(false);

  const isSubfolder = !!parentFolder;

  useEffect(() => {
    if (open) {
      setName('');
      setGroupName(isSubfolder ? parentFolder.group_name : (defaultGroup || ''));
      setTemplate('');
      setSaving(false);
    }
  }, [open, defaultGroup, isSubfolder, parentFolder]);

  const subjectData = SUBJECTS.find((s) => s.id === subject?.id);
  const groups = subjectData?.groups ?? [];
  const accent = subject?.color ?? '#6B7280';

  const handleSave = async () => {
    if (!name.trim() || !groupName) return;
    setSaving(true);
    try {
      await onSave({
        subject: subject.id,
        group_name: groupName,
        name: name.trim(),
        template: template || null,
        parent_id: parentFolder?.id ?? null,
      });
      setName('');
      setGroupName('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--c-overlay)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'lmFadeIn .15s ease-out',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        className="lm-modal-surface"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'var(--c-surface)', borderRadius: 14,
          boxShadow: 'var(--c-shadow-modal)',
          animation: 'lmSlideUp .2s cubic-bezier(.4,.7,.3,1)',
          border: '1px solid var(--c-border-soft)',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: 'var(--c-text)' }}>
            {isSubfolder ? 'Neue Unterordner' : t('modal.new_folder.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 3 }}>
            {isSubfolder ? (
              <>In <strong style={{ color: accent }}>📁 {parentFolder.name}</strong></>
            ) : (
              <>{t('modal.new_folder.in')} <strong style={{ color: accent }}>{t('subject.' + subject?.id) || subjectData?.name}</strong></>
            )}
          </div>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isSubfolder && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
                textTransform: 'uppercase', color: 'var(--c-text-3)',
              }}>{t('modal.new_folder.subject_label')}</span>
              <select
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={inputStyle}
              >
                <option value="">Gruppe wählen…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
              textTransform: 'uppercase', color: 'var(--c-text-3)',
            }}>{t('modal.new_folder.name_label')}</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('modal.new_folder.name_placeholder')}
              maxLength={100}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
              textTransform: 'uppercase', color: 'var(--c-text-3)',
            }}>Template</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value)} style={inputStyle}>
              <option value="">Ohne Template</option>
              <option value="abitur">Tema Abitur</option>
              <option value="standard">Standard Unterricht</option>
            </select>
          </label>
        </div>

        <div style={{
          padding: '12px 22px', borderTop: '1px solid var(--c-border)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          background: 'var(--c-surface-2)',
        }}>
          <button onClick={onClose} style={btnSecStyle}>{t('cancel')}</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || (!groupName && !isSubfolder) || saving}
            style={{
              ...btnPriStyle,
              background: accent,
              opacity: !name.trim() || (!groupName && !isSubfolder) || saving ? 0.5 : 1,
              cursor: !name.trim() || (!groupName && !isSubfolder) || saving ? 'not-allowed' : 'pointer',
            }}
          >{saving ? t('creating') : t('create')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const inputStyle = {
  appearance: 'none', border: '1px solid var(--c-border)', borderRadius: 7,
  background: 'var(--c-input-bg)', color: 'var(--c-text)', padding: '8px 10px', fontSize: 12.5,
  fontFamily: '"DM Sans", -apple-system, sans-serif', outline: 'none',
  width: '100%',
};

const btnSecStyle = {
  height: 32, padding: '0 14px', border: '1px solid var(--c-border)', borderRadius: 7,
  background: 'transparent', color: 'var(--c-text-2)', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
};

const btnPriStyle = {
  height: 32, padding: '0 16px', border: 'none', borderRadius: 7,
  color: '#fff', fontSize: 12, fontWeight: 600,
  fontFamily: 'inherit',
};
