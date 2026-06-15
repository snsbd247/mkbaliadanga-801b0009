import { test, expect } from "@playwright/test";
import {
  isLumpSum,
  lumpSumSchedule,
  lumpSumInterest,
  validateLumpSumInterest,
} from "../src/lib/lumpSumLoan";
import { lumpSumNet, exportLumpSumReceiptExcel } from "../src/lib/lumpSumReceipt";
import * as XLSX from "xlsx";

/**
 * Pure-rule regressions for the lump-sum ("একবারে পরিশোধ — মেয়াদ শেষে") loan
 * flow: schedule preview, interest validation errors, admin discount math and
 * PDF/Excel export amount correctness. No live server needed.
 */

const tx = (en: string, _bn: string) => en;

test.describe("lump-sum loan schedule + validation", () => {
  test("detects lump-sum plan type", () => {
    expect(isLumpSum("lump_sum")).toBe(true);
    expect(isLumpSum("monthly")).toBe(false);
  });

  test("schedule preview shows single end-of-term row with computed interest", () => {
    const rows = lumpSumSchedule({ principal: 50000, interestRate: 9, durationMonths: 6, issuedOn: "2026-01-01" });
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe("2026-07-01");
    expect(rows[0].principalDue).toBe(50000);
    expect(rows[0].interestDue).toBe(4500);
    expect(rows[0].totalDue).toBe(54500);
  });

  test("interest validation surfaces errors for invalid input", () => {
    expect(validateLumpSumInterest("9.25", tx).ok).toBe(true);
    expect(validateLumpSumInterest("101", tx).ok).toBe(false);
    expect(validateLumpSumInterest("9.255", tx).ok).toBe(false);
    expect(validateLumpSumInterest("-1", tx).ok).toBe(false);
    expect(validateLumpSumInterest("abc", tx).ok).toBe(false);
  });
});

test.describe("lump-sum admin discount + export correctness", () => {
  test("net = principal + interest - discount", () => {
    expect(lumpSumNet({ principal_amount: 50000, interest_amount: 4500, discount_amount: 0 })).toBe(54500);
    expect(lumpSumNet({ principal_amount: 50000, interest_amount: 4500, discount_amount: 4400 })).toBe(50100);
    // discount never produces a negative net
    expect(lumpSumNet({ principal_amount: 0, interest_amount: 100, discount_amount: 500 })).toBe(0);
  });

  test("suggested interest matches plan rate", () => {
    expect(lumpSumInterest(50000, 9)).toBe(4500);
  });

  test("Excel export contains consistent amounts", () => {
    const wb = exportLumpSumReceiptExcel({
      receipt_no: "LS-1", paid_on: "2026-07-01", farmer_name: "Test",
      member_no: "00001", loan_no: "L-1",
      principal_amount: 50000, interest_amount: 4500, discount_amount: 4400,
    });
    const ws = wb.Sheets["Receipt"];
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    const flat = aoa.flat().join("|");
    expect(flat).toContain("৳50,000"); // principal
    expect(flat).toContain("৳4,500"); // interest
    expect(flat).toContain("৳4,400"); // discount
    expect(flat).toContain("৳50,100"); // net
  });
});
