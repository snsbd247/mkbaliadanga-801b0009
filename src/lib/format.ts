import { roundTaka } from "./rounding";

export { roundTaka } from "./rounding";

export const money = (n: number | null | undefined) =>
  "৳ " + roundTaka(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// 2-decimal money formatter for per-unit rates and computed land amounts
// (Rate / Shotok, land size × rate totals). These are precision figures, so
// they are NOT whole-taka rounded — they always show exactly 2 decimals.
export const money2 = (n: number | null | undefined) =>
  "৳ " + Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money2L = (n: number | null | undefined, lang: "en" | "bn") =>
  "৳ " + Number(n ?? 0).toLocaleString(lang === "bn" ? "bn-BD" : "en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// PDF-safe currency formatter — jsPDF's built-in fonts can't render the Bengali
// taka glyph (৳), so we use the ASCII "Tk" prefix for any amount written into
// a PDF. The on-screen UI continues to use `money()` with the proper symbol.
export const moneyPdf = (n: number | null | undefined) =>
  "Tk " + roundTaka(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB");
};

// Locale-aware variants. Use these in components that already have access to
// the active language via `useLang()` so numbers/dates match the UI language.
export const moneyL = (n: number | null | undefined, lang: "en" | "bn") =>
  "৳ " + roundTaka(n).toLocaleString(lang === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 0 });

export const fmtDateL = (d: string | Date | null | undefined, lang: "en" | "bn") => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB");
};
