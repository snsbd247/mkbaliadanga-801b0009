// Journal posting engine for irrigation collections and discounts.
//
// Posting model (separate-discount / gross-income method):
//   - On payment collection:  Dr Cash            / Cr Irrigation Income   (collected amount)
//   - On discount applied:     Dr Discount Expense / Cr Irrigation Income   (discount delta)
//
// Net effect = gross income recorded, discount carried as a separate expense,
// so net income equals the discounted payable. All calls are best-effort and
// must never throw into the payment/discount flows that invoke them.

import { db } from "@/lib/db";

const ACC = {
  cash: { code: "1010", name: "Cash", name_bn: "নগদ", type: "asset" },
  irrigationIncome: { code: "4010", name: "Irrigation Income", name_bn: "সেচ আয়", type: "income" },
  discountExpense: { code: "5050", name: "Discount Expense", name_bn: "ডিসকাউন্ট খরচ", type: "expense" },
} as const;

const cache = new Map<string, string>();

/** Resolve an account id by code; create it (best-effort) if it does not exist. */
async function accountId(meta: { code: string; name: string; name_bn: string; type: string }): Promise<string | null> {
  if (cache.has(meta.code)) return cache.get(meta.code)!;
  try {
    const { data } = await db.from("accounts").select("id").eq("code", meta.code).maybeSingle();
    let id = (data as any)?.id as string | undefined;
    if (!id) {
      const { data: created } = await db
        .from("accounts")
        .insert({ code: meta.code, name: meta.name, name_bn: meta.name_bn, type: meta.type, is_active: true })
        .select("id")
        .single();
      id = (created as any)?.id;
    }
    if (id) cache.set(meta.code, id);
    return id ?? null;
  } catch {
    return null;
  }
}

type Line = { account_id: string; debit: number; credit: number; description?: string | null; position: number };

async function createJournal(opts: {
  reference?: string | null;
  description?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
  lines: Line[];
}): Promise<void> {
  // Guard: lines must balance and be non-trivial.
  const totalDr = opts.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = opts.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (totalDr <= 0 || Math.round(totalDr) !== Math.round(totalCr)) return;
  try {
    const { data: je, error } = await db
      .from("journal_entries")
      .insert({
        entry_date: new Date().toISOString().slice(0, 10),
        reference: opts.reference ?? null,
        description: opts.description ?? null,
        office_id: opts.officeId ?? null,
        posted: true,
        posted_at: new Date().toISOString(),
        created_by: opts.createdBy ?? null,
      })
      .select("id")
      .single();
    if (error || !je) return;
    const journalId = (je as any).id;
    await db.from("journal_entry_lines").insert(opts.lines.map((l) => ({ ...l, journal_id: journalId })));
  } catch {
    /* posting failure must not break the caller */
  }
}

/** Dr Cash / Cr Irrigation Income for a collected irrigation payment. */
export async function postIrrigationCollection(opts: {
  amount: number;
  receiptNo?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const amount = Math.round(Number(opts.amount) || 0);
  if (amount <= 0) return;
  const [cash, income] = await Promise.all([accountId(ACC.cash), accountId(ACC.irrigationIncome)]);
  if (!cash || !income) return;
  await createJournal({
    reference: opts.receiptNo ?? null,
    description: `সেচ আদায়${opts.receiptNo ? ` (রসিদ: ${opts.receiptNo})` : ""}`,
    officeId: opts.officeId,
    createdBy: opts.createdBy,
    lines: [
      { account_id: cash, debit: amount, credit: 0, description: "নগদ আদায়", position: 1 },
      { account_id: income, debit: 0, credit: amount, description: "সেচ আয়", position: 2 },
    ],
  });
}

/** Dr Discount Expense / Cr Irrigation Income for a discount change on an invoice. */
export async function postIrrigationDiscount(opts: {
  discountDelta: number;
  invoiceNo?: string | null;
  reason?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const delta = Math.round(Number(opts.discountDelta) || 0);
  if (delta <= 0) return; // only post positive discounts; reversals handled separately if ever needed
  const [expense, income] = await Promise.all([accountId(ACC.discountExpense), accountId(ACC.irrigationIncome)]);
  if (!expense || !income) return;
  await createJournal({
    reference: opts.invoiceNo ?? null,
    description: `সেচ ইনভয়েস ডিসকাউন্ট${opts.invoiceNo ? ` (ইনভয়েস: ${opts.invoiceNo})` : ""}${opts.reason ? ` — ${opts.reason}` : ""}`,
    officeId: opts.officeId,
    createdBy: opts.createdBy,
    lines: [
      { account_id: expense, debit: delta, credit: 0, description: "ডিসকাউন্ট খরচ", position: 1 },
      { account_id: income, debit: 0, credit: delta, description: "সেচ আয় (গ্রস)", position: 2 },
    ],
  });
}
