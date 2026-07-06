// Pure helpers for the Irrigation Income-Expense Cash Book (সেচ আয়-ব্যয় ক্যাশ বহি).
// Builds row-level জমা (income) and খরচ (expense) ledgers from backend rows,
// mapping data into the column layout of the traditional handwritten ledger.
// Side-effect free so column totals can be unit-tested against source data.

export type IrrJamaRow = {
  date: string;
  receiptNo: string;
  name: string;
  sechCharge: number;     // সেচ চার্জ
  nalaCharge: number;     // নালা চার্জ
  maintenance: number;    // রক্ষণাবেক্ষণ
  lateFee: number;        // বিলম্ব ফি
  bankWithdraw: number;   // ব্যাংকে উত্তোলন
  pond: number;           // পুকুর
  hawlat: number;         // হাওলাত গ্রহণ
  misc: number;           // বিবিধ
  total: number;          // মোট
};

export type IrrKharchRow = {
  date: string;
  voucherNo: string;
  name: string;          // কি বাবদ খরচ
  labor: number;         // শ্রমিক
  partsBuy: number;      // যন্ত্রাংশ ক্রয়
  partsRepair: number;   // যন্ত্রাংশ মেরামত
  transport: number;     // যাতায়াত
  hospitality: number;   // আপ্যায়ন
  publicity: number;     // প্রচার
  salary: number;        // বেতন ও ভাতা
  electricity: number;   // বিদ্যুৎ বিল
  stationery: number;    // স্টেশনারি
  officeRent: number;    // অফিস ভাড়া
  motor: number;         // মোটর বাঁধা
  bankDeposit: number;   // ব্যাংক জমা
  misc: number;          // বিবিধ
  total: number;         // মোট
};

export type PaymentRow = {
  kind: string; amount: number | string; created_at: string;
  receipt_no?: string | null; farmer_id?: string | null; status?: string | null;
};
export type OfficeIncomeRow = {
  received_on: string; income_type?: string | null; amount: number | string;
  receipt_no?: string | null; payer_name?: string | null;
};
export type BankTxnRow = { txn_date: string; txn_type: string; amount: number | string; reference_no?: string | null };
export type IrrExpenseRow = {
  expense_date: string; head?: string | null; amount: number | string;
  voucher_no?: string | null; payee?: string | null; is_bank_deposit?: boolean;
};

export type NameMap = Record<string, string>;
type ReportLang = "en" | "bn";

const n = (v: number | string | null | undefined) => Number(v || 0);
const has = (h: string | null | undefined, words: string[]) =>
  !!h && words.some((w) => h.toLowerCase().includes(w.toLowerCase()));

// ── Income (office_incomes) keyword → column ────────────────────────────────
const NALA = ["নালা", "drain", "canal", "খাল"];
const MAINT_IN = ["রক্ষণাবেক্ষণ", "maintenance", "মেরামত"];
const LATE = ["বিলম্ব", "late", "delay", "জরিমানা"];
const POND = ["পুকুর", "pond", "মাছ", "সরী", "lease", "ইজারা"];

// ── Expense (expenses.head) keyword → column ────────────────────────────────
const LABOR = ["শ্রমিক", "labor", "labour", "মজুরি", "মজুর"];
const PARTS_BUY = ["যন্ত্রাংশ ক্রয়", "parts purchase", "parts buy", "ক্রয়", "purchase", "যন্ত্রাংশ"];
const PARTS_REPAIR = ["যন্ত্রাংশ মেরামত", "repair", "মেরামত"];
const TRANSPORT = ["যাতায়াত", "transport", "travel", "ভ্রমণ", "গাড়ি", "ভাড়া যাতায়াত"];
const HOSPITALITY = ["আপ্যায়ন", "hospitality", "আপায়ন"];
const PUBLICITY = ["প্রচার", "publicity", "বিজ্ঞাপন", "advert"];
const SALARY = ["বেতন", "ভাতা", "salary", "allowance"];
const ELECTRICITY = ["বিদ্যুৎ", "electric", "কারেন্ট", "current", "বিল"];
const STATIONERY = ["স্টেশনারি", "ক্রেশনারি", "stationery", "stationary"];
const OFFICE_RENT = ["অফিস ভাড়া", "office rent", "কার্যালয় ভাড়া"];
const MOTOR = ["মোটর", "motor", "পাম্প", "pump", "মেশিন", "machine"];

export type IrrCashBookInput = {
  payments?: PaymentRow[];
  officeIncomes?: OfficeIncomeRow[];
  bankTx?: BankTxnRow[];
  expenses?: IrrExpenseRow[];
  farmerNames?: NameMap;
};

export function buildIrrJamaRows(input: IrrCashBookInput, lang: ReportLang = "bn"): IrrJamaRow[] {
  const { payments = [], officeIncomes = [], bankTx = [], farmerNames = {} } = input;
  const rows: IrrJamaRow[] = [];

  for (const p of payments) {
    if (p.kind !== "irrigation") continue;
    const amt = n(p.amount);
    rows.push({
      date: (p.created_at || "").slice(0, 10), receiptNo: p.receipt_no ?? "",
      name: farmerNames[p.farmer_id ?? ""] ?? (lang === "bn" ? "সেচ চার্জ" : "Irrigation charge"),
      sechCharge: amt, nalaCharge: 0, maintenance: 0, lateFee: 0,
      bankWithdraw: 0, pond: 0, hawlat: 0, misc: 0, total: amt,
    });
  }
  for (const o of officeIncomes) {
    const amt = n(o.amount);
    const t = o.income_type;
    const row: IrrJamaRow = {
      date: o.received_on, receiptNo: o.receipt_no ?? "", name: o.payer_name ?? "",
      sechCharge: 0, nalaCharge: 0, maintenance: 0, lateFee: 0,
      bankWithdraw: 0, pond: 0, misc: 0, total: amt,
    };
    if (has(t, NALA)) row.nalaCharge = amt;
    else if (has(t, LATE)) row.lateFee = amt;
    else if (has(t, MAINT_IN)) row.maintenance = amt;
    else if (has(t, POND)) row.pond = amt;
    else row.misc = amt;
    rows.push(row);
  }
  for (const b of bankTx) {
    if (b.txn_type !== "withdraw") continue;
    const amt = n(b.amount);
    rows.push({
      date: b.txn_date, receiptNo: b.reference_no ?? "",
      name: lang === "bn" ? "ব্যাংক উত্তোলন" : "Bank withdrawal",
      sechCharge: 0, nalaCharge: 0, maintenance: 0, lateFee: 0,
      bankWithdraw: amt, pond: 0, misc: 0, total: amt,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildIrrKharchRows(input: IrrCashBookInput, _lang: ReportLang = "bn"): IrrKharchRow[] {
  const { expenses = [] } = input;
  const rows: IrrKharchRow[] = [];

  for (const e of expenses) {
    const amt = n(e.amount);
    const h = e.head;
    const row: IrrKharchRow = {
      date: e.expense_date, voucherNo: e.voucher_no ?? "", name: e.payee ?? e.head ?? "",
      labor: 0, partsBuy: 0, partsRepair: 0, transport: 0, hospitality: 0, publicity: 0,
      salary: 0, electricity: 0, stationery: 0, officeRent: 0, motor: 0,
      bankDeposit: 0, misc: 0, total: amt,
    };
    if (e.is_bank_deposit) row.bankDeposit = amt;
    else if (has(h, LABOR)) row.labor = amt;
    else if (has(h, PARTS_REPAIR)) row.partsRepair = amt;
    else if (has(h, PARTS_BUY)) row.partsBuy = amt;
    else if (has(h, TRANSPORT)) row.transport = amt;
    else if (has(h, HOSPITALITY)) row.hospitality = amt;
    else if (has(h, PUBLICITY)) row.publicity = amt;
    else if (has(h, SALARY)) row.salary = amt;
    else if (has(h, MOTOR)) row.motor = amt;
    else if (has(h, ELECTRICITY)) row.electricity = amt;
    else if (has(h, STATIONERY)) row.stationery = amt;
    else if (has(h, OFFICE_RENT)) row.officeRent = amt;
    else row.misc = amt;
    rows.push(row);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function sumIrrJama(rows: IrrJamaRow[]) {
  return rows.reduce((a, r) => ({
    sechCharge: a.sechCharge + r.sechCharge, nalaCharge: a.nalaCharge + r.nalaCharge,
    maintenance: a.maintenance + r.maintenance, lateFee: a.lateFee + r.lateFee,
    bankWithdraw: a.bankWithdraw + r.bankWithdraw, pond: a.pond + r.pond,
    misc: a.misc + r.misc, total: a.total + r.total,
  }), { sechCharge: 0, nalaCharge: 0, maintenance: 0, lateFee: 0, bankWithdraw: 0, pond: 0, misc: 0, total: 0 });
}

export function sumIrrKharch(rows: IrrKharchRow[]) {
  return rows.reduce((a, r) => ({
    labor: a.labor + r.labor, partsBuy: a.partsBuy + r.partsBuy, partsRepair: a.partsRepair + r.partsRepair,
    transport: a.transport + r.transport, hospitality: a.hospitality + r.hospitality, publicity: a.publicity + r.publicity,
    salary: a.salary + r.salary, electricity: a.electricity + r.electricity, stationery: a.stationery + r.stationery,
    officeRent: a.officeRent + r.officeRent, motor: a.motor + r.motor, bankDeposit: a.bankDeposit + r.bankDeposit,
    misc: a.misc + r.misc, total: a.total + r.total,
  }), {
    labor: 0, partsBuy: 0, partsRepair: 0, transport: 0, hospitality: 0, publicity: 0,
    salary: 0, electricity: 0, stationery: 0, officeRent: 0, motor: 0, bankDeposit: 0, misc: 0, total: 0,
  });
}

// ── Ordered column keys (single source of truth for rendering + export) ──────
export const JAMA_COL_KEYS = [
  "sechCharge", "nalaCharge", "maintenance", "lateFee", "bankWithdraw", "pond", "misc",
] as const;
export const KHARCH_COL_KEYS = [
  "labor", "partsBuy", "partsRepair", "transport", "hospitality", "publicity", "salary",
  "electricity", "stationery", "officeRent", "motor", "bankDeposit", "misc",
] as const;

export type JamaColKey = (typeof JAMA_COL_KEYS)[number];
export type KharchColKey = (typeof KHARCH_COL_KEYS)[number];

export type JamaExportLabels = {
  date: string; receiptNo: string; receivedFrom: string; total: string; grandTotal: string;
  cols: string[]; // must align with JAMA_COL_KEYS order/length
};
export type KharchExportLabels = {
  date: string; voucherNo: string; purpose: string; total: string; grandTotal: string;
  cols: string[]; // must align with KHARCH_COL_KEYS order/length
};

type Cell = string | number;

// Pure matrix: [header, ...rows, grandTotal]. Used by both XLSX and CSV exports
// so columns, totals, and language headers stay identical across formats.
export function buildJamaExportMatrix(
  rows: IrrJamaRow[], tot: ReturnType<typeof sumIrrJama>, labels: JamaExportLabels,
): Cell[][] {
  const head: Cell[] = [labels.date, labels.receiptNo, labels.receivedFrom, ...labels.cols, labels.total];
  const body: Cell[][] = rows.map((r) => [
    r.date, r.receiptNo, r.name, ...JAMA_COL_KEYS.map((k) => Number(r[k]) || ""), r.total,
  ]);
  const grand: Cell[] = [labels.grandTotal, "", "", ...JAMA_COL_KEYS.map((k) => Number(tot[k]) || ""), tot.total];
  return [head, ...body, grand];
}

export function buildKharchExportMatrix(
  rows: IrrKharchRow[], tot: ReturnType<typeof sumIrrKharch>, labels: KharchExportLabels,
): Cell[][] {
  const head: Cell[] = [labels.date, labels.voucherNo, labels.purpose, ...labels.cols, labels.total];
  const body: Cell[][] = rows.map((r) => [
    r.date, r.voucherNo, r.name, ...KHARCH_COL_KEYS.map((k) => Number(r[k]) || ""), r.total,
  ]);
  const grand: Cell[] = [labels.grandTotal, "", "", ...KHARCH_COL_KEYS.map((k) => Number(tot[k]) || ""), tot.total];
  return [head, ...body, grand];
}

// Office scoping: a scoped user (officeId set) is always locked to their office;
// only a non-scoped admin may pick an office (or "all" → null).
export function resolveEffectiveOffice(
  officeId: string | null, isAdmin: boolean, officeFilter: string,
): string | null {
  if (officeId) return officeId;
  if (!isAdmin) return null;
  return officeFilter === "all" ? null : officeFilter;
}
