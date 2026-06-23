import { AlertTriangle } from "lucide-react";
import {
  validateBargaSplit,
  type BargaValidationInput,
} from "@/lib/irrigationBargaValidation";
import { useLanguage } from "@/i18n/LanguageProvider";

interface Props {
  input: BargaValidationInput;
  /** Optional override; defaults to the active UI language. */
  lang?: "bn" | "en";
}

/**
 * Bilingual reconciliation error panel for the Barga split / sharecropper
 * allocation forms. Lists exactly which values mismatch and how to fix them.
 * Renders nothing when the split reconciles.
 */
export function BargaReconciliationPanel({ input, lang }: Props) {
  const { language } = useLanguage();
  const active: "bn" | "en" = lang ?? (language === "en" ? "en" : "bn");
  const errors = validateBargaSplit(input);
  if (errors.length === 0) return null;

  const title =
    active === "bn"
      ? "বর্গা হিসাব মিলছে না — অনুগ্রহ করে ঠিক করুন:"
      : "Barga split does not reconcile — please fix:";

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <div className="mb-2 flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{title}</span>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {errors.map((e, i) => (
          <li key={i}>{e[active]}</li>
        ))}
      </ul>
    </div>
  );
}

export default BargaReconciliationPanel;
