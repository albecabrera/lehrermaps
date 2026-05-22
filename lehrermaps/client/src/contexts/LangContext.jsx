import { createContext, useContext, useState } from 'react';
import { translations } from '../constants/translations';

const LangContext = createContext({ lang: 'de', t: (k) => k, setLang: () => {} });
const SUPPORTED_LANGS = new Set(['de', 'es', 'en']);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('lm_lang') || 'de';
    return SUPPORTED_LANGS.has(saved) ? saved : 'de';
  });

  const t = (key, vars = {}) => {
    const str = translations[lang]?.[key] ?? translations.de?.[key] ?? key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), str);
  };

  const setLang = (l) => {
    if (!SUPPORTED_LANGS.has(l)) return;
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
