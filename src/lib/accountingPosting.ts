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
  bank: { code: "1020", name: "Bank", name_bn: "ব্যাংক", type: "asset" },
  irrigationIncome: { code: "4010", name: "Irrigation Income", name_bn: "সেচ আয়", type: "income" },
  discountExpense: { code: "5050", name: "Discount Expense", name_bn: "ডিসকাউন্ট খরচ", type: "expense" },
  openingEquity: { code: "3000", name: "Opening Balance Equity", name_bn: "প্রারম্ভিক জের (মূলধন)", type: "equity" },
  bankOtherIncome: { code: "4090", name: "Bank/Other Income", name_bn: "ব্যাংক/অন্যান্য আয়", type: "income" },
  bankOtherExpense: { code: "5090", name: "Bank/Other Expense", name_bn: "ব্যাংক/অন্যান্য খরচ", type: "expense" },
  officeIncome: { code: "4080", name: "Office Income", name_bn: "অফিস আয়", type: "income" },
  generalExpense: { code: "5080", name: "General Expense", name_bn: "সাধারণ খরচ", type: "expense" },
} as const;

const cache = new Map<string, string>();

export interface RequiredAccountsCheck {
  ok: boolean;
  /** Account codes that could not be found. */
  missing: string[];
  /** Localized (Bengali) message describing the problem, or null when ok. */
  message: string | null;
}

/**
 * Pre-posting validation: confirms the chart-of-accounts entries the posting
 * engine depends on (Cash 1010, Irrigation Income 4010, Discount Expense 5050)
 * exist before any journal is written. Returns a clear error when missing.
 */
export async function checkRequiredAccounts(): Promise<RequiredAccountsCheck> {
  const required = [ACC.cash, ACC.irrigationIncome, ACC.discountExpense];
  const missing: string[] = [];
  for (const meta of required) {
    try {
      const { data } = await db.from("accounts").select("id").eq("code", meta.code).maybeSingle();
      if (!(data as any)?.id) missing.push(`${meta.code} (${meta.name_bn})`);
    } catch {
      missing.push(`${meta.code} (${meta.name_bn})`);
    }
  }
  if (missing.length === 0) return { ok: true, missing: [], message: null };
  return {
    ok: false,
    missing,
    message: `চার্ট অফ একাউন্টসে আবশ্যক হিসাব নেই: ${missing.join(", ")}। অনুগ্রহ করে 'accounts:seed' চালান বা চার্ট অফ একাউন্টস থেকে হিসাবগুলো যোগ করুন।`,
  };
}

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

export interface BalanceResult {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  /** Journal reference (e.g. receipt/invoice no) so warnings can identify the entry. */
  reference?: string | null;
  /** Human-readable description of the attempted journal. */
  description?: string | null;
}

/** Bilingual one-line warning describing an unbalanced journal with amounts and exact difference. */
export function formatImbalance(imb: BalanceResult, lang: "en" | "bn" = "bn"): string {
  const ref = imb.reference ? (lang === "en" ? ` [ref: ${imb.reference}]` : ` [রেফ: ${imb.reference}]`) : "";
  const diff = Math.abs(imb.difference);
  return lang === "en"
    ? `Journal not balanced${ref}: Dr ${imb.totalDebit} ≠ Cr ${imb.totalCredit} (difference ${diff})`
    : `জার্নাল সমান হয়নি${ref}: ডেবিট ${imb.totalDebit} ≠ ক্রেডিট ${imb.totalCredit} (পার্থক্য ${diff})`;
}

/** Pure double-entry balance check usable by callers to warn the user. */
export function checkBalanced(lines: Array<{ debit: number; credit: number }>): BalanceResult {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  return { balanced: totalDebit > 0 && difference === 0, totalDebit, totalCredit, difference };
}

/** Last balance issue observed during posting, consumable by the UI for a warning. */
let lastImbalance: BalanceResult | null = null;
export function takeLastImbalance(): BalanceResult | null {
  const v = lastImbalance;
  lastImbalance = null;
  return v;
}

async function createJournal(opts: {
  reference?: string | null;
  description?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
  entryDate?: string | null;
  lines: Line[];
}): Promise<string | null> {
  // Guard: lines must balance and be non-trivial.
  const bal = checkBalanced(opts.lines);
  if (!bal.balanced) {
    lastImbalance = { ...bal, reference: opts.reference ?? null, description: opts.description ?? null };
    return null;
  }
  try {
    // Insert the journal UNPOSTED first. The ledger-posting trigger
    // (post_journal_to_ledger) fires only on UPDATE/DELETE, so we add the
    // lines while unposted, then flip `posted` to true — that UPDATE is what
    // generates the ledger_entries rows.
    const { data: je, error } = await db
      .from("journal_entries")
      .insert({
        entry_date: opts.entryDate || new Date().toISOString().slice(0, 10),
        reference: opts.reference ?? null,
        description: opts.description ?? null,
        office_id: opts.officeId ?? null,
        posted: false,
        created_by: opts.createdBy ?? null,
      })
      .select("id")
      .single();
    if (error || !je) return null;
    const journalId = (je as any).id;
    const { error: lineErr } = await db
      .from("journal_entry_lines")
      .insert(opts.lines.map((l) => ({ ...l, journal_id: journalId })));
    if (lineErr) return null;
    // Flip to posted → trigger writes the ledger entries.
    await db
      .from("journal_entries")
      .update({ posted: true, posted_at: new Date().toISOString() })
      .eq("id", journalId);
    return journalId ?? null;
  } catch {
    /* posting failure must not break the caller */
    return null;
  }
}

/**
 * Audit trail for bank / day-close journal postings. Records actor, timestamp
 * (server default), the journal reference and id so postings are traceable.
 * Best-effort — never throws into the posting flow.
 */
async function auditJournalPosting(opts: {
  action: string;
  reference: string | null;
  journalId: string | null;
  officeId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      office_id: opts.officeId ?? null,
      module: "other",
      action_type: opts.action,
      reference_id: opts.journalId ?? opts.reference,
      new_data: { reference: opts.reference, journal_id: opts.journalId, ...(opts.detail ?? {}) },
    });
  } catch {
    /* ignore audit failures */
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

/** Stable journal reference for a bank account's opening-balance entry. */
export const bankOpeningRef = (accountId: string) => `OPENING-BANK-${accountId}`;

/**
 * Post (or skip if already posted) a bank account's opening balance as a journal:
 *   Dr Bank (1020) / Cr Opening Balance Equity (3000)
 * Idempotent: keyed on reference `OPENING-BANK-<accountId>`. If a journal with
 * that reference already exists it is left untouched (returns "exists"). Pass
 * `force: true` to delete the previous opening journal and re-post (used when the
 * opening balance is edited). Best-effort — never throws into the caller.
 */
export async function postBankOpening(opts: {
  bankAccountId: string;
  openingBalance: number;
  bankLabel?: string | null;
  entryDate?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
  force?: boolean;
}): Promise<"posted" | "exists" | "skipped"> {
  const amount = Math.round(Number(opts.openingBalance) || 0);
  const ref = bankOpeningRef(opts.bankAccountId);
  try {
    const { data: existing } = await db
      .from("journal_entries")
      .select("id")
      .eq("reference", ref)
      .maybeSingle();
    const existingId = (existing as any)?.id as string | undefined;
    if (existingId) {
      if (!opts.force) return "exists";
      // Remove old opening journal (its ledger rows are cleaned up by the posting trigger).
      try {
        await db.from("journal_entry_lines").delete().eq("journal_id", existingId);
      } catch { /* ignore */ }
      await db.from("journal_entries").delete().eq("id", existingId);
    }
    if (amount === 0) return "skipped";
    const [bank, equity] = await Promise.all([accountId(ACC.bank), accountId(ACC.openingEquity)]);
    if (!bank || !equity) return "skipped";
    const label = opts.bankLabel ? ` — ${opts.bankLabel}` : "";
    const isNeg = amount < 0;
    const abs = Math.abs(amount);
    await createJournal({
      reference: ref,
      description: `ব্যাংক প্রারম্ভিক জের${label}`,
      officeId: opts.officeId,
      createdBy: opts.createdBy,
      entryDate: opts.entryDate ?? null,
      lines: isNeg
        ? [
            { account_id: equity, debit: abs, credit: 0, description: "প্রারম্ভিক জের (মূলধন)", position: 1 },
            { account_id: bank, debit: 0, credit: abs, description: "ব্যাংক প্রারম্ভিক", position: 2 },
          ]
        : [
            { account_id: bank, debit: abs, credit: 0, description: "ব্যাংক প্রারম্ভিক", position: 1 },
            { account_id: equity, debit: 0, credit: abs, description: "প্রারম্ভিক জের (মূলধন)", position: 2 },
          ],
    });
    return "posted";
  } catch {
    return "skipped";
  }
}

/** Stable journal reference for a cash ↔ bank movement (deposit/withdraw). */
export const bankCashTransferRef = (bankTxnId: string) => `BANK-CASH-${bankTxnId}`;

/**
 * নগদ ↔ ব্যাংক ট্রান্সফারের জার্নাল পোস্ট করে:
 *   deposit  (নগদ → ব্যাংক): Dr Bank(1020) / Cr Cash(1010)
 *   withdraw (ব্যাংক → নগদ): Dr Cash(1010) / Cr Bank(1020)
 * Best-effort — কখনো caller-এর ফ্লো ভাঙবে না।
 */
export async function postBankCashTransfer(opts: {
  bankTxnId: string;
  direction: "deposit" | "withdraw";
  amount: number;
  bankLabel?: string | null;
  entryDate?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
}): Promise<"posted" | "skipped"> {
  const amount = Math.round(Number(opts.amount) || 0);
  if (amount <= 0) return "skipped";
  const [cash, bank] = await Promise.all([accountId(ACC.cash), accountId(ACC.bank)]);
  if (!cash || !bank) return "skipped";
  const label = opts.bankLabel ? ` — ${opts.bankLabel}` : "";
  const isDeposit = opts.direction === "deposit";
  const ref = bankCashTransferRef(opts.bankTxnId);
  const jid = await createJournal({
    reference: ref,
    description: `${isDeposit ? "নগদ ব্যাংকে জমা" : "ব্যাংক থেকে নগদ উত্তোলন"}${label}`,
    officeId: opts.officeId,
    createdBy: opts.createdBy,
    entryDate: opts.entryDate ?? null,
    lines: isDeposit
      ? [
          { account_id: bank, debit: amount, credit: 0, description: "ব্যাংকে জমা", position: 1 },
          { account_id: cash, debit: 0, credit: amount, description: "নগদ কমেছে", position: 2 },
        ]
      : [
          { account_id: cash, debit: amount, credit: 0, description: "নগদ বৃদ্ধি", position: 1 },
          { account_id: bank, debit: 0, credit: amount, description: "ব্যাংক থেকে উত্তোলন", position: 2 },
        ],
  });
  await auditJournalPosting({
    action: isDeposit ? "bank_deposit_cash" : "bank_withdraw_cash",
    reference: ref, journalId: jid, officeId: opts.officeId,
    detail: { amount, direction: opts.direction, source: "cash", bank_txn_id: opts.bankTxnId },
  });
  return "posted";
}

/** Stable journal reference for an external (non-cash) bank deposit/withdraw. */
export const bankExternalRef = (bankTxnId: string) => `BANK-EXT-${bankTxnId}`;

/**
 * সরাসরি ব্যাংক (নগদ ব্যতীত) জমা/উত্তোলনের জার্নাল পোস্ট করে — নগদ স্পর্শ করে না:
 *   deposit  (বাইরে থেকে ব্যাংকে): Dr Bank(1020)        / Cr Bank/Other Income(4090)
 *   withdraw (ব্যাংক থেকে বাইরে):  Dr Bank/Other Exp(5090) / Cr Bank(1020)
 * শুধু ব্যাংক লেজারে হিট করে; সেচ/সমিতি নগদে কোনো প্রভাব নেই। Best-effort।
 */
export async function postBankExternal(opts: {
  bankTxnId: string;
  direction: "deposit" | "withdraw";
  amount: number;
  bankLabel?: string | null;
  entryDate?: string | null;
  officeId?: string | null;
  createdBy?: string | null;
}): Promise<"posted" | "skipped"> {
  const amount = Math.round(Number(opts.amount) || 0);
  if (amount <= 0) return "skipped";
  const isDeposit = opts.direction === "deposit";
  const [bank, other] = await Promise.all([
    accountId(ACC.bank),
    accountId(isDeposit ? ACC.bankOtherIncome : ACC.bankOtherExpense),
  ]);
  if (!bank || !other) return "skipped";
  const label = opts.bankLabel ? ` — ${opts.bankLabel}` : "";
  const ref = bankExternalRef(opts.bankTxnId);
  const jid = await createJournal({
    reference: ref,
    description: `${isDeposit ? "সরাসরি ব্যাংক জমা" : "সরাসরি ব্যাংক উত্তোলন"}${label}`,
    officeId: opts.officeId,
    createdBy: opts.createdBy,
    entryDate: opts.entryDate ?? null,
    lines: isDeposit
      ? [
          { account_id: bank, debit: amount, credit: 0, description: "ব্যাংকে জমা", position: 1 },
          { account_id: other, debit: 0, credit: amount, description: "ব্যাংক/অন্যান্য আয়", position: 2 },
        ]
      : [
          { account_id: other, debit: amount, credit: 0, description: "ব্যাংক/অন্যান্য খরচ", position: 1 },
          { account_id: bank, debit: 0, credit: amount, description: "ব্যাংক থেকে উত্তোলন", position: 2 },
        ],
  });
  await auditJournalPosting({
    action: isDeposit ? "bank_deposit_external" : "bank_withdraw_external",
    reference: ref, journalId: jid, officeId: opts.officeId,
    detail: { amount, direction: opts.direction, source: "external", bank_txn_id: opts.bankTxnId },
  });
  return "posted";
}

/** Idempotency: does a posted/unposted journal with this reference already exist? */
async function journalExists(reference: string): Promise<boolean> {
  try {
    const { data } = await db.from("journal_entries").select("id").eq("reference", reference).maybeSingle();
    return !!(data as any)?.id;
  } catch {
    return false;
  }
}

export interface DayCloseResult {
  ok: boolean;
  incomePosted: number;
  expensePosted: number;
  skipped: number;
  message?: string;
}

/**
 * ডে-ক্লোজ: নির্বাচিত তারিখের সব আয় (office_incomes) ও খরচ (expenses) balanced
 * জার্নাল হিসেবে লেজারে পোস্ট করে। ব্যাংক লেনদেন তৈরির সময়ই লেজারে পোস্ট হয়ে যায়,
 * তাই এখানে শুধু বাকি আয়/ব্যয় পোস্ট হয়। Idempotent — reference key দিয়ে ডুপ্লিকেট
 * এড়ানো হয় (INCOME-<id>, EXPENSE-<id>)। ব্যাংক-ডিপোজিট মিরর expense বাদ যায়।
 */
export async function postDayClose(opts: {
  date: string; // YYYY-MM-DD
  officeId?: string | null;
  createdBy?: string | null;
}): Promise<DayCloseResult> {
  const { date } = opts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, incomePosted: 0, expensePosted: 0, skipped: 0, message: "সঠিক তারিখ দিন" };
  let incomePosted = 0, expensePosted = 0, skipped = 0;

  try {
    const [cash, income, expense] = await Promise.all([
      accountId(ACC.cash), accountId(ACC.officeIncome), accountId(ACC.generalExpense),
    ]);
    if (!cash || !income || !expense) return { ok: false, incomePosted, expensePosted, skipped, message: "আবশ্যক হিসাব পাওয়া যায়নি" };

    // Office incomes for the day → Dr Cash / Cr Office Income.
    const { data: incs } = await db.from("office_incomes").select("*").eq("received_on", date);
    for (const r of (incs ?? []) as any[]) {
      const amt = Math.round(Number(r.amount) || 0);
      if (amt <= 0) { skipped++; continue; }
      const ref = `INCOME-${r.id}`;
      if (await journalExists(ref)) { skipped++; continue; }
      await createJournal({
        reference: ref,
        description: `অফিস আয়${r.receipt_no ? ` (রসিদ: ${r.receipt_no})` : ""}`,
        officeId: r.office_id ?? opts.officeId ?? null, createdBy: opts.createdBy, entryDate: date,
        lines: [
          { account_id: cash, debit: amt, credit: 0, description: "নগদ আয়", position: 1 },
          { account_id: income, debit: 0, credit: amt, description: "অফিস আয়", position: 2 },
        ],
      });
      incomePosted++;
    }

    // Expenses for the day (excluding bank-deposit mirrors, already journaled) → Dr Expense / Cr Cash.
    const { data: exps } = await db.from("expenses").select("*").eq("expense_date", date).is("deleted_at", null);
    for (const r of (exps ?? []) as any[]) {
      if (r.is_bank_deposit) { skipped++; continue; }
      const amt = Math.round(Number(r.amount) || 0);
      if (amt <= 0) { skipped++; continue; }
      const ref = `EXPENSE-${r.id}`;
      if (await journalExists(ref)) { skipped++; continue; }
      await createJournal({
        reference: ref,
        description: `খরচ${r.head ? ` — ${r.head}` : ""}${r.voucher_no ? ` (${r.voucher_no})` : ""}`,
        officeId: r.office_id ?? opts.officeId ?? null, createdBy: opts.createdBy, entryDate: date,
        lines: [
          { account_id: expense, debit: amt, credit: 0, description: r.head || "খরচ", position: 1 },
          { account_id: cash, debit: 0, credit: amt, description: "নগদ কমেছে", position: 2 },
        ],
      });
      expensePosted++;
    }

    // Audit the day-close run with actor, timestamp and posting summary.
    await auditJournalPosting({
      action: "day_close", reference: `DAYCLOSE-${date}`, journalId: null, officeId: opts.officeId,
      detail: { date, incomePosted, expensePosted, skipped },
    });

    return { ok: true, incomePosted, expensePosted, skipped };
  } catch (e: any) {
    return { ok: false, incomePosted, expensePosted, skipped, message: e?.message ?? "ডে-ক্লোজ ব্যর্থ" };
  }
}
