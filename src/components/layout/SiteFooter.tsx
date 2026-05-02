import { useLang } from "@/i18n/LanguageProvider";

const START_YEAR = 2025;

const BN_DIGITS: Record<string, string> = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
const toBnDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d] ?? d);

export function SiteFooter() {
  const { lang, t } = useLang();
  const currentYear = new Date().getFullYear();
  const yearRange = currentYear > START_YEAR ? `${START_YEAR}-${currentYear}` : `${currentYear}`;
  const isBn = lang === "bn";
  const yearText = isBn ? toBnDigits(yearRange) : yearRange;

  return (
    <footer
      className="mt-auto w-full border-t border-border bg-muted/60 px-3 py-2.5 sm:py-3 text-center text-[10.5px] sm:text-xs leading-relaxed text-muted-foreground no-print"
      role="contentinfo"
    >
      <p className="mx-auto max-w-3xl break-words">
        © {yearText} {t("footerRights")}{" "}
        <span className="font-medium text-foreground/80">{t("footerCompany")}</span>
        {isBn ? "।" : "."}
        {" "}{t("footerDevelopedBy")}{" "}
        <span className="font-medium text-foreground/80">{t("footerDeveloper")}</span>
      </p>
    </footer>
  );
}
