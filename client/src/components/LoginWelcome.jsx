import { useEffect } from 'react';

export const LOGIN_WELCOME_DURATION_MS = 5000;

export default function LoginWelcome({ onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, LOGIN_WELCOME_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <main className="lm-login-welcome" aria-labelledby="login-welcome-title">
      <div className="lm-login-welcome-orbit" aria-hidden="true" />
      <div className="lm-login-welcome-content" role="status" aria-live="polite">
        <h1 id="login-welcome-title">Hallo Cabrera</h1>
      </div>
    </main>
  );
}
