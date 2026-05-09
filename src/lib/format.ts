// Round to whole taka — half-up: ≥ .50 → up, < .50 → down.
// This is the project-wide rule for invoices, receipts, payment receipts and reports.
export const roundTaka = (n: number | null | undefined): number => {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  // Math.round in JS rounds .5 away from zero → matches "above .50 = 1, below = 0".
  return Math.round(v);
};

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
