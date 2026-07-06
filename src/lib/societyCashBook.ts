// Pure helpers for the Society Income/Expense Cash Book (সমিতির আয়-ব্যয় ক্যাশ বহি).
// Builds row-level জমা (receipts) and খরচ (payments) ledgers from backend rows.
// Side-effect free so column totals can be unit-tested against source data.

export type JamaRow = {
  date: string;
  receiptNo: string;
  name: string;
  share: number;          // শেয়ার
  savings: number;        // সঞ্চয়ের আমানত
  bankWithdraw: number;   // ব্যাংক উত্তোলন
  loanPrincipal: number;  // কর্জের আদায় (আমানত)
  loanInterest: number;   // কর্জের সুদ আদায়
  form: number;           // ফরম
  hawlat: number;         // হাওলাত গ্রহণ
  misc: number;           // বিবিধ
  total: number;          // মোট
};

export type KharchRow = {
  date: string;
  voucherNo: string;
  name: string;
  depositReturn: number;  // জমানত ফেরত
  bankDeposit: number;    // ব্যাংক জমা
  loanGiven: number;      // ঋণ প্রদান
  salary: number;         // বেতন ভাতা
  misc: number;           // বিবিধ
  total: number;          // মোট
};

export type SavingsTxn = {
  txn_date: string; type: string; amount: number | string;
  receipt_no?: string | null; farmer_id?: string | null;
};
export type LoanPaymentRow = {
  paid_on: string; amount: number | string;
  principal_amount?: number | string | null; interest_amount?: number | string | null;
  receipt_no?: string | null; loan_id?: string | null;
};
export type BankTxnRow = { txn_date: string; txn_type: string; amount: number | string; reference_no?: string | null };
export type OfficeIncomeRow = { received_on: string; income_type?: string; amount: number | string; receipt_no?: string | null; payer_name?: string | null };
export type ExpenseRow = { expense_date: string; head?: string | null; amount: number | string; voucher_no?: string | null; payee?: string | null; is_bank_deposit?: boolean };
export type LoanIssued = { issued_on: string; principal: number | string; loan_no?: string | null; farmer_id?: string | null };

export type NameMap = Record<string, string>;        // farmer_id -> name
export type LoanFarmerMap = Record<string, string>;  // loan_id -> farmer_id

const n = (v: number | string | null | undefined) => Number(v || 0);
const SALARY_HEADS = ["salary", "বেতন", "ভাতা"];
const isSalary = (h?: string | null) => !!h && SALARY_HEADS.some((s) => h.toLowerCase().includes(s.toLowerCase()));
type ReportLang = "en" | "bn";

export type CashBookInput = {
  savings: SavingsTxn[];
  loanPayments: LoanPaymentRow[];
  bankTx: BankTxnRow[];
  officeIncomes: OfficeIncomeRow[];
  expenses: ExpenseRow[];
  loansIssued: LoanIssued[];
  farmerNames?: NameMap;
  loanFarmers?: LoanFarmerMap;
};

export function buildJamaRows(input: CashBookInput, lang: ReportLang = "bn"): JamaRow[] {
  const { savings = [], loanPayments = [], bankTx = [], officeIncomes = [], farmerNames = {}, loanFarmers = {} } = input;
  const rows: JamaRow[] = [];

  for (const s of savings) {
    if (s.type !== "deposit" && s.type !== "share_collection") continue;
    const amt = n(s.amount);
    const isShare = s.type === "share_collection";
    rows.push({
      date: s.txn_date, receiptNo: s.receipt_no ?? "", name: farmerNames[s.farmer_id ?? ""] ?? "",
      share: isShare ? amt : 0, savings: isShare ? 0 : amt,
      bankWithdraw: 0, loanPrincipal: 0, loanInterest: 0, form: 0, misc: 0, total: amt,
    });
  }
  for (const l of loanPayments) {
    const principal = n(l.principal_amount);
    const interest = n(l.interest_amount);
    const total = principal + interest || n(l.amount);
    const fid = loanFarmers[l.loan_id ?? ""] ?? "";
    rows.push({
      date: l.paid_on, receiptNo: l.receipt_no ?? "", name: farmerNames[fid] ?? "",
      share: 0, savings: 0, bankWithdraw: 0, loanPrincipal: principal, loanInterest: interest,
      form: 0, misc: 0, total,
    });
  }
  for (const b of bankTx) {
    if (b.txn_type !== "withdraw") continue;
    const amt = n(b.amount);
    rows.push({
      date: b.txn_date, receiptNo: b.reference_no ?? "", name: lang === "bn" ? "ব্যাংক উত্তোলন" : "Bank withdrawal",
      share: 0, savings: 0, bankWithdraw: amt, loanPrincipal: 0, loanInterest: 0, form: 0, misc: 0, total: amt,
    });
  }
  for (const o of officeIncomes) {
    const amt = n(o.amount);
    const isForm = (o.income_type ?? "").toLowerCase().includes("form") || o.income_type === "ফরম";
    rows.push({
      date: o.received_on, receiptNo: o.receipt_no ?? "", name: o.payer_name ?? "",
      share: 0, savings: 0, bankWithdraw: 0, loanPrincipal: 0, loanInterest: 0,
      form: isForm ? amt : 0, misc: isForm ? 0 : amt, total: amt,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildKharchRows(input: CashBookInput, _lang: ReportLang = "bn"): KharchRow[] {
  const { savings = [], expenses = [], loansIssued = [], farmerNames = {} } = input;
  const rows: KharchRow[] = [];

  for (const s of savings) {
    if (s.type !== "withdraw") continue;
    const amt = n(s.amount);
    rows.push({
      date: s.txn_date, voucherNo: s.receipt_no ?? "", name: farmerNames[s.farmer_id ?? ""] ?? "",
      depositReturn: amt, bankDeposit: 0, loanGiven: 0, salary: 0, misc: 0, total: amt,
    });
  }
  for (const l of loansIssued) {
    const amt = n(l.principal);
    rows.push({
      date: l.issued_on, voucherNo: l.loan_no ?? "", name: farmerNames[l.farmer_id ?? ""] ?? "",
      depositReturn: 0, bankDeposit: 0, loanGiven: amt, salary: 0, misc: 0, total: amt,
    });
  }
  for (const e of expenses) {
    const amt = n(e.amount);
    const bank = !!e.is_bank_deposit;
    const sal = !bank && isSalary(e.head);
    rows.push({
      date: e.expense_date, voucherNo: e.voucher_no ?? "", name: e.payee ?? e.head ?? "",
      depositReturn: 0, bankDeposit: bank ? amt : 0, loanGiven: 0,
      salary: sal ? amt : 0, misc: !bank && !sal ? amt : 0, total: amt,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function sumJama(rows: JamaRow[]) {
  return rows.reduce((a, r) => ({
    share: a.share + r.share, savings: a.savings + r.savings, bankWithdraw: a.bankWithdraw + r.bankWithdraw,
    loanPrincipal: a.loanPrincipal + r.loanPrincipal, loanInterest: a.loanInterest + r.loanInterest,
    form: a.form + r.form, misc: a.misc + r.misc, total: a.total + r.total,
  }), { share: 0, savings: 0, bankWithdraw: 0, loanPrincipal: 0, loanInterest: 0, form: 0, misc: 0, total: 0 });
}

export function sumKharch(rows: KharchRow[]) {
  return rows.reduce((a, r) => ({
    depositReturn: a.depositReturn + r.depositReturn, bankDeposit: a.bankDeposit + r.bankDeposit,
    loanGiven: a.loanGiven + r.loanGiven, salary: a.salary + r.salary, misc: a.misc + r.misc, total: a.total + r.total,
  }), { depositReturn: 0, bankDeposit: 0, loanGiven: 0, salary: 0, misc: 0, total: 0 });
}
