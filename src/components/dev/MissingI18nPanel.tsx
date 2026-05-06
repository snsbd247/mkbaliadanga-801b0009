import { useEffect, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

/**
 * Floating dev-only panel that lists translation keys requested but not found
 * for the active language. Mounted by AppLayout when import.meta.env.DEV.
 *
 * The provider populates window.__i18nMissing (a Map<key, {lang, route}>).
 */
export function MissingI18nPanel() {
  const { lang, t } = useLang();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(id);
  }, []);

  const map: Map<string, { lang: string; route: string }> =
    (typeof window !== "undefined" && (window as any).__i18nMissing) || new Map();
  const items = Array.from(map.entries());

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] no-print">
      {!open ? (
        <Button
          size="sm"
          variant={items.length ? "destructive" : "outline"}
          onClick={() => setOpen(true)}
          className="shadow-lg gap-1.5"
        >
          <Bug className="h-4 w-4" />
          i18n {items.length ? `(${items.length})` : "✓"}
        </Button>
      ) : (
        <div className="w-80 max-h-96 rounded-md border bg-card shadow-xl flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{t("p5_missingI18nPanelTitle")}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {t("p5_missingI18nPanelDesc")} · lang={lang} · {loc.pathname}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { (window as any).__i18nMissing = new Map(); setTick((n) => n + 1); }}
              >{t("p5_clear")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>×</Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto text-xs">
            {items.length === 0 ? (
              <div className="p-3 text-muted-foreground">No missing keys 🎉</div>
            ) : items.map(([key, info]) => (
              <div key={key} className="px-3 py-1.5 border-b">
                <div className="font-mono text-[11px]">{key}</div>
                <div className="text-[10px] text-muted-foreground">
                  lang={info.lang} · {info.route}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
