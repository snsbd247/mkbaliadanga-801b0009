// Shared, guarded সেচ (irrigation) নগদ ↔ ব্যাংক transfer helper.
//
// Reused by both the Bank Accounts page and the irrigation payment surface so a
// deposit/withdraw always: (1) is stream-validated, (2) writes a bank_transactions
// row linked to its mirrored cashbook row, (3) posts a balanced Dr/Cr journal,
// and (4) writes an audit log. Never auto-runs — callers confirm first.

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { postBankCashTransfer } from "@/lib/accountingPosting";
import { assertSechTransfer, type BankAccountLike } from "@/lib/cashStreamGuard";

const sb = db as any;

export interface SechTransferInput {
  account: BankAccountLike & { id: string; office_id?: string | null; bank_name?: string | null; account_no?: string | null };
  direction: "deposit" | "withdraw";
  amount: number;
  txnDate: string; // YYYY-MM-DD
  note?: string;
  reference?: string;
  createdBy?: string | null;
}

export interface SechTransferResult {
  ok: boolean;
  message?: string;
  bankTxnId?: string;
}

/** সেচ মাসের ক্যাশবুক লক থাকলে ব্যাংক লেনদেন ব্লক। */
async function isIrrigationCashbookLocked(dateStr: string): Promise<boolean> {
  const d = new Date(dateStr);
  const year = d.getFullYear(), month = d.getMonth() + 1;
  const { data } = await sb.from("cashbook_submissions")
    .select("id").eq("year", year).eq("month", month).eq("stream", "irrigation").eq("locked", true).limit(1);
  return (data?.length ?? 0) > 0;
}

export async function runSechBankTransfer(input: SechTransferInput): Promise<SechTransferResult> {
  const { account, direction, txnDate } = input;
  const amount = Number(input.amount) || 0;
  if (!account?.id || amount <= 0) return { ok: false, message: "অ্যাকাউন্ট ও পরিমাণ দিন" };

  // Stream guard — সেচ নগদ শুধুমাত্র সেচ-স্ট্রিমের ব্যাংক অ্যাকাউন্টে।
  const guard = assertSechTransfer(account);
  if (!guard.ok) return { ok: false, message: guard.message ?? "ভুল স্ট্রিম" };

  if (await isIrrigationCashbookLocked(txnDate))
    return { ok: false, message: "এই মাসের সেচ ক্যাশবুক লক করা — ব্যাংক লেনদেন করা যাবে না" };

  const bankLabel = account.bank_name ? `${account.bank_name} — ${account.account_no ?? ""}`.trim() : "Bank";
  const note = input.note || (direction === "deposit" ? "সেচ নগদ ব্যাংকে জমা" : "ব্যাংক থেকে সেচ নগদ উত্তোলন");
  const linkId = crypto.randomUUID();

  const { data: insData, error } = await sb.from("bank_transactions").insert({
    bank_account_id: account.id, txn_type: direction, amount, txn_date: txnDate,
    reference_no: input.reference ?? null, note, created_by: input.createdBy ?? null, link_id: linkId,
  }).select();
  if (error) return { ok: false, message: "লেনদেন সংরক্ষণ ব্যর্থ: " + error.message };
  const inserted = Array.isArray(insData) ? insData[0] : insData;

  void logAudit({
    office_id: account.office_id ?? null, module: "bank_transaction", action_type: "create",
    reference_id: account.id, new_data: { id: inserted?.id, txn_type: direction, amount, txn_date: txnDate, note, link_id: linkId, source: "sech_payment" },
  });

  if (inserted?.id) {
    void postBankCashTransfer({
      bankTxnId: inserted.id, direction, amount, bankLabel,
      entryDate: txnDate, officeId: account.office_id ?? null, createdBy: input.createdBy ?? null,
    });
  }

  // Cashbook mirror (irrigation stream): deposit → expense, withdraw → receipt.
  if (direction === "deposit") {
    await db.from("expenses").insert({
      head: "Bank Deposit", payee: bankLabel, amount, method: "bank",
      note: `Cash deposited to ${bankLabel}${input.note ? " · " + input.note : ""}`,
      expense_date: txnDate, created_by: input.createdBy ?? null, stream: "irrigation", link_id: linkId,
      is_bank_deposit: true, bank_account_id: account.id,
    } as any);
  } else {
    await db.from("receipts").insert({
      kind: "irrigation", amount, method: "bank",
      note: `Cash withdrawn from ${bankLabel}${input.note ? " · " + input.note : ""}`,
      receipt_date: txnDate, collected_by: input.createdBy ?? null, link_id: linkId,
    } as any);
  }

  return { ok: true, bankTxnId: inserted?.id };
}
