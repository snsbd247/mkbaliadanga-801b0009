// Pure helpers for the Society Cash Statement (সমিতির জমা খরচ হিসাব) audit report.
// Side-effect free so totals can be unit-tested against backend rows.

export type Line = { label: string; amount: number };

export type SocietyInput = {
  savings: { type: string; amount: number | string }[];      // savings_transactions (deposit/withdraw/share_collection)
  loanPayments: { amount: number | string }[];               // loan_payments (principal recovered)
  bankTx: { txn_type: string; amount: number | string }[];   // bank_transactions
  officeIncomes: { income_type?: string; amount: number | string }[];
  expenses: { head?: string | null; amount: number | string }[];
  loansIssued: { principal: number | string }[];
  opening?: number;
};

export type BankAccountRow = { id: string; account_no?: string | null; account_title?: string | null; opening_balance?: number | string | null };
export type BankTxRow = { bank_account_id: string; txn_type: string; amount: number | string };

export type BankSummaryRow = {
  account: string;
  opening: number;
  interest: number;
  charge: number;
  deposit: number;
  withdraw: number;
  closing: number;
};

const SALARY_HEADS = ["salary", "বেতন", "বেতন প্রদান"];

function sum<T>(rows: T[], pick: (r: T) => number | string): number {
  return rows.reduce((s, r) => s + Number(pick(r) || 0), 0);
}

export function computeSocietyStatement(input: SocietyInput) {
  const {
    savings = [], loanPayments = [], bankTx = [], officeIncomes = [],
    expenses = [], loansIssued = [], opening = 0,
  } = input;

  const shareIn = sum(savings.filter((s) => s.type === "share_collection"), (s) => s.amount);
  const savingsIn = sum(savings.filter((s) => s.type === "deposit"), (s) => s.amount);
  const savingsReturn = sum(savings.filter((s) => s.type === "withdraw"), (s) => s.amount);
  const loanRecovered = sum(loanPayments, (l) => l.amount);
  const bankDeposit = sum(bankTx.filter((b) => b.txn_type === "deposit"), (b) => b.amount);
  const bankWithdraw = sum(bankTx.filter((b) => b.txn_type === "withdraw"), (b) => b.amount);
  const bankInterest = sum(bankTx.filter((b) => b.txn_type === "interest"), (b) => b.amount);
  const miscIncome = sum(officeIncomes, (o) => o.amount);
  const loanGiven = sum(loansIssued, (l) => l.principal);

  const isSalary = (h?: string | null) => !!h && SALARY_HEADS.some((s) => h.toLowerCase().includes(s.toLowerCase()));
  const salaryOut = sum(expenses.filter((e) => isSalary(e.head)), (e) => e.amount);
  const miscExpense = sum(expenses.filter((e) => !isSalary(e.head)), (e) => e.amount);

  const incomeLines: Line[] = [
    { label: "শেয়ার আদায়", amount: shareIn },
    { label: "সঞ্চয় আদায়", amount: savingsIn },
    { label: "কর্জ আসল আদায়", amount: loanRecovered },
    { label: "ব্যাংক উত্তোলন", amount: bankWithdraw },
    { label: "ব্যাংক লাভ প্রাপ্তি", amount: bankInterest },
    { label: "বিবিধ আদায়", amount: miscIncome },
  ].filter((l) => l.amount > 0);

  const expenseLines: Line[] = [
    { label: "ব্যাংক জমা", amount: bankDeposit },
    { label: "ব্যাংক লাভ জমা", amount: bankInterest },
    { label: "সঞ্চয় ফেরত", amount: savingsReturn },
    { label: "ঋণ প্রদান", amount: loanGiven },
    { label: "বেতন প্রদান", amount: salaryOut },
    { label: "বিবিধ খরচ", amount: miscExpense },
  ].filter((l) => l.amount > 0);

  const totalIncome = incomeLines.reduce((s, l) => s + l.amount, 0);
  const totalExpense = expenseLines.reduce((s, l) => s + l.amount, 0);
  const openingFund = Number(opening || 0);
  const grandIncome = totalIncome + openingFund;
  const closingFund = grandIncome - totalExpense;
  const grandExpense = totalExpense + closingFund;

  return { incomeLines, expenseLines, totalIncome, totalExpense, openingFund, grandIncome, closingFund, grandExpense };
}

export function computeBankSummary(accounts: BankAccountRow[], txns: BankTxRow[]): BankSummaryRow[] {
  return accounts.map((a) => {
    const t = txns.filter((x) => x.bank_account_id === a.id);
    const opening = Number(a.opening_balance || 0);
    const interest = sum(t.filter((x) => x.txn_type === "interest"), (x) => x.amount);
    const charge = sum(t.filter((x) => x.txn_type === "charge"), (x) => x.amount);
    const deposit = sum(t.filter((x) => x.txn_type === "deposit"), (x) => x.amount);
    const withdraw = sum(t.filter((x) => x.txn_type === "withdraw"), (x) => x.amount);
    const closing = opening + interest - charge + deposit - withdraw;
    const account = `${a.account_no ?? ""}${a.account_title ? ` (${a.account_title})` : ""}`.trim() || "—";
    return { account, opening, interest, charge, deposit, withdraw, closing };
  });
}
