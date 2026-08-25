import { useEffect } from 'react';

export default function FocusMode({ active, onExit, children }) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onExit?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onExit]);

  return (
    <div style={{ display: 'contents' }} data-focus-mode={active ? 'on' : 'off'}>
      {children}
    </div>
  );
}
