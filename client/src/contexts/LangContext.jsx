import { createContext, useContext } from 'react';
import { translations } from '../constants/translations';

const LangContext = createContext({ lang: 'de', t: (k) => k, setLang: () => {} });

export function LangProvider({ children }) {
  const lang = 'de';

  const t = (key, vars = {}) => {
    const str = translations.de?.[key] ?? key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), str);
  };

  const setLang = () => {};

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
