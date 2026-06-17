import { describe, it, expect } from "vitest";
import {
  buildIrrJamaRows,
  buildIrrKharchRows,
  sumIrrJama,
  sumIrrKharch,
  type IrrCashBookInput,
} from "../irrigationCashBook";

// Fixed fixture data covering every income/expense/misc mapping branch.
const fixture: IrrCashBookInput = {
  farmerNames: { "f1": "করিম", "f2": "রহিম" },
  payments: [
    { kind: "irrigation", amount: 1000, created_at: "2026-01-05T10:00:00Z", receipt_no: "R1", farmer_id: "f1", status: null },
    { kind: "irrigation", amount: "500", created_at: "2026-01-03T10:00:00Z", receipt_no: "R2", farmer_id: "f2", status: null },
    // non-irrigation payment must be ignored
    { kind: "savings", amount: 999, created_at: "2026-01-04T10:00:00Z", receipt_no: "X", farmer_id: "f1", status: null },
  ],
  officeIncomes: [
    { received_on: "2026-01-06", income_type: "নালা চার্জ", amount: 200, receipt_no: "O1", payer_name: "ক" },
    { received_on: "2026-01-07", income_type: "বিলম্ব ফি", amount: 50, receipt_no: "O2", payer_name: "খ" },
    { received_on: "2026-01-08", income_type: "রক্ষণাবেক্ষণ", amount: 300, receipt_no: "O3", payer_name: "গ" },
    { received_on: "2026-01-09", income_type: "পুকুর ইজারা", amount: 400, receipt_no: "O4", payer_name: "ঘ" },
    { received_on: "2026-01-10", income_type: "অন্যান্য", amount: 25, receipt_no: "O5", payer_name: "ঙ" },
  ],
  bankTx: [
    { txn_date: "2026-01-11", txn_type: "withdraw", amount: 700, reference_no: "B1" },
    // deposit must be ignored on income side
    { txn_date: "2026-01-12", txn_type: "deposit", amount: 800, reference_no: "B2" },
  ],
  expenses: [
    { expense_date: "2026-01-05", head: "শ্রমিক মজুরি", amount: 100, voucher_no: "V1", payee: "শ্রমিক" },
    { expense_date: "2026-01-06", head: "যন্ত্রাংশ ক্রয়", amount: 150, voucher_no: "V2", payee: "দোকান" },
    { expense_date: "2026-01-07", head: "যন্ত্রাংশ মেরামত", amount: 60, voucher_no: "V3", payee: "মিস্ত্রি" },
    { expense_date: "2026-01-08", head: "যাতায়াত", amount: 40, voucher_no: "V4", payee: "" },
    { expense_date: "2026-01-09", head: "আপ্যায়ন", amount: 30, voucher_no: "V5", payee: "" },
    { expense_date: "2026-01-10", head: "প্রচার", amount: 20, voucher_no: "V6", payee: "" },
    { expense_date: "2026-01-11", head: "বেতন ও ভাতা", amount: 500, voucher_no: "V7", payee: "" },
    { expense_date: "2026-01-12", head: "বিদ্যুৎ বিল", amount: 250, voucher_no: "V8", payee: "" },
    { expense_date: "2026-01-13", head: "স্টেশনারি", amount: 15, voucher_no: "V9", payee: "" },
    { expense_date: "2026-01-14", head: "অফিস ভাড়া", amount: 600, voucher_no: "V10", payee: "" },
    { expense_date: "2026-01-15", head: "মোটর বাঁধা", amount: 350, voucher_no: "V11", payee: "" },
    { expense_date: "2026-01-16", head: "ব্যাংক জমা", amount: 800, voucher_no: "V12", payee: "", is_bank_deposit: true },
    { expense_date: "2026-01-17", head: "অন্যান্য বিবিধ", amount: 5, voucher_no: "V13", payee: "" },
  ],
};

describe("irrigationCashBook — income (জমা) mapping", () => {
  const rows = buildIrrJamaRows(fixture, "bn");
  const tot = sumIrrJama(rows);

  it("ignores non-irrigation payments", () => {
    expect(rows.some((r) => r.total === 999)).toBe(false);
  });

  it("maps irrigation payments to sechCharge", () => {
    expect(tot.sechCharge).toBe(1500);
  });

  it("maps office incomes by keyword", () => {
    expect(tot.nalaCharge).toBe(200);
    expect(tot.lateFee).toBe(50);
    expect(tot.maintenance).toBe(300);
    expect(tot.pond).toBe(400);
    expect(tot.misc).toBe(25);
  });

  it("maps only bank withdrawals", () => {
    expect(tot.bankWithdraw).toBe(700);
  });

  it("grand total equals sum of all income cells", () => {
    expect(tot.total).toBe(1500 + 200 + 50 + 300 + 400 + 25 + 700);
    expect(tot.total).toBe(3175);
  });

  it("sorts rows by date ascending", () => {
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
  });
});

describe("irrigationCashBook — expense (খরচ) mapping", () => {
  const rows = buildIrrKharchRows(fixture, "bn");
  const tot = sumIrrKharch(rows);

  it("maps each expense head to the right column", () => {
    expect(tot.labor).toBe(100);
    expect(tot.partsBuy).toBe(150);
    expect(tot.partsRepair).toBe(60);
    expect(tot.transport).toBe(40);
    expect(tot.hospitality).toBe(30);
    expect(tot.publicity).toBe(20);
    expect(tot.salary).toBe(500);
    expect(tot.electricity).toBe(250);
    expect(tot.stationery).toBe(15);
    expect(tot.officeRent).toBe(600);
    expect(tot.motor).toBe(350);
    expect(tot.misc).toBe(5);
  });

  it("maps bank deposits via is_bank_deposit flag", () => {
    expect(tot.bankDeposit).toBe(800);
  });

  it("grand total equals sum of all expense cells", () => {
    expect(tot.total).toBe(100 + 150 + 60 + 40 + 30 + 20 + 500 + 250 + 15 + 600 + 350 + 800 + 5);
    expect(tot.total).toBe(2920);
  });
});

describe("irrigationCashBook — edge cases", () => {
  it("returns empty rows and zero totals for empty input", () => {
    expect(buildIrrJamaRows({}, "bn")).toEqual([]);
    expect(buildIrrKharchRows({}, "bn")).toEqual([]);
    expect(sumIrrJama([]).total).toBe(0);
    expect(sumIrrKharch([]).total).toBe(0);
  });
});
