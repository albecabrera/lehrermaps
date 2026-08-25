import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const OPTIONS = [
  { key: 'todo', label: '/todo' },
  { key: 'table', label: '/table' },
  { key: 'code', label: '/code' },
  { key: 'image', label: '/image' },
  { key: 'divider', label: '/divider' },
  { key: 'heading', label: '/heading' },
];

export default function SlashMenu({ open, x, y, onSelect, onClose }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((v) => (v + 1) % OPTIONS.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((v) => (v - 1 + OPTIONS.length) % OPTIONS.length); }
      else if (e.key === 'Enter') { e.preventDefault(); onSelect?.(OPTIONS[idx].key); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, idx, onClose, onSelect]);

  if (!open) return null;

  return createPortal(
    <div style={{ position: 'fixed', left: x, top: y, zIndex: 5000, width: 180, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.14)', padding: 6 }}>
      {OPTIONS.map((o, i) => (
        <button
          key={o.key}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect?.(o.key)}
          style={{ width: '100%', border: 'none', background: i === idx ? 'var(--c-hover-2)' : 'transparent', color: 'var(--c-text)', textAlign: 'left', padding: '7px 9px', fontSize: 12, borderRadius: 7, cursor: 'pointer' }}
        >
          {o.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
