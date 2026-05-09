import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { translations } from "@/i18n/translations";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bug, Download, Copy } from "lucide-react";

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

type Hardcoded = { text: string; tag: string; route: string; suggestion?: { key: string; value: string; score: number } | null };

// ---- Suggestion engine: build a value→key index across both langs ----------
let valueIndex: Array<{ key: string; value: string; lang: "en" | "bn" }> | null = null;
function getValueIndex() {
  if (valueIndex) return valueIndex;
  const out: Array<{ key: string; value: string; lang: "en" | "bn" }> = [];
  for (const l of ["en", "bn"] as const) {
    const dict = (translations as any)[l] as Record<string, string>;
    for (const k of Object.keys(dict)) {
      const v = dict[k];
      if (typeof v === "string" && v.trim()) out.push({ key: k, value: v, lang: l });
    }
  }
  valueIndex = out;
  return out;
}
function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1), curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i; let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + c);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
function suggestKey(text: string): { key: string; value: string; score: number } | null {
  const idx = getValueIndex();
  const norm = text.trim().toLowerCase();
  // 1. exact case-insensitive match
  for (const e of idx) {
    if (e.value.trim().toLowerCase() === norm) return { key: e.key, value: e.value, score: 1 };
  }
  // 2. fuzzy: small distance relative to length
  const max = Math.max(2, Math.min(8, Math.floor(norm.length / 3)));
  let best: { key: string; value: string; score: number } | null = null;
  let bestD = max + 1;
  for (const e of idx) {
    const v = e.value.trim().toLowerCase();
    if (Math.abs(v.length - norm.length) > bestD) continue;
    const d = lev(norm, v, bestD);
    if (d < bestD) { bestD = d; best = { key: e.key, value: e.value, score: 1 - d / Math.max(norm.length, v.length) }; if (d === 0) break; }
  }
  return best && best.score >= 0.5 ? best : null;
}

function downloadAuditCsv(rows: Array<Record<string, string | number>>, filename: string) {
  const headers = Object.keys(rows[0] ?? { type: "", route: "", text: "", suggestion: "" });
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

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
    out.push({ text: key, tag: pathFor(parent), route, suggestion: suggestKey(key) });
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
                title="Download audit CSV"
                onClick={() => {
                  const rows = [
                    ...keyItems.map(([key, info]) => ({
                      type: "missing-key", route: info.route, lang: info.lang, text: key, suggestion: "",
                    })),
                    ...hard.map(h => ({
                      type: "hardcoded", route: h.route, lang, text: h.text,
                      suggestion: h.suggestion ? `t("${h.suggestion.key}")  // ${h.suggestion.value}` : "",
                    })),
                  ];
                  if (rows.length === 0) rows.push({ type: "", route: "", lang: "", text: "", suggestion: "" });
                  downloadAuditCsv(rows, `i18n-audit-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`);
                }}
              ><Download className="h-3.5 w-3.5" /></Button>
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
                  <div className="font-mono text-[10px] text-muted-foreground truncate">{h.tag}</div>
                  {h.suggestion ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <code className="flex-1 truncate rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        t("{h.suggestion.key}")
                      </code>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(h.suggestion.score * 100)}%
                      </span>
                      <button
                        title="Copy"
                        className="rounded p-1 hover:bg-muted"
                        onClick={() => navigator.clipboard?.writeText(`t("${h.suggestion!.key}")`)}
                      ><Copy className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] italic text-muted-foreground">
                      No close key — add a new one.
                    </div>
                  )}
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
