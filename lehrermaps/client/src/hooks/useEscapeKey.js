import { useEffect } from 'react';

/**
 * Cierra un overlay/modal al presionar Escape.
 * La app documenta "Esc = Modal / Vorschau schließen" en KeyboardHelp,
 * este hook hace que el código cumpla ese contrato.
 *
 * @param {boolean} enabled - true cuando el modal está montado/abierto
 * @param {() => void} onClose - handler de cierre
 */
export function useEscapeKey(enabled, onClose) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, onClose]);
}
