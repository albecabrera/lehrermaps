import { createContext, useContext, useLayoutEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('lm_theme') === 'dark');

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('lm_theme', isDark ? 'dark' : 'light');
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
