import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

/**
 * Floating dev-only panel.
 *
 *  1. Lists translation keys requested via t() but missing for the active
 *     language (populated by the LanguageProvider into window.__i18nMissing).
 *  2. Scans the visible DOM (page body, currently-open menus, modals, popovers,
 *     toasts) and flags hardcoded text that does NOT match the active
 *     language — e.g. English literals when lang=bn, or Bangla literals when
 *     lang=en. Helps catch strings that bypass t() entirely.
 */

const BN_RE = /[\u0980-\u09FF]/;
const HAS_LETTER_RE = /[A-Za-z]/;
// Words / tokens we never flag — brands, file types, units, etc.
const ALLOW = new Set([
  "Lovable", "PDF", "CSV", "XLSX", "Excel", "QR", "OTP", "ID", "URL", "API",
  "SMS", "JSON", "UI", "UX", "OK", "DB", "USD", "BDT", "Tk", "kg", "ml", "GB",
  "MB", "KB", "TB", "v1", "v2", "AM", "PM",
]);

type Hardcoded = { text: string; tag: string; route: string };

function getRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.body;
}

function isVisible(el: Element): boolean {
  const he = el as HTMLElement;
  if (!he.getClientRects || he.getClientRects().length === 0) return false;
  const cs = window.getComputedStyle(he);
  if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false;
  return true;
}

function shouldSkip(el: Element): boolean {
  const tag = el.tagName;
  if (
    tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" ||
    tag === "CODE" || tag === "PRE" || tag === "SVG" ||
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
    tag === "OPTION"
  ) return true;
  const he = el as HTMLElement;
  if (he.isContentEditable) return true;
  if (he.dataset && (he.dataset.i18nIgnore === "true" || he.dataset.i18nIgnore === "")) return true;
  // Skip the dev panel itself
  if (he.closest?.("[data-i18n-panel]")) return true;
  const cls = (he.className && typeof he.className === "string") ? he.className : "";
  if (cls.includes("font-mono") || cls.includes("tabular-nums")) return true;
  return false;
}

function isFlaggable(text: string, lang: "en" | "bn"): boolean {
  const s = text.trim();
  if (s.length < 2) return false;
  // strip numbers, punctuation
  const stripped = s.replace(/[\d\s.,:;%/()\-—–_+=*<>!?'"`#@$&|\\]/g, "");
  if (stripped.length < 2) return false;
  if (ALLOW.has(s)) return false;
  // If no letters at all (just symbols/numbers), skip
  if (!HAS_LETTER_RE.test(s) && !BN_RE.test(s)) return false;

  if (lang === "bn") {
    // Flag if it has ASCII letters but NO Bangla characters
    if (HAS_LETTER_RE.test(s) && !BN_RE.test(s)) {
      // ignore single ALL-CAPS acronyms <= 4 chars
      if (/^[A-Z0-9]{1,4}$/.test(s)) return false;
      return true;
    }
  } else {
    // lang === en: flag if Bangla characters appear
    if (BN_RE.test(s)) return true;
  }
  return false;
}

function pathFor(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && depth < 4) {
    let s = cur.tagName.toLowerCase();
    const id = (cur as HTMLElement).id;
    if (id) { s += `#${id}`; parts.unshift(s); break; }
    const cls = (cur as HTMLElement).className;
    if (cls && typeof cls === "string") {
      const first = cls.trim().split(/\s+/)[0];
      if (first) s += `.${first}`;
    }
    parts.unshift(s);
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(">");
}

function scanHardcoded(lang: "en" | "bn", route: string): Hardcoded[] {
  const root = getRoot();
  if (!root) return [];
  const out: Hardcoded[] = [];
  const seen = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n: Node) {
      const parent = n.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (shouldSkip(parent)) return NodeFilter.FILTER_REJECT;
      // walk up — skip if any ancestor opted out
      let p: Element | null = parent;
      while (p) {
        if (shouldSkip(p)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      const txt = (n.nodeValue || "").trim();
      if (!txt) return NodeFilter.FILTER_REJECT;
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let cur: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((cur = walker.nextNode())) {
    const text = (cur.nodeValue || "").trim();
    if (!isFlaggable(text, lang)) continue;
    const key = text.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    const parent = cur.parentElement!;
    out.push({ text: key, tag: pathFor(parent), route });
    if (out.length >= 200) break;
  }
  return out;
}

export function MissingI18nPanel() {
  const { lang, t } = useLang();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"keys" | "hard">("keys");
  const [hard, setHard] = useState<Hardcoded[]>([]);
  const [, setTick] = useState(0);

  // Re-scan on route change, language change, when opened, and periodically to
  // pick up newly-opened menus/dialogs/popovers.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let raf = 0;
    const run = () => {
      setHard(scanHardcoded(lang as "en" | "bn", loc.pathname));
      setTick((n) => n + 1);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(run);
    };
    schedule();
    const id = window.setInterval(schedule, 1500);
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
      obs.disconnect();
    };
  }, [lang, loc.pathname]);

  const map: Map<string, { lang: string; route: string }> =
    (typeof window !== "undefined" && (window as any).__i18nMissing) || new Map();
  const keyItems = useMemo(() => Array.from(map.entries()), [map]);
  const total = keyItems.length + hard.length;

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] no-print" data-i18n-panel>
      {!open ? (
        <Button
          size="sm"
          variant={total ? "destructive" : "outline"}
          onClick={() => setOpen(true)}
          className="shadow-lg gap-1.5"
        >
          <Bug className="h-4 w-4" />
          i18n {total ? `(${total})` : "✓"}
        </Button>
      ) : (
        <div className="w-96 max-h-[28rem] rounded-md border bg-card shadow-xl flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{t("p5_missingI18nPanelTitle")}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                lang={lang} · {loc.pathname}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  (window as any).__i18nMissing = new Map();
                  setHard([]);
                  setTick((n) => n + 1);
                }}
              >{t("p5_clear")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>×</Button>
            </div>
          </div>

          <div className="flex border-b text-xs">
            <button
              className={`flex-1 px-3 py-2 ${tab === "keys" ? "bg-muted font-medium" : ""}`}
              onClick={() => setTab("keys")}
            >
              Missing keys ({keyItems.length})
            </button>
            <button
              className={`flex-1 px-3 py-2 ${tab === "hard" ? "bg-muted font-medium" : ""}`}
              onClick={() => setTab("hard")}
            >
              Hardcoded text ({hard.length})
            </button>
          </div>

          <div className="flex-1 overflow-auto text-xs">
            {tab === "keys" ? (
              keyItems.length === 0 ? (
                <div className="p-3 text-muted-foreground">No missing keys 🎉</div>
              ) : keyItems.map(([key, info]) => (
                <div key={key} className="px-3 py-1.5 border-b">
                  <div className="font-mono text-[11px]">{key}</div>
                  <div className="text-[10px] text-muted-foreground">
                    lang={info.lang} · {info.route}
                  </div>
                </div>
              ))
            ) : (
              hard.length === 0 ? (
                <div className="p-3 text-muted-foreground">No hardcoded text on this view 🎉</div>
              ) : hard.map((h, i) => (
                <div key={i} className="px-3 py-1.5 border-b">
                  <div className="text-[12px]">{h.text}</div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    {h.tag}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            Tip: add <code>data-i18n-ignore</code> to elements to silence false positives.
          </div>
        </div>
      )}
    </div>
  );
}
