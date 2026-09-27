import { useEffect, useRef } from 'react';

export default function LoginWelcome({ onComplete }) {
  const continueRef = useRef(null);

  useEffect(() => {
    // Motion preferences also govern JavaScript-driven handoffs: do not leave a
    // reduced-motion user on an ornamental intermediate screen.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete();
      return undefined;
    }
    continueRef.current?.focus();
    const timeout = window.setTimeout(onComplete, 2000);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  return (
    <main className="lm-login-welcome" aria-labelledby="login-welcome-title">
      <div className="lm-login-welcome-orbit" aria-hidden="true" />
      <div className="lm-login-welcome-content">
        <h1 id="login-welcome-title">Hallo Cabrera</h1>
        <p>Dein Arbeitsbereich ist bereit.</p>
        <button ref={continueRef} className="lm-login-welcome-continue" type="button" onClick={onComplete}>
          Weiter zu LehrerMaps
        </button>
      </div>
    </main>
  );
}
