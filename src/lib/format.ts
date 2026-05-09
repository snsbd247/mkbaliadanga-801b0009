import { roundTaka } from "./rounding";

export { roundTaka } from "./rounding";

export const money = (n: number | null | undefined) =>
  "৳ " + roundTaka(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

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
