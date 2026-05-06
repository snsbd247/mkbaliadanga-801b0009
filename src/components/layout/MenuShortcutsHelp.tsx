import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { usePermissions } from "@/lib/permissions";
import { MENU_SHORTCUTS } from "@/lib/menuShortcuts";

export function MenuShortcutsHelp() {
  const { t } = useLang();
  const { isSuper } = useAuth();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  const items = MENU_SHORTCUTS.filter((s) => {
    if (s.superOnly) return isSuper;
    if (s.permKey) return can(s.permKey as any, "can_view");
    return true;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("p5_menuShortcutsHelp")}>
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] max-h-[70vh] overflow-auto p-3">
        <div className="mb-2">
          <div className="text-sm font-semibold">{t("p5_menuShortcutsHelp")}</div>
          <div className="text-xs text-muted-foreground">{t("p5_menuShortcutsHelpDesc")}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{t("p5_pressCtrlK")}</div>
        </div>
        <div className="text-xs">
          <div className="grid grid-cols-[60px_1fr_1fr] gap-2 font-medium border-b pb-1 text-muted-foreground">
            <div>{t("p5_shortcutCol")}</div>
            <div>{t("p5_pageCol")}</div>
            <div>{t("p5_keywordsLabel")}</div>
          </div>
          {items.map((s) => (
            <div key={s.code} className="grid grid-cols-[60px_1fr_1fr] gap-2 py-1 border-b last:border-0">
              <div className="font-mono text-[11px]">{s.code}</div>
              <div>
                <div className="font-medium">{t(s.labelKey)}</div>
                {s.parentKey && <div className="text-[10px] text-muted-foreground">{t(s.parentKey)}</div>}
              </div>
              <div className="text-muted-foreground text-[11px] truncate">
                {(s.keywords ?? []).join(", ") || "—"}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
