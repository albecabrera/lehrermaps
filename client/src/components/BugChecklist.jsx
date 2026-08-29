import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';

const STORAGE_KEY = 'lehrermaps-bug-checklist';

const createItem = () => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  text: '',
  completed: false,
});

export function BugChecklistIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 6.5 6.1 4.6M12 6.5l1.9-1.9M7 10H3.5M7 13.5l-2.2 1.8M13 10h3.5M13 13.5l2.2 1.8" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M7 8.3c0-2 1.3-3.3 3-3.3s3 1.3 3 3.3v4.2c0 2-1.3 3.5-3 3.5s-3-1.5-3-3.5V8.3Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M8.6 8.2h.01M11.4 8.2h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function BugChecklist({ open, onClose, t }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string') : [];
    } catch {
      return [];
    }
  });
  const inputRefs = useRef(new Map());
  const focusItemId = useRef(null);
  const closeButtonRef = useRef(null);

  useEscapeKey(open, onClose);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // The checklist remains usable if storage is unavailable or full.
    }
  }, [items]);

  useEffect(() => {
    if (!open || !focusItemId.current) return;
    const input = inputRefs.current.get(focusItemId.current);
    if (input) {
      input.focus();
      input.select();
      focusItemId.current = null;
    }
  }, [items, open]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  const addItem = (index = items.length) => {
    const item = createItem();
    focusItemId.current = item.id;
    setItems((current) => [...current.slice(0, index), item, ...current.slice(index)]);
  };

  const updateItem = (id, changes) => setItems((current) => current.map((item) => (
    item.id === id ? { ...item, ...changes } : item
  )));

  const deleteItem = (id, index) => {
    const nextItem = items[index + 1] || items[index - 1];
    focusItemId.current = nextItem?.id || null;
    setItems((current) => current.filter((item) => item.id !== id));
  };

  if (!open) return null;

  const completedCount = items.filter((item) => item.completed).length;
  return createPortal(
    <div className="lm-checklist-backdrop" onMouseDown={onClose}>
      <section className="lm-checklist-modal lm-modal-surface" role="dialog" aria-modal="true" aria-labelledby="bug-checklist-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="lm-checklist-header">
          <div className="lm-checklist-title-wrap">
            <span className="lm-checklist-icon"><BugChecklistIcon size={18} /></span>
            <div><h2 id="bug-checklist-title">{t('bug_checklist.title')}</h2><p>{t('bug_checklist.progress', { completed: completedCount, total: items.length })}</p></div>
          </div>
          <button ref={closeButtonRef} className="lm-checklist-close" type="button" onClick={onClose} aria-label={t('bug_checklist.close')}>×</button>
        </header>
        <div className="lm-checklist-items" aria-label={t('bug_checklist.items_label')}>
          {items.length === 0 ? <p className="lm-checklist-empty">{t('bug_checklist.empty')}</p> : items.map((item, index) => (
            <div className="lm-checklist-item" key={item.id}>
              <input className="lm-checklist-toggle" type="checkbox" checked={item.completed} onChange={() => updateItem(item.id, { completed: !item.completed })} aria-label={t(item.completed ? 'bug_checklist.reopen' : 'bug_checklist.toggle', { text: item.text || t('bug_checklist.untitled') })} />
              <input ref={(node) => { if (node) inputRefs.current.set(item.id, node); else inputRefs.current.delete(item.id); }} className="lm-checklist-input" value={item.text} onChange={(event) => updateItem(item.id, { text: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addItem(index + 1); } }} aria-label={t('bug_checklist.item_label', { number: index + 1 })} placeholder={t('bug_checklist.placeholder')} />
              <button className="lm-checklist-delete" type="button" onClick={() => deleteItem(item.id, index)} aria-label={t('bug_checklist.delete', { text: item.text || t('bug_checklist.untitled') })}><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4m-5.5 0 .6 9h5.8l.6-9M6.5 7v3.5M9.5 7v3.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            </div>
          ))}
        </div>
        <footer className="lm-checklist-footer"><button className="lm-checklist-add" type="button" onClick={() => addItem()}><span aria-hidden="true">+</span> {t('bug_checklist.add')}</button><span>{t('bug_checklist.enter_hint')}</span></footer>
      </section>
    </div>,
    document.body,
  );
}
