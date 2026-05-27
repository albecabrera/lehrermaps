import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './pages/App';
import ErrorBoundary from './components/ErrorBoundary';
import StudentApp from './pages/StudentApp';
import LoginPanel from './pages/LoginPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { LangProvider } from './contexts/LangContext';
import { NotebookProvider } from './contexts/NotebookContext';

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

function Root() {
  const [tick, setTick] = useState(0);

  const token = localStorage.getItem('lm_token');
  const role = token ? parseRole(token) : null;

  const handleLogin = () => setTick((n) => n + 1);

  const handleLogout = () => {
    localStorage.removeItem('lm_token');
    setTick((n) => n + 1);
  };

  if (role === 'lehrer') return <App onLogout={handleLogout} />;
  if (role === 'student') return <StudentApp onLogout={handleLogout} />;

  // Pre-select student role if coming from QR (?student in URL)
  const initialRole = new URLSearchParams(window.location.search).has('student') ? 'student' : null;
  return <LoginPanel onLogin={handleLogin} initialRole={initialRole} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LangProvider>
          <NotebookProvider>
            <Root />
          </NotebookProvider>
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
