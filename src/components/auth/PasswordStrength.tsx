import { policyRules, passwordScore } from "@/lib/passwordPolicy";
import { useLang } from "@/i18n/LanguageProvider";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordStrength({ value, minLen = 10 }: { value: string; minLen?: number }) {
  const { lang } = useLang();
  const tr = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const rules = policyRules(minLen);
  const { score, label, labelBn } = passwordScore(value, minLen);
  const colors = ["bg-destructive", "bg-destructive", "bg-yellow-500", "bg-blue-500", "bg-green-600"];
  const widths = ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"];

  return (
    <div className="space-y-2">
      <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", colors[score], value ? widths[score] : "w-0")} />
      </div>
      {value && (
        <div className="text-xs text-muted-foreground">
          {tr("Strength", "শক্তি")}: <span className="font-medium text-foreground">{tr(label, labelBn)}</span>
        </div>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
        {rules.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.key} className={cn("flex items-center gap-1.5", ok ? "text-green-600" : "text-muted-foreground")}>
              {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              <span>{tr(r.en, r.bn)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
