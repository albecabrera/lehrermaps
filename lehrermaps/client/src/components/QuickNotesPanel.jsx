import { useEffect, useState } from 'react';
import { createQuickNote, deleteQuickNote, getQuickNotes } from '../lib/api';

export default function QuickNotesPanel() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');

  const reload = () => getQuickNotes().then(setNotes).catch(() => {});
  useEffect(() => { reload(); }, []);

  const onBlurSave = async () => {
    const next = text.trim();
    if (!next) return;
    await createQuickNote(next);
    setText('');
    reload();
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Schnellnotizen"
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 3400,
          width: 48, height: 48, borderRadius: 999, border: '1px solid var(--c-border)',
          background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer',
          boxShadow: '0 10px 24px rgba(0,0,0,.18)', fontSize: 20,
        }}
      >✎</button>

      {open && (
        <div style={{ position: 'fixed', right: 18, bottom: 74, width: 320, maxWidth: '92vw', maxHeight: 420, zIndex: 3400, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 16px 36px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', fontWeight: 700, fontSize: 13 }}>
            Schnellnotizen
          </div>
          <div style={{ padding: 10, borderBottom: '1px solid var(--c-border)' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={onBlurSave}
              placeholder="Nueva nota rápida…"
              style={{ width: '100%', minHeight: 72, borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', padding: 8, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          <div style={{ overflow: 'auto', padding: 8, display: 'grid', gap: 8 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ border: '1px solid var(--c-border)', borderRadius: 8, padding: 8, fontSize: 12 }}>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--c-text)' }}>{n.content}</div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: 'var(--c-text-3)' }}>{new Date(n.created_at).toLocaleString('de-DE')}</small>
                  <button onClick={async () => { await deleteQuickNote(n.id); reload(); }} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
