// Fiscal-year + report filename helpers
import { db } from "@/lib/db";
export type DateRange = { from: string; to: string };

export async function getFiscalStartMonth(): Promise<number> {
  const { data } = await db
    .from("company_settings")
    .select("fiscal_year_start_month")
    .eq("id", 1)
    .maybeSingle();
  return Number(data?.fiscal_year_start_month ?? 7);
}

/** Return [from, to] for a given fiscal year label and start month.
 *  If startMonth = 7, fyLabel "2025-26" => 2025-07-01 .. 2026-06-30
 *  If startMonth = 1, fyLabel "2025"    => 2025-01-01 .. 2025-12-31
 */
export function fiscalYearRange(fyStartYear: number, startMonth: number): DateRange {
  const start = new Date(fyStartYear, startMonth - 1, 1);
  const end = new Date(fyStartYear + 1, startMonth - 1, 0); // day 0 of next month = last day of prev
  return { from: toISO(start), to: toISO(end) };
}

export function fiscalYearLabel(fyStartYear: number, startMonth: number): string {
  return startMonth === 1 ? `${fyStartYear}` : `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
}

export function listFiscalYears(startMonth: number, count = 6): { startYear: number; label: string; range: DateRange }[] {
  const today = new Date();
  let curStart = today.getFullYear();
  if (today.getMonth() + 1 < startMonth) curStart -= 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    const sy = curStart - i;
    out.push({ startYear: sy, label: fiscalYearLabel(sy, startMonth), range: fiscalYearRange(sy, startMonth) });
  }
  return out;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeFilenameSuffix(range: DateRange): string {
  if (!range.from && !range.to) return "all-time";
  return `${range.from || "open"}_to_${range.to || "today"}`;
}

export function reportFilename(reportName: string, range: DateRange): string {
  return `${reportName.toLowerCase().replace(/\s+/g, "-")}_${rangeFilenameSuffix(range)}`;
}

/** Period helpers */
export function monthRange(year: number, month: number): DateRange {
  // month: 1-12
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { from: toISO(start), to: toISO(end) };
}

export function quarterRange(year: number, q: number): DateRange {
  const startMonth = (q - 1) * 3 + 1;
  const start = new Date(year, startMonth - 1, 1);
  const end = new Date(year, startMonth + 2, 0);
  return { from: toISO(start), to: toISO(end) };
}
