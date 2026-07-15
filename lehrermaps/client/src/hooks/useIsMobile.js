import { useEffect, useState } from 'react';

/**
 * true unterhalb von `breakpoint`px. Treibt den Wechsel von der
 * Desktop-3-Spalten-Ansicht (Sidebar + Inhalt + Vorschau nebeneinander)
 * zu Drawer/Vollbild-Overlay-Mustern auf schmalen Bildschirmen.
 */
export function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}
