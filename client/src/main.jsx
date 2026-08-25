import { StrictMode, lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPanel from './pages/LoginPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { LangProvider } from './contexts/LangContext';
import { NotebookProvider } from './contexts/NotebookContext';
import { getOfflineQueueSize, syncOfflineMutations } from './lib/api';

// Authenticated workspaces load only after login; their existing markup and
// styles remain unchanged.
const App = lazy(() => import('./pages/App'));
const StudentApp = lazy(() => import('./pages/StudentApp'));
const ExamBoard = lazy(() => import('./components/ExamBoard'));

// NotebookProvider is intentionally NOT at root — it makes authenticated API
// calls on mount that fail with 401 during login, causing re-renders that
// produce compositing flicker in Chromium. It's mounted inside Root only
// when the user is already authenticated as 'lehrer'.

// Arc-only flicker guard. Arc's compositor repaints heavy gradient/shadow layers
// on the login screen (Chrome does not). Arc injects --arc-palette-* CSS vars on
// the document element; Chrome never does — so this tags Arc only, leaving Chrome
// untouched (the prior lm-arc-safe attempt wrongly targeted all of Chromium).
(function tagArc() {
  const detect = () => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--arc-palette-title');
    if (v && v.trim() !== '') {
      document.documentElement.classList.add('lm-arc');
      return true;
    }
    return false;
  };
  if (!detect()) {
    // Arc may inject its palette vars slightly after first paint — retry briefly.
    let tries = 0;
    const id = setInterval(() => {
      if (detect() || ++tries > 10) clearInterval(id);
    }, 50);
  }
}());

// Bootstrap ?token= before React mounts — runs once, no side effects inside render
(function bootstrapUrlToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (!urlToken) return;
  localStorage.setItem('lm_token', urlToken);
  params.delete('token');
  window.history.replaceState(null, '', params.toString() ? `?${params}` : window.location.pathname);
}());

function parseRole(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).role;
  } catch { return null; }
}

const SESSION_EXAMS_KEY = 'lm_exams_board_seen';

function OfflineStatus() {
  const [pending, setPending] = useState(() => getOfflineQueueSize());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const refresh = () => { setPending(getOfflineQueueSize()); setOnline(navigator.onLine); };
    window.addEventListener('online', refresh); window.addEventListener('offline', refresh); window.addEventListener('lm-offline-queue-change', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); window.removeEventListener('lm-offline-queue-change', refresh); };
  }, []);
  if (online && !pending) return null;
  return <button type="button" onClick={() => syncOfflineMutations()} title="Offline-Synchronisierung" style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 5000, border: '1px solid var(--c-border)', borderRadius: 999, padding: '8px 12px', background: online ? 'var(--c-surface)' : '#92400e', color: online ? 'var(--c-text)' : '#fff', fontSize: 12, fontWeight: 700 }}>{online ? `Synchronisierung ausstehend (${pending})` : 'Offline · Änderungen werden lokal gespeichert'}</button>;
}

function Root() {
  const [tick, setTick] = useState(0);
  const [examsDismissed, setExamsDismissed] = useState(
    () => !!sessionStorage.getItem(SESSION_EXAMS_KEY)
  );

  const token = localStorage.getItem('lm_token');
  const role = token ? parseRole(token) : null;

  const handleLogin = () => {
    sessionStorage.removeItem(SESSION_EXAMS_KEY);
    setExamsDismissed(false);
    setTick((n) => n + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem('lm_token');
    setTick((n) => n + 1);
  };

  const handleExamsDismiss = () => {
    sessionStorage.setItem(SESSION_EXAMS_KEY, '1');
    setExamsDismissed(true);
  };

  if (role === 'lehrer') {
    return (
      <NotebookProvider>
        <Suspense fallback={null}>
          {!examsDismissed && <ExamBoard onDismiss={handleExamsDismiss} />}
          <App onLogout={handleLogout} />
          <OfflineStatus />
        </Suspense>
      </NotebookProvider>
    );
  }
  if (role === 'student') return <Suspense fallback={null}><StudentApp onLogout={handleLogout} /></Suspense>;

  // Pre-select student role if coming from QR (?student in URL)
  const initialRole = new URLSearchParams(window.location.search).has('student') ? 'student' : null;
  return <LoginPanel onLogin={handleLogin} initialRole={initialRole} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LangProvider>
          <Root />
        </LangProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
