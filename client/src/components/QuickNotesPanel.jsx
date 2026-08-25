import { useEffect, useState } from 'react';
import { createQuickNote, deleteQuickNote, getQuickNotes } from '../lib/api';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function QuickNotesPanel() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeKey(open, () => setOpen(false));

  const reload = () => getQuickNotes().then(setNotes).catch(() => {});
  useEffect(() => { reload(); }, []);

  const saveNote = async () => {
    const next = text.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      await createQuickNote(next);
      setText('');
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t('quicknotes.title')}
        aria-label={t('quicknotes.title')}
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 3400,
          width: 48, height: 48, borderRadius: 999, border: '1px solid var(--c-border)',
          background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer',
          boxShadow: '0 10px 24px rgba(0,0,0,.18)', fontSize: 20,
        }}
      >✎</button>

      {open && (
        <div style={{ position: 'fixed', right: 18, bottom: 74, width: 320, maxWidth: '92vw', maxHeight: 420, zIndex: 3400, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 16px 36px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', animation: 'lmSlideUp .16s cubic-bezier(.4,.7,.3,1)' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', fontWeight: 700, fontSize: 13, color: 'var(--c-text)' }}>
            {t('quicknotes.title')}
          </div>
          <div style={{ padding: 10, borderBottom: '1px solid var(--c-border)' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={saveNote}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
              }}
              placeholder={t('quicknotes.placeholder')}
              style={{ width: '100%', minHeight: 72, borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', padding: 8, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={saveNote}
                disabled={!text.trim() || saving}
                style={{
                  height: 28, padding: '0 14px', border: 'none', borderRadius: 7,
                  background: 'var(--c-text)', color: 'var(--c-surface)',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  cursor: !text.trim() || saving ? 'not-allowed' : 'pointer',
                  opacity: !text.trim() || saving ? 0.5 : 1,
                }}
              >{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
          <div style={{ overflow: 'auto', padding: 8, display: 'grid', gap: 8 }}>
            {notes.length === 0 && (
              <div style={{ padding: '14px 8px', fontSize: 12, color: 'var(--c-text-3)', textAlign: 'center' }}>
                {t('quicknotes.empty')}
              </div>
            )}
            {notes.map((n) => (
              <div key={n.id} style={{ border: '1px solid var(--c-border)', borderRadius: 8, padding: 8, fontSize: 12 }}>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--c-text)' }}>{n.content}</div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: 'var(--c-text-3)' }}>{new Date(n.created_at).toLocaleString('de-DE')}</small>
                  <button onClick={async () => { await deleteQuickNote(n.id); reload(); }} style={{ border: 'none', background: 'transparent', color: 'var(--c-danger-text)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>{t('delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
