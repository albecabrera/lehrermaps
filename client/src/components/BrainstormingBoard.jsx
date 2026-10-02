import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BRAINSTORMING_BOARD_STORAGE_KEY, readBrainstormingTerms } from '../lib/brainstormingBoard';

export default function BrainstormingBoard({ open, onClose }) {
  const [terms, setTerms] = useState(() => {
    try { return readBrainstormingTerms(window.localStorage); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    try { window.localStorage.setItem(BRAINSTORMING_BOARD_STORAGE_KEY, JSON.stringify(terms)); } catch {}
  }, [terms]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    inputRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('input, button:not(:disabled)') || [])];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const addTerm = (event) => {
    event.preventDefault();
    const term = input.trim();
    if (!term) return;
    setTerms((current) => [...current, term]);
    setInput('');
    setStatus(`„${term}“ hinzugefügt.`);
  };

  const removeTerm = (index) => {
    const removed = terms[index];
    setTerms((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setStatus(`„${removed}“ entfernt.`);
  };

  const clearBoard = () => {
    setTerms([]);
    setStatus('Das Board wurde geleert.');
  };

  return createPortal(
    <div className="lm-qr-tool-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="lm-qr-tool lm-brainstorm-board" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="lm-qr-tool-header">
          <div>
            <span className="lm-qr-tool-eyebrow">Unterrichtstool</span>
            <h2 id={titleId}>Brainstorming-Board</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Brainstorming-Board schließen" title="Schließen">×</button>
        </header>
        <div className="lm-qr-tool-content lm-brainstorm-board-content">
          <p className="lm-brainstorm-board-intro">Sammle Begriffe und Ideen auf einem Board. Deine Einträge bleiben auf diesem Gerät gespeichert.</p>
          <form className="lm-brainstorm-board-form" onSubmit={addTerm}>
            <label htmlFor="lm-brainstorm-board-term">Begriff hinzufügen</label>
            <div className="lm-brainstorm-board-entry">
              <input
                ref={inputRef}
                id="lm-brainstorm-board-term"
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="z. B. Nachhaltigkeit"
                autoComplete="off"
                maxLength={120}
              />
              <button type="submit" disabled={!input.trim()}>Hinzufügen</button>
            </div>
          </form>
          <div className="lm-brainstorm-board-heading">
            <h3>Gesammelte Begriffe</h3>
            <button type="button" className="lm-brainstorm-clear" onClick={clearBoard} disabled={!terms.length}>Board leeren</button>
          </div>
          {terms.length ? (
            <ul className="lm-brainstorm-chips" aria-label="Gesammelte Begriffe">
              {terms.map((term, index) => (
                <li className="lm-brainstorm-chip" key={`${index}-${term}`}>
                  <span>{term}</span>
                  <button type="button" onClick={() => removeTerm(index)} aria-label={`„${term}“ entfernen`} title="Begriff entfernen">×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lm-brainstorm-empty">Noch keine Begriffe. Ergänze deine ersten Ideen oben.</p>
          )}
          <p className="lm-qr-tool-status" role="status" aria-live="polite">{status}</p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
