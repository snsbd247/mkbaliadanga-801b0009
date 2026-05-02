import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { Languages } from "lucide-react";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex items-center gap-1 rounded-md border bg-background p-1 ${className}`}>
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1" />
      <Button
        type="button"
        size="sm"
        variant={lang === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLang("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        size="sm"
        variant={lang === "bn" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLang("bn")}
      >
        বাংলা
      </Button>
    </div>
  );
}
