import { createContext, useContext, useLayoutEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('lm_theme') === 'dark');

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('lm_theme', isDark ? 'dark' : 'light');
    // Standalone-/Browser-Statusleiste synchron zum Theme halten
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', isDark ? '#0D1117' : '#F8F9FB');
    // Remove no-transition guard once theme is applied
    document.documentElement.classList.remove('lm-no-transition');
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => setIsDark((d) => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
