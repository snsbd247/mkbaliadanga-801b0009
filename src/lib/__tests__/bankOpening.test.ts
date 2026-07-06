import { describe, it, expect } from "vitest";
import { partitionOpenings, summarizeBackfill, type BankAccountLike, type PostResult } from "../bankOpening";
import { bankOpeningRef } from "../accountingPosting";

const acc = (id: string, opening: number, extra: Partial<BankAccountLike> = {}): BankAccountLike => ({
  id, bank_name: "Sonali", account_no: `A-${id}`, opening_balance: opening, ...extra,
});

describe("partitionOpenings (preview/confirm data)", () => {
  it("splits accounts into to-post vs already-posted", () => {
    const accounts = [acc("1", 1000), acc("2", 5000), acc("3", 250)];
    const postedRefs = new Set([bankOpeningRef("2")]); // account 2 already posted
    const { toPost, existing } = partitionOpenings(accounts, postedRefs);
    expect(toPost.map(a => a.id)).toEqual(["1", "3"]);
    expect(existing.map(a => a.id)).toEqual(["2"]);
  });

  it("ignores accounts with zero or blank opening balance", () => {
    const accounts = [acc("1", 0), acc("2", 1000), acc("3", NaN as unknown as number)];
    const { toPost, existing } = partitionOpenings(accounts, new Set());
    expect(toPost.map(a => a.id)).toEqual(["2"]);
    expect(existing).toHaveLength(0);
  });

  it("posts nothing when every eligible account already has a journal", () => {
    const accounts = [acc("1", 1000), acc("2", 2000)];
    const postedRefs = new Set([bankOpeningRef("1"), bankOpeningRef("2")]);
    const { toPost, existing } = partitionOpenings(accounts, postedRefs);
    expect(toPost).toHaveLength(0);
    expect(existing).toHaveLength(2);
  });
});

describe("summarizeBackfill (audit log payload)", () => {
  it("counts posted vs already-existed and lists only newly posted accounts", () => {
    const results: Array<{ account: BankAccountLike; result: PostResult }> = [
      { account: acc("1", 1000), result: "posted" },
      { account: acc("2", 2000), result: "exists" },
      { account: acc("3", 3000), result: "posted" },
      { account: acc("4", 4000), result: "skipped" },
    ];
    const s = summarizeBackfill(results);
    expect(s.total).toBe(4);
    expect(s.posted).toBe(2);
    expect(s.already_existed).toBe(1);
    expect(s.accounts.map(a => a.bank_account_id)).toEqual(["1", "3"]);
    expect(s.accounts[0]).toMatchObject({ bank: "Sonali A-1", opening_balance: 1000, result: "posted" });
  });

  it("produces an empty summary for no results", () => {
    const s = summarizeBackfill([]);
    expect(s).toEqual({ total: 0, posted: 0, already_existed: 0, accounts: [] });
  });
});
