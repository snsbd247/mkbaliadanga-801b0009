import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { usePermissions } from "@/lib/permissions";
import { MENU_SHORTCUTS, type MenuShortcut } from "@/lib/menuShortcuts";

/**
 * Global menu search shown in the app header.
 * - Type a code (e.g. "M11") + Enter → jump to that page
 * - Type any keyword/label fragment → live suggestions, Enter picks first
 * - Ctrl/Cmd+K focuses the box
 */
export function MenuSearch() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { isSuper } = useAuth();
  const { can } = usePermissions();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const allowed = (s: MenuShortcut) => {
    if (s.superOnly) return isSuper;
    if (s.permKey) return can(s.permKey as any, "can_view");
    return true;
  };

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [] as MenuShortcut[];
    // Exact code match wins (e.g. "M11")
    const codeHit = MENU_SHORTCUTS.find(s => s.code.toLowerCase() === term && allowed(s));
    if (codeHit) return [codeHit];
    return MENU_SHORTCUTS.filter(s => {
      if (!allowed(s)) return false;
      const label = t(s.labelKey).toLowerCase();
      const parent = s.parentKey ? t(s.parentKey).toLowerCase() : "";
      const kw = (s.keywords ?? []).join(" ").toLowerCase();
      return (
        s.code.toLowerCase().includes(term) ||
        label.includes(term) ||
        parent.includes(term) ||
        kw.includes(term)
      );
    }).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isSuper, t]);

  useEffect(() => { setActive(0); }, [q]);

  // Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (s: MenuShortcut) => {
    navigate(s.url);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setQ(""); setOpen(false); inputRef.current?.blur(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && matches[active]) { e.preventDefault(); go(matches[active]); }
        }}
        placeholder={`${t("searchMenu")} — M11, ${t("farmers")}…  (Ctrl+K)`}
        className="h-9 pl-7 pr-2 text-sm"
        aria-label={t("searchMenu")}
      />
      {open && q && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-80 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md z-50">
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">{t("noResults")}</div>
          ) : matches.map((s, i) => (
            <button
              key={s.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(s)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40 ${i === active ? "bg-accent/50" : ""}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{s.code}</span>
                <span className="truncate">{t(s.labelKey)}</span>
              </span>
              {s.parentKey && <span className="text-[10px] text-muted-foreground shrink-0">{t(s.parentKey)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
