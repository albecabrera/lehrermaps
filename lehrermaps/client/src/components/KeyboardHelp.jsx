import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Globale Suche öffnen' },
  { keys: ['?'], label: 'Diese Hilfe anzeigen' },
  { keys: ['J'], label: 'Nächste Datei auswählen' },
  { keys: ['K'], label: 'Vorherige Datei auswählen' },
  { keys: ['Space'], label: 'Vorschau ein-/ausblenden' },
  { keys: ['Esc'], label: 'Modal / Vorschau schließen' },
];

export default function KeyboardHelp({ onClose }) {
  useEscapeKey(true, onClose);
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'var(--c-overlay)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        className="lm-modal-surface"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)',
          borderRadius: 14, boxShadow: 'var(--c-shadow-modal)',
          width: '100%', maxWidth: 360, overflow: 'hidden',
          animation: 'lmSlideUp .16s cubic-bezier(.4,.7,.3,1)',
        }}
      >
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Tastenkürzel</span>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, border: 'none', borderRadius: 6,
              background: 'var(--c-hover)', color: 'var(--c-text-2)',
              cursor: 'pointer', fontSize: 14, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
        <div style={{ padding: '8px 0 12px' }}>
          {SHORTCUTS.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 18px',
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--c-text-2)' }}>{s.label}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map((k) => (
                  <kbd key={k} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 24, height: 22, padding: '0 6px',
                    background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                    borderRadius: 5, fontSize: 11, fontWeight: 600,
                    color: 'var(--c-text)', fontFamily: '"DM Mono", monospace',
                    boxShadow: '0 1px 0 var(--c-border)',
                  }}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '10px 18px', borderTop: '1px solid var(--c-border)',
          fontSize: 11, color: 'var(--c-text-3)', textAlign: 'center',
        }}>
          Drücke <kbd style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--c-border)', borderRadius: 4, background: 'var(--c-surface-2)' }}>Esc</kbd> oder klick außerhalb zum Schließen
        </div>
      </div>
    </div>,
    document.body
  );
}
