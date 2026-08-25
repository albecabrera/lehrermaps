import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

const TEMPLATES = [
  { id: 'lesson', name: 'Stundenvorbereitung' },
  { id: 'parent', name: 'Elterngespräch' },
  { id: 'classnote', name: 'Klassennotiz' },
  { id: 'empty', name: 'Leer' },
];

export default function PageTemplates({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('Neue Seite');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVisible(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setVisible(false);
        setTimeout(() => onClose?.(), 140);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={() => {
        setVisible(false);
        setTimeout(() => onClose?.(), 140);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: `rgba(0,0,0,${visible ? 0.34 : 0})`,
        display: 'grid',
        placeItems: 'center',
        zIndex: 4500,
        transition: 'background 140ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '92vw',
          maxHeight: '86vh',
          overflow: 'auto',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 12,
          boxShadow: '0 18px 40px rgba(0,0,0,.22)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.99)',
          transition: 'opacity 140ms ease, transform 140ms ease',
        }}
      >
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', fontWeight: 700, fontSize: 14 }}>Page Templates</div>
        <div style={{ padding: 14 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            style={{ width: '100%', marginBottom: 10, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'grid', gap: 8 }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onCreate?.({ templateId: t.id, title: title.trim() || 'Neue Seite' })}
                style={{ border: '1px solid var(--c-border)', background: 'var(--c-hover)', color: 'var(--c-text)', borderRadius: 8, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text-2)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
