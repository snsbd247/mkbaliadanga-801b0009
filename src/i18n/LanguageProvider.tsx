import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";
import { supabase } from "@/integrations/supabase/client";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TranslationKey) => string;
  /**
   * Inline bilingual helper — returns `en` or `bn` based on active language.
   * Use for one-off page-local strings instead of polluting translations.ts.
   *   <Button>{tx("Save", "সংরক্ষণ")}</Button>
   */
  tx: (en: string, bn: string) => string;
}

const LanguageContext = createContext<Ctx | undefined>(undefined);

// --- Fuzzy fallback ----------------------------------------------------------
// When a key is missing in BOTH languages, return the value of the closest
// matching key (Levenshtein distance) instead of the raw key. Cached forever
// per (lang, key) so the cost is paid at most once.

const fuzzyCache = new Map<string, string>();
let allKeys: string[] | null = null;

function getAllKeys(): string[] {
  if (allKeys) return allKeys;
  const set = new Set<string>();
  for (const l of Object.keys(translations)) {
    for (const k of Object.keys((translations as any)[l])) set.add(k);
  }
  allKeys = Array.from(set);
  return allKeys;
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function fuzzyResolve(key: string, lang: Lang): string | null {
  const cacheKey = `${lang}:${key}`;
  if (fuzzyCache.has(cacheKey)) return fuzzyCache.get(cacheKey)!;
  const keys = getAllKeys();
  const max = Math.max(2, Math.min(6, Math.floor(key.length / 3)));
  let best: string | null = null;
  let bestD = max + 1;
  const lk = key.toLowerCase();
  for (const k of keys) {
    const d = levenshtein(lk, k.toLowerCase(), bestD);
    if (d < bestD) { bestD = d; best = k; if (d === 0) break; }
  }
  if (!best) return null;
  const value =
    (translations[lang] as any)[best] ||
    (translations.en as any)[best] ||
    (translations.bn as any)[best] ||
    null;
  if (value) fuzzyCache.set(cacheKey, value);
  return value;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");
  const userIdRef = useRef<string | null>(null);
  const remoteLoadedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // --- Persist preference to profiles.language for logged-in users ---------
  // On auth change, load the user's saved language (overrides localStorage on
  // first read so multi-device users see the same UI). Anonymous users keep
  // using localStorage only.
  useEffect(() => {
    let cancelled = false;

    async function loadForUser(uid: string) {
      const { data } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      const remote = (data as any)?.language as Lang | undefined;
      if (remote === "en" || remote === "bn") {
        remoteLoadedRef.current = true;
        setLangState(remote);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      userIdRef.current = uid;
      if (uid) loadForUser(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user?.id ?? null;
      userIdRef.current = uid;
      remoteLoadedRef.current = false;
      if (uid) loadForUser(uid);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    const uid = userIdRef.current;
    if (uid) {
      // Fire-and-forget; failures are non-fatal (localStorage still works).
      supabase
        .from("profiles")
        .update({ language: l })
        .eq("id", uid)
        .then(() => {/* noop */});
    }
  };

  const warned = (typeof window !== "undefined") ? ((window as any).__i18nWarned ??= new Set<string>()) : new Set<string>();
  const missing: Map<string, { lang: string; route: string }> =
    (typeof window !== "undefined") ? ((window as any).__i18nMissing ??= new Map()) : new Map();
  const t = (k: TranslationKey) => {
    // 1. exact match in active lang
    const v = (translations[lang] as any)[k];
    if (v != null && v !== "") return v;

    // 2. exact match in opposite lang
    const otherLang: Lang = lang === "en" ? "bn" : "en";
    const other = (translations[otherLang] as any)[k];

    const route = typeof window !== "undefined" ? window.location.pathname : "";
    if (import.meta.env.DEV) {
      missing.set(String(k), { lang, route });
      if (!warned.has(k as string)) {
        warned.add(k as string);
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing translation for key "${String(k)}" in lang "${lang}" at ${route}`);
      }
    }
    if (other != null && other !== "") return other;

    // 3. fuzzy nearest key
    const fuzzy = fuzzyResolve(String(k), lang);
    if (fuzzy) return fuzzy;

    // 4. last resort: humanize the key (camelCase → spaced) instead of raw key
    return String(k)
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  };

  const tx = (en: string, bn: string) => (lang === "bn" ? bn : en);

  return <LanguageContext.Provider value={{ lang, setLang, t, tx }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
