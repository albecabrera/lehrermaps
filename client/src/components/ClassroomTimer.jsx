import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const clampPart = (value, max = 59) => Math.min(max, Math.max(0, Number.parseInt(value, 10) || 0));
const toSeconds = ({ hours, minutes, seconds }) => (clampPart(hours, 99) * 3600) + (clampPart(minutes) * 60) + clampPart(seconds);
const formatDuration = (totalSeconds) => {
  const total = Math.max(0, totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

function Icon({ children }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export default function ClassroomTimer({ open, onClose }) {
  const surfaceRef = useRef(null);
  const deadlineRef = useRef(null);
  const remainingRef = useRef(5 * 60);
  const [mode, setMode] = useState('clock');
  const [now, setNow] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState({ hours: 0, minutes: 5, seconds: 0 });
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fullscreenNotice, setFullscreenNotice] = useState('');

  const syncTime = useCallback(() => {
    const timestamp = Date.now();
    setNow(timestamp);
    if (!deadlineRef.current) return;
    const next = Math.max(0, Math.ceil((deadlineRef.current - timestamp) / 1000));
    remainingRef.current = next;
    setRemaining(next);
    if (next === 0) {
      deadlineRef.current = null;
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    syncTime();
    const interval = window.setInterval(syncTime, 250);
    return () => window.clearInterval(interval);
  }, [open, syncTime]);

  useEffect(() => {
    if (!open) return undefined;
    const onFullscreenChange = () => {
      setNativeFullscreen(document.fullscreenElement === surfaceRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.fullscreenElement === surfaceRef.current) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => setFullscreenNotice('Vollbild konnte nicht beendet werden.'));
        return;
      }
      onClose?.();
    };
    // Capture stops App-level shortcuts and makes Esc deterministic for the dialog.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const applyDuration = useCallback(() => {
    const next = toSeconds(duration);
    deadlineRef.current = null;
    remainingRef.current = next;
    setRemaining(next);
    setRunning(false);
  }, [duration]);

  const startPause = useCallback(() => {
    if (running) {
      const next = deadlineRef.current ? Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)) : remainingRef.current;
      deadlineRef.current = null;
      remainingRef.current = next;
      setRemaining(next);
      setRunning(false);
      return;
    }
    if (remainingRef.current <= 0) return;
    deadlineRef.current = Date.now() + remainingRef.current * 1000;
    setRunning(true);
    syncTime();
  }, [running, syncTime]);

  const reset = useCallback(() => {
    deadlineRef.current = null;
    const next = toSeconds(duration);
    remainingRef.current = next;
    setRemaining(next);
    setRunning(false);
  }, [duration]);

  const clear = useCallback(() => {
    deadlineRef.current = null;
    remainingRef.current = 0;
    setDuration({ hours: 0, minutes: 0, seconds: 0 });
    setRemaining(0);
    setRunning(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    setFullscreenNotice('');
    if (document.fullscreenElement === surfaceRef.current) {
      if (!document.exitFullscreen) {
        setFullscreenNotice('Vollbild kann in diesem Browser nicht beendet werden.');
        return;
      }
      try { await document.exitFullscreen(); } catch { setFullscreenNotice('Vollbild konnte nicht beendet werden.'); }
      return;
    }
    if (!surfaceRef.current?.requestFullscreen) {
      setFullscreenNotice('Vollbild ist in diesem Browser nicht verfügbar – die Großansicht bleibt geöffnet.');
      return;
    }
    try {
      await surfaceRef.current.requestFullscreen();
    } catch {
      setFullscreenNotice('Vollbild wurde blockiert – die Großansicht bleibt geöffnet.');
    }
  }, []);

  const closeTimer = useCallback(async () => {
    if (document.fullscreenElement === surfaceRef.current && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch { /* browser may already be closing the fullscreen element */ }
    }
    onClose?.();
  }, [onClose]);

  if (!open) return null;
  const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  const display = mode === 'clock' ? clock : formatDuration(remaining);

  return createPortal(
    <div className="lm-classroom-timer-backdrop" role="presentation">
      <section ref={surfaceRef} className="lm-classroom-timer" role="dialog" aria-modal="true" aria-labelledby="classroom-timer-title">
        <header className="lm-classroom-timer-header">
          <div><p className="lm-classroom-timer-kicker">Classroom tools</p><h2 id="classroom-timer-title">Klassenzeit</h2></div>
          <div className="lm-classroom-timer-header-actions">
            <button className="lm-classroom-timer-icon-button" type="button" onClick={toggleFullscreen} aria-label={nativeFullscreen ? 'Vollbild verlassen' : 'Timer im Vollbild öffnen'} title={nativeFullscreen ? 'Vollbild verlassen' : 'Vollbild'}><Icon><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></Icon></button>
            <button className="lm-classroom-timer-icon-button" type="button" onClick={closeTimer} aria-label="Timer schließen" title="Schließen"><span aria-hidden="true">×</span></button>
          </div>
        </header>

        <div className="lm-classroom-timer-mode" role="tablist" aria-label="Zeitmodus">
          <button type="button" role="tab" aria-selected={mode === 'clock'} className={mode === 'clock' ? 'is-active' : ''} onClick={() => setMode('clock')}>Uhrzeit</button>
          <button type="button" role="tab" aria-selected={mode === 'countdown'} className={mode === 'countdown' ? 'is-active' : ''} onClick={() => setMode('countdown')}>Countdown</button>
        </div>

        <main className="lm-classroom-timer-main">
          <p className="lm-classroom-timer-status" aria-live="polite">{mode === 'clock' ? 'Aktuelle Uhrzeit' : running ? 'Countdown läuft' : remaining === 0 ? 'Zeit abgelaufen' : 'Bereit zum Start'}</p>
          <output className={`lm-classroom-timer-display${mode === 'countdown' && remaining <= 60 && remaining > 0 ? ' is-urgent' : ''}`}>{display}</output>
          {mode === 'countdown' && <>
            <div className="lm-classroom-timer-editor" aria-label="Countdown-Dauer festlegen">
              {[['hours', 'Std.', 99], ['minutes', 'Min.', 59], ['seconds', 'Sek.', 59]].map(([key, label, max]) => <label key={key}><span>{label}</span><input type="number" min="0" max={max} inputMode="numeric" value={duration[key]} onChange={(event) => setDuration((current) => ({ ...current, [key]: event.target.value }))} onBlur={applyDuration} /></label>)}
              <button type="button" className="lm-classroom-timer-apply" onClick={applyDuration}>Übernehmen</button>
            </div>
            <div className="lm-classroom-timer-controls">
              <button type="button" className="lm-classroom-timer-primary" onClick={startPause} disabled={!running && remaining === 0}>{running ? 'Pausieren' : 'Starten'}</button>
              <button type="button" onClick={reset}>Zurücksetzen</button>
              <button type="button" onClick={clear}>Leeren</button>
            </div>
          </>}
          {fullscreenNotice && <p className="lm-classroom-timer-notice" role="status">{fullscreenNotice}</p>}
        </main>
        <footer className="lm-classroom-timer-footer">{nativeFullscreen ? 'Esc beendet zuerst nur das Vollbild.' : 'Esc schließt den Timer.'}</footer>
      </section>
    </div>,
    document.body,
  );
}
