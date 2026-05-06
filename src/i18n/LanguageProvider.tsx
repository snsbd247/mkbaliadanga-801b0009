import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TranslationKey) => string;
}

const LanguageContext = createContext<Ctx | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);

  const warned = (typeof window !== "undefined") ? ((window as any).__i18nWarned ??= new Set<string>()) : new Set<string>();
  const missing: Map<string, { lang: string; route: string }> =
    (typeof window !== "undefined") ? ((window as any).__i18nMissing ??= new Map()) : new Map();
  const t = (k: TranslationKey) => {
    const v = (translations[lang] as any)[k];
    if (v != null && v !== "") return v;
    const en = (translations.en as any)[k];
    const route = typeof window !== "undefined" ? window.location.pathname : "";
    if (import.meta.env.DEV) {
      missing.set(String(k), { lang, route });
      if (!warned.has(k as string)) {
        warned.add(k as string);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing translation for key "${String(k)}" in lang "${lang}" at ${route}`);
      }
    }
    return en != null && en !== "" ? en : String(k);
  };

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
