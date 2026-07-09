export type PostingAccountLookup = Record<string, string | null | undefined>;

export interface IrrigationPostingInput {
  amount: number;
  isCurrent: boolean;
  delayFee?: number | null;
  maintenanceAmount?: number | null;
  canalAmount?: number | null;
}

export interface PostingLineDraft {
  account_id: string;
  debit: number;
  credit: number;
  position: number;
  description: string;
}

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

export const irrigationJournalRef = (paymentId: string) => `IRR-PAY-${paymentId.slice(0, 8)}`;

function firstAccount(byCode: PostingAccountLookup, codes: string[]): string | null {
  for (const code of codes) {
    const id = byCode[code];
    if (id) return id;
  }
  return null;
}

/**
 * Builds a balanced Dr Cash / Cr income journal for one irrigation payment.
 *
 * If detailed income accounts (IRR-DELAY / IRR-MAINT / etc.) are absent on a
 * VPS database, the amount is safely folded into the canonical 4010/IRR-INCOME
 * account instead of creating a one-sided journal.
 */
export function buildIrrigationPostingLines(
  input: IrrigationPostingInput,
  byCode: PostingAccountLookup,
): PostingLineDraft[] {
  const amount = money(input.amount);
  if (amount <= 0) return [];

  const cashAccount = firstAccount(byCode, ["1010"]);
  const incomeAccount = firstAccount(byCode, ["IRR-INCOME", "4010"]);
  if (!cashAccount) throw new Error("Cash account (1010) missing from chart of accounts");
  if (!incomeAccount) throw new Error("Irrigation income account (IRR-INCOME/4010) missing from chart of accounts");

  let irrPart = 0;
  let delayPart = 0;
  let maintPart = 0;
  let canalPart = 0;
  let prevPart = 0;

  if (input.isCurrent) {
    const delayCollected = money(input.delayFee);
    const maintCollected = money(input.maintenanceAmount);
    const canalCollected = money(input.canalAmount);
    const overheadTotal = delayCollected + maintCollected + canalCollected;
    const scale = overheadTotal > 0 ? Math.min(1, amount / overheadTotal) : 0;
    delayPart = money(delayCollected * scale);
    maintPart = money(maintCollected * scale);
    canalPart = money(canalCollected * scale);
    irrPart = money(amount - delayPart - maintPart - canalPart);
  } else {
    prevPart = amount;
  }

  const creditByAccount = new Map<string, { amount: number; labels: string[] }>();
  const addCredit = (preferredCode: string, value: number) => {
    const rounded = money(value);
    if (rounded <= 0) return;
    const accountId = firstAccount(byCode, [preferredCode]) ?? incomeAccount;
    const cur = creditByAccount.get(accountId) ?? { amount: 0, labels: [] };
    cur.amount = money(cur.amount + rounded);
    cur.labels.push(preferredCode);
    creditByAccount.set(accountId, cur);
  };

  addCredit("IRR-INCOME", irrPart);
  addCredit("IRR-DELAY", delayPart);
  addCredit("IRR-MAINT", maintPart);
  addCredit("IRR-CANAL", canalPart);
  addCredit("IRR-PREV-DUE", prevPart);

  const currentCredit = Array.from(creditByAccount.values()).reduce((sum, row) => sum + row.amount, 0);
  const diff = money(amount - currentCredit);
  if (diff !== 0) {
    const cur = creditByAccount.get(incomeAccount) ?? { amount: 0, labels: [] };
    cur.amount = money(cur.amount + diff);
    cur.labels.push("IRR-INCOME");
    creditByAccount.set(incomeAccount, cur);
  }

  const lines: PostingLineDraft[] = [
    { account_id: cashAccount, debit: amount, credit: 0, position: 0, description: "Cash received" },
  ];
  let position = 1;
  for (const [accountId, row] of creditByAccount.entries()) {
    if (row.amount > 0) {
      lines.push({
        account_id: accountId,
        debit: 0,
        credit: money(row.amount),
        position: position++,
        description: Array.from(new Set(row.labels)).join(" + "),
      });
    }
  }

  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (money(debit - credit) !== 0) throw new Error("Irrigation journal is not balanced");
  return lines;
}

export function buildIrrigationLedgerRows(args: {
  paymentId: string;
  entryDate: string;
  officeId?: string | null;
  createdBy?: string | null;
  lines: PostingLineDraft[];
}) {
  return args.lines.map((line) => ({
    entry_date: args.entryDate,
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
    reference_type: "irrigation_payment",
    reference_id: args.paymentId,
    description: line.description,
    office_id: args.officeId ?? null,
    created_by: args.createdBy ?? null,
  }));
}