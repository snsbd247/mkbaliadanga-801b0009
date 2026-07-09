// Consolidated financial summary computed DIRECTLY from operational source
// tables (source of truth), NOT from the accounting ledger — so figures are
// always accurate even if the manual ledger drifts.
//
// Side-effect free & fully unit-tested. All amounts are numbers (BDT).
import { computeSocietyStatement, computeBankSummary, type BankSummaryRow } from "@/lib/societyCashStatement";

const num = (v: unknown) => Number((v as number) ?? 0) || 0;
const sum = <T>(rows: T[], pick: (r: T) => unknown) => rows.reduce((s, r) => s + num(pick(r)), 0);

export type FsBankAccount = {
  id: string;
  stream?: string | null;
  opening_balance?: number | string | null;
  bank_name?: string | null;
  account_no?: string | null;
  account_title?: string | null;
};
export type FsBankTx = { bank_account_id: string; txn_type: string; amount: number | string };
export type FsInvoice = { paid_amount?: number | string | null; due_amount?: number | string | null };
export type FsCollection = { collected_amount?: number | string | null };
export type FsStreamAmount = { stream?: string | null; amount: number | string };
export type FsSaving = { type: string; amount: number | string };
export type FsAmount = { amount: number | string };
export type FsLoan = { principal?: number | string | null; total_due?: number | string | null };

export type FinancialSummaryInput = {
  bankAccounts: FsBankAccount[];
  bankTx: FsBankTx[];
  invoices: FsInvoice[];         // active irrigation_invoices (not deleted/cancelled)
  collections: FsCollection[];   // irrigation_invoice_payments
  officeIncomes: FsStreamAmount[];
  expenses: FsStreamAmount[];
  savings: FsSaving[];
  loanPayments: FsAmount[];
  loans: FsLoan[];               // active loans (not deleted)
  openingIrrigationCash?: number; // fiscal-year starting irrigation cash on hand
  openingSavingsCash?: number;    // fiscal-year starting savings/society cash on hand
};

// Bank stream buckets: "sech" = irrigation, everything else = society/savings side.
const isSech = (s?: string | null) => (s ?? "").toLowerCase() === "sech";

export type FinancialSummary = {
  // Bank
  bankRows: BankSummaryRow[];
  bankBalance: number;
  bankBalanceSech: number;
  bankBalanceSociety: number;
  // Irrigation (সেচ)
  irrigationIncome: number;
  irrigationExpense: number;
  irrigationDue: number;
  irrigationCashInHand: number;
  // Savings / society (সমিতি)
  savingsCashInHand: number;
  // Loans
  loanGiven: number;
  loanDue: number;
};

export function computeFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const {
    bankAccounts = [], bankTx = [], invoices = [], collections = [],
    officeIncomes = [], expenses = [], savings = [], loanPayments = [], loans = [],
  } = input;

  // ---- Bank balances (per account closing, split by stream) ----
  const bankRows = computeBankSummary(bankAccounts, bankTx);
  const sechIds = new Set(bankAccounts.filter((a) => isSech(a.stream)).map((a) => a.id));
  const rowStreamById = (i: number) => bankAccounts[i]?.id;
  let bankBalanceSech = 0;
  let bankBalanceSociety = 0;
  bankRows.forEach((r, i) => {
    if (sechIds.has(rowStreamById(i) as string)) bankBalanceSech += r.closing;
    else bankBalanceSociety += r.closing;
  });
  const bankBalance = bankBalanceSech + bankBalanceSociety;

  // Net cash that moved OUT of hand INTO bank (deposit - withdraw), sech side.
  const sechTx = bankTx.filter((t) => sechIds.has(t.bank_account_id));
  const sechDeposit = sum(sechTx.filter((t) => t.txn_type === "deposit"), (t) => t.amount);
  const sechWithdraw = sum(sechTx.filter((t) => t.txn_type === "withdraw"), (t) => t.amount);
  const netToBankSech = sechDeposit - sechWithdraw;

  // ---- Irrigation (সেচ) ----
  const openingIrrigationCash = num(input.openingIrrigationCash);
  const openingSavingsCash = num(input.openingSavingsCash);
  const invoiceCollected = sum(collections, (c) => c.collected_amount);
  const sechOfficeIncome = sum(officeIncomes.filter((o) => isSech(o.stream)), (o) => o.amount);
  const irrigationIncome = invoiceCollected + sechOfficeIncome;
  const irrigationExpense = sum(expenses.filter((e) => (e.stream ?? "").toLowerCase() === "irrigation"), (e) => e.amount);
  const irrigationDue = sum(invoices, (inv) => inv.due_amount);
  const irrigationCashInHand = openingIrrigationCash + irrigationIncome - irrigationExpense - netToBankSech;

  // ---- Savings / society (সমিতি) — reuse the audited society statement engine ----
  const society = computeSocietyStatement({
    savings,
    loanPayments,
    bankTx: bankTx.filter((t) => !sechIds.has(t.bank_account_id)),
    officeIncomes: officeIncomes.filter((o) => !isSech(o.stream)),
    expenses: expenses.filter((e) => (e.stream ?? "").toLowerCase() !== "irrigation"),
    loansIssued: loans.map((l) => ({ principal: num(l.principal) })),
    opening: openingSavingsCash,
  });
  const savingsCashInHand = society.closingFund;

  // ---- Loans ----
  const loanGiven = sum(loans, (l) => l.principal);
  const loanDue = sum(loans, (l) => l.total_due);

  return {
    bankRows,
    bankBalance,
    bankBalanceSech,
    bankBalanceSociety,
    irrigationIncome,
    irrigationExpense,
    irrigationDue,
    irrigationCashInHand,
    savingsCashInHand,
    loanGiven,
    loanDue,
  };
}
