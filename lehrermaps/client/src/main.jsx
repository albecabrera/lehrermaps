import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Login from './pages/Login';
import App from './pages/App';
import StudentLogin from './pages/StudentLogin';
import StudentApp from './pages/StudentApp';
import { ThemeProvider } from './contexts/ThemeContext';
import { LangProvider } from './contexts/LangContext';

function parseRole(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).role;
  } catch { return null; }
}

function Root() {
  const isStudentMode = new URLSearchParams(window.location.search).has('student');
  const [tick, setTick] = useState(0);

  const token = localStorage.getItem('lm_token');
  const role = token ? parseRole(token) : null;

  const handleLogin = () => setTick((n) => n + 1);

  const handleLogout = () => {
    localStorage.removeItem('lm_token');
    setTick((n) => n + 1);
    if (isStudentMode) window.location.href = '/';
  };

  if (isStudentMode) {
    if (role === 'student') return <StudentApp onLogout={handleLogout} />;
    return <StudentLogin onLogin={handleLogin} />;
  }

  if (role === 'lehrer') return <App onLogout={handleLogout} />;
  return <Login onLogin={handleLogin} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LangProvider>
        <Root />
      </LangProvider>
    </ThemeProvider>
  </StrictMode>
);
