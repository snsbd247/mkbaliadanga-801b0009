import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { Languages } from "lucide-react";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md border bg-background p-1 ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1" aria-hidden="true" />
      <Button
        type="button"
        size="sm"
        variant={lang === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        aria-label="Switch to English"
      >
        EN
      </Button>
      <Button
        type="button"
        size="sm"
        variant={lang === "bn" ? "default" : "ghost"}
        className="h-7 px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setLang("bn")}
        aria-pressed={lang === "bn"}
        aria-label="বাংলায় পরিবর্তন করুন (Switch to Bengali)" /* i18n-ignore */
      >
        বাংলা{/* i18n-ignore */}
      </Button>
    </div>
  );
}
