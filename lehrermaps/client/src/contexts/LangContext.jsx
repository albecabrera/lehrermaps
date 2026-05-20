import { createContext, useContext, useState } from 'react';
import { translations } from '../constants/translations';

const LangContext = createContext({ lang: 'de', t: (k) => k, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lm_lang') || 'de');

  const t = (key, vars = {}) => {
    const str = translations[lang]?.[key] ?? translations.de?.[key] ?? key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), str);
  };

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('lm_lang', l);
  };

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
