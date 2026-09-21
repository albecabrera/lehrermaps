import { StrictMode, lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPanel from './pages/LoginPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { LangProvider } from './contexts/LangContext';
import { NotebookProvider } from './contexts/NotebookContext';

// Authenticated workspaces load only after login; their existing markup and
// styles remain unchanged.
const App = lazy(() => import('./pages/App'));
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

// Tokens are accepted only through authenticated API headers. If an old link
// still contains one, remove it without importing it into browser storage.
(function discardUrlToken() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('token')) return;
  url.searchParams.delete('token');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}());

function isTeacherToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).role === 'lehrer';
  } catch { return null; }
}

const SESSION_EXAMS_KEY = 'lm_exams_board_seen';

function Root() {
  const [tick, setTick] = useState(0);
  const [examsDismissed, setExamsDismissed] = useState(true);

  const token = localStorage.getItem('lm_token');
  const isTeacher = token ? isTeacherToken(token) : false;

  const handleLogin = () => {
    sessionStorage.removeItem(SESSION_EXAMS_KEY);
    setExamsDismissed(true);
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

  if (isTeacher) {
    return (
      <NotebookProvider>
        <Suspense fallback={null}>
          {!examsDismissed && <ExamBoard onDismiss={handleExamsDismiss} />}
          <App onLogout={handleLogout} />
        </Suspense>
      </NotebookProvider>
    );
  }
  return <LoginPanel onLogin={handleLogin} />;
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
