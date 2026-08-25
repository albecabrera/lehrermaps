import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchOneNote } from '../lib/api';
import { useNotebook } from '../contexts/NotebookContext';

export default function SearchModal({ open, onClose }) {
  const { setActiveNotebookId, setActiveSectionId, setActivePageId } = useNotebook();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setGroups([]);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!open || !q.trim()) { setGroups([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchOneNote(q.trim());
        setGroups(data.groups || []);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => clearTimeout(timerRef.current);
  }, [q, open]);

  if (!open) return null;

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 4200, background: 'var(--c-overlay)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'start center', paddingTop: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 700, maxWidth: '94vw', maxHeight: '74vh', overflow: 'hidden', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: '0 20px 44px rgba(0,0,0,.24)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Notizbücher, Seiten, Blöcke durchsuchen…"
            style={{ flex: 1, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', borderRadius: 8, padding: '9px 11px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--c-text-3)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '3px 6px' }}>Esc</kbd>
        </div>

        <div style={{ overflow: 'auto', padding: 10 }}>
          {loading && <div style={{ fontSize: 12, color: 'var(--c-text-3)', padding: 8 }}>Suche…</div>}
          {!loading && !groups.length && q.trim() && <div style={{ fontSize: 12, color: 'var(--c-text-3)', padding: 8 }}>Keine Ergebnisse</div>}

          {groups.map((g) => (
            <div key={g.notebook_id} style={{ marginBottom: 12, border: '1px solid var(--c-border)', borderRadius: 10 }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--c-border)', fontSize: 12, fontWeight: 700 }}>{g.notebook_title}</div>
              <div style={{ display: 'grid' }}>
                {g.results.map((r, i) => (
                  <button
                    key={`${r.page_id}-${i}`}
                    onClick={() => {
                      setActiveNotebookId(g.notebook_id);
                      if (r.section_id) setActiveSectionId(r.section_id);
                      setActivePageId(r.page_id);
                      onClose?.();
                    }}
                    style={{ border: 'none', borderTop: i ? '1px solid var(--c-border)' : 'none', background: 'transparent', color: 'var(--c-text)', textAlign: 'left', cursor: 'pointer', padding: '8px 10px', fontFamily: 'inherit' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.page_title}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{r.section_title} · {r.snippet || '—'}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
