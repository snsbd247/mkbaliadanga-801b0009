import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Integration tests for bank deposit routing (cash→sech vs bank→bank) and
 * day-close idempotency. Uses an in-memory mock of the db client so the real
 * posting engine (createJournal, journalExists) runs end-to-end.
 */

type Row = Record<string, any>;
const store: Record<string, Row[]> = {};
let idSeq = 1;
const auditCalls: any[] = [];

function reset() {
  for (const k of Object.keys(store)) delete store[k];
  store.accounts = [
    { id: "acc-cash", code: "1010" },
    { id: "acc-bank", code: "1020" },
    { id: "acc-office-income", code: "4080" },
    { id: "acc-general-expense", code: "5080" },
    { id: "acc-bank-income", code: "4090" },
    { id: "acc-bank-expense", code: "5090" },
  ];
  store.journal_entries = [];
  store.journal_entry_lines = [];
  store.office_incomes = [];
  store.expenses = [];
  idSeq = 1;
  auditCalls.length = 0;
}

class Builder {
  private filters: Array<[string, any]> = [];
  constructor(private table: string) {}
  select() { return this; }
  eq(col: string, val: any) { this.filters.push([col, val]); return this; }
  is(col: string, val: any) { this.filters.push([col, val]); return this; }
  private rows() {
    return (store[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v));
  }
  async maybeSingle() { return { data: this.rows()[0] ?? null, error: null }; }
  async single() { return { data: this.rows()[0] ?? null, error: null }; }
  then(res: (v: any) => void) { res({ data: this.rows(), error: null }); }
  insert(rows: Row | Row[]) {
    const arr = Array.isArray(rows) ? rows : [rows];
    const inserted = arr.map((r) => ({ id: `id-${idSeq++}`, ...r }));
    (store[this.table] ??= []).push(...inserted);
    return {
      select: () => ({
        single: async () => ({ data: inserted[0], error: null }),
        maybeSingle: async () => ({ data: inserted[0], error: null }),
      }),
      then: (r: (v: any) => void) => r({ data: inserted, error: null }),
    };
  }
  update(vals: Row) {
    return {
      eq: (col: string, val: any) => {
        for (const r of store[this.table] ?? []) if (r[col] === val) Object.assign(r, vals);
        return Promise.resolve({ data: null, error: null });
      },
    };
  }
}

vi.mock("@/lib/db", () => ({ db: { from: (t: string) => new Builder(t) } }));
vi.mock("@/lib/audit", () => ({ logAudit: async (i: any) => { auditCalls.push(i); } }));

import {
  postBankCashTransfer,
  postBankExternal,
  postDayClose,
  bankCashTransferRef,
  bankExternalRef,
} from "../accountingPosting";

const journalsByRef = (ref: string) => store.journal_entries.filter((j) => j.reference === ref);
const linesFor = (ref: string) => {
  const j = journalsByRef(ref)[0];
  return j ? store.journal_entry_lines.filter((l) => l.journal_id === j.id) : [];
};

describe("bank deposit routing", () => {
  beforeEach(reset);

  it("cash source deposit posts Dr Bank / Cr Cash (touches cash)", async () => {
    await postBankCashTransfer({ bankTxnId: "t1", direction: "deposit", amount: 1000 });
    const ref = bankCashTransferRef("t1");
    const lines = linesFor(ref);
    const bank = lines.find((l) => l.account_id === "acc-bank");
    const cash = lines.find((l) => l.account_id === "acc-cash");
    expect(bank?.debit).toBe(1000);
    expect(cash?.credit).toBe(1000);
    expect(auditCalls.at(-1)).toMatchObject({ action_type: "bank_deposit_cash" });
  });

  it("external source deposit posts Dr Bank / Cr Bank-Income (never touches cash)", async () => {
    await postBankExternal({ bankTxnId: "t2", direction: "deposit", amount: 2000 });
    const ref = bankExternalRef("t2");
    const lines = linesFor(ref);
    expect(lines.some((l) => l.account_id === "acc-cash")).toBe(false);
    expect(lines.find((l) => l.account_id === "acc-bank")?.debit).toBe(2000);
    expect(lines.find((l) => l.account_id === "acc-bank-income")?.credit).toBe(2000);
    expect(auditCalls.at(-1)).toMatchObject({ action_type: "bank_deposit_external" });
  });
});

describe("day-close idempotency", () => {
  beforeEach(() => {
    reset();
    store.office_incomes.push({ id: "inc-1", amount: 500, received_on: "2026-07-11", office_id: null });
    store.expenses.push({ id: "exp-1", amount: 300, expense_date: "2026-07-11", deleted_at: null, head: "চা" });
  });

  it("does not double-post the ledger when day-close runs repeatedly", async () => {
    const first = await postDayClose({ date: "2026-07-11" });
    expect(first).toMatchObject({ ok: true, incomePosted: 1, expensePosted: 1 });

    const second = await postDayClose({ date: "2026-07-11" });
    expect(second).toMatchObject({ ok: true, incomePosted: 0, expensePosted: 0, skipped: 2 });

    // Only one journal per source reference exists after two runs.
    expect(journalsByRef("INCOME-inc-1")).toHaveLength(1);
    expect(journalsByRef("EXPENSE-exp-1")).toHaveLength(1);
  });
});
