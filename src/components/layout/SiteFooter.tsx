import { useLang } from "@/i18n/LanguageProvider";

const START_YEAR = 2025;

function toBnDigits(s: string | number) {
  const map: Record<string, string> = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
  return String(s).replace(/[0-9]/g, (d) => map[d] ?? d);
}

export function SiteFooter() {
  const { lang } = useLang();
  const currentYear = new Date().getFullYear();
  const yearRange =
    currentYear > START_YEAR ? `${START_YEAR}-${currentYear}` : `${currentYear}`;

  const isBn = lang === "bn";
  const yearText = isBn ? toBnDigits(yearRange) : yearRange;

  return (
    <footer
      className="mt-auto w-full border-t border-border bg-muted/60 px-3 py-2.5 sm:py-3 text-center text-[10.5px] sm:text-xs leading-relaxed text-muted-foreground no-print"
      role="contentinfo"
    >
      <p className="mx-auto max-w-3xl break-words">
        {isBn ? (
          <>
            © {yearText} সর্বস্বত্ব সংরক্ষিত —{" "}
            <span className="font-medium text-foreground/80">Mohammadkhani Irrigation Project</span>।
            {" "}ডেভেলপ করেছে{" "}
            <span className="font-medium text-foreground/80">Sync &amp; Solutions IT</span>
          </>
        ) : (
          <>
            © {yearText} All rights reserved by{" "}
            <span className="font-medium text-foreground/80">Mohammadkhani Irrigation Project</span>.
            {" "}Developed By{" "}
            <span className="font-medium text-foreground/80">Sync &amp; Solutions IT</span>
          </>
        )}
      </p>
    </footer>
  );
}
