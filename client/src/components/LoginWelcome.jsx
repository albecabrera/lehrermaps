import { useEffect } from 'react';

export default function LoginWelcome({ onComplete }) {
  useEffect(() => {
    // Motion preferences also govern JavaScript-driven handoffs: do not leave a
    // reduced-motion user on an ornamental intermediate screen.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete();
      return undefined;
    }
    const timeout = window.setTimeout(onComplete, 2000);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  return (
    <main className="lm-login-welcome" aria-labelledby="login-welcome-title">
      <div className="lm-login-welcome-orbit" aria-hidden="true" />
      <div className="lm-login-welcome-content">
        <h1 id="login-welcome-title">Hallo Cabrera</h1>
      </div>
    </main>
  );
}
