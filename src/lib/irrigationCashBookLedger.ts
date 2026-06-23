/**
 * ধাপ ৭ — Cash Book, Report ও Historical Entry
 *
 * Pure helpers (DB-free, testable) that:
 *  1. Build a running-balance cash book from জমা (debit/in) and খরচ (credit/out)
 *     entries, sorted chronologically with an optional opening balance.
 *  2. Summarize a period report (total in / out / net / closing balance).
 *  3. Validate a historical (back-dated) entry against the cash book's locked
 *     period so closed months cannot be silently altered.
 */
export type CashDirection = "in" | "out";

export interface CashEntry {
  id?: string;
  date: string; // YYYY-MM-DD
  direction: CashDirection;
  amount: number;
  head?: string | null;
  ref?: string | null;
}

export interface CashBookRow extends CashEntry {
  debit: number;
  credit: number;
  balance: number;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Build a running-balance cash book. Stable sort by date then input order. */
export function buildCashBook(entries: CashEntry[], opening = 0): CashBookRow[] {
  const indexed = entries.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : a.i - b.i));
  let balance = num(opening);
  return indexed.map(({ e }) => {
    const amt = Math.max(num(e.amount), 0);
    const debit = e.direction === "in" ? amt : 0;
    const credit = e.direction === "out" ? amt : 0;
    balance = r2(balance + debit - credit);
    return { ...e, amount: r2(amt), debit: r2(debit), credit: r2(credit), balance };
  });
}

export interface CashReport {
  opening: number;
  total_in: number;
  total_out: number;
  net: number;
  closing: number;
  count: number;
}

/** Aggregate a period report from a built cash book. */
export function summarizeCashBook(rows: CashBookRow[], opening = 0): CashReport {
  let total_in = 0, total_out = 0;
  for (const r of rows) { total_in += r.debit; total_out += r.credit; }
  const net = r2(total_in - total_out);
  return {
    opening: r2(opening),
    total_in: r2(total_in),
    total_out: r2(total_out),
    net,
    closing: r2(num(opening) + net),
    count: rows.length,
  };
}

export interface HistoricalEntryCheck {
  ok: boolean;
  error?: { en: string; bn: string };
}

/**
 * Validate a back-dated entry. `lockedThrough` is the last date that is closed
 * (inclusive); any entry on or before it is rejected. A future date is also
 * rejected. Empty `lockedThrough` means nothing is locked.
 */
export function validateHistoricalEntry(
  entry: Pick<CashEntry, "date" | "amount" | "direction">,
  lockedThrough: string | null = null,
  today: string = new Date().toISOString().slice(0, 10),
): HistoricalEntryCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date)))
    return { ok: false, error: { en: "A valid entry date is required.", bn: "একটি সঠিক তারিখ আবশ্যক।" } };
  if (num(entry.amount) <= 0)
    return { ok: false, error: { en: "Amount must be greater than zero.", bn: "পরিমাণ শূন্যের বেশি হতে হবে।" } };
  if (entry.date > today)
    return { ok: false, error: { en: "Entry date cannot be in the future.", bn: "তারিখ ভবিষ্যতে হতে পারে না।" } };
  if (lockedThrough && entry.date <= lockedThrough)
    return {
      ok: false,
      error: {
        en: `The period through ${lockedThrough} is closed; back-dated entries are not allowed.`,
        bn: `${lockedThrough} পর্যন্ত সময়কাল বন্ধ; পূর্ববর্তী তারিখের এন্ট্রি অনুমোদিত নয়।`,
      },
    };
  return { ok: true };
}
