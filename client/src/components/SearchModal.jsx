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
    <div onClick={onClose} className="lm-dialog-backdrop lm-search-backdrop">
      <div onClick={(e) => e.stopPropagation()} className="lm-modal-surface lm-search-dialog">
        <div className="lm-search-header">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Notizbücher, Seiten, Blöcke durchsuchen…"
            className="lm-search-input"
          />
          <kbd className="lm-key-hint">Esc</kbd>
        </div>

        <div className="lm-search-results">
          {loading && <div className="lm-search-empty">Suche…</div>}
          {!loading && !groups.length && q.trim() && <div className="lm-search-empty">Keine Ergebnisse</div>}

          {groups.map((g) => (
            <div key={g.notebook_id} className="lm-search-group">
              <div className="lm-search-group-title">{g.notebook_title}</div>
              <div className="lm-search-group-results">
                {g.results.map((r, i) => (
                  <button
                    key={`${r.page_id}-${i}`}
                    onClick={() => {
                      setActiveNotebookId(g.notebook_id);
                      if (r.section_id) setActiveSectionId(r.section_id);
                      setActivePageId(r.page_id);
                      onClose?.();
                    }}
                    className="lm-search-result"
                  >
                    <div className="lm-search-result-title">{r.page_title}</div>
                    <div className="lm-search-result-meta">{r.section_title} · {r.snippet || '—'}</div>
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
