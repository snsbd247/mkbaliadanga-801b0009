// Pure, testable helpers for the Bank opening-balance backfill flow.
// The React page (BankAccounts.tsx) wires these to Supabase + toast; keeping the
// decision logic here lets us unit-test the preview/confirm and audit summary
// without a live database.

import { bankOpeningRef } from "@/lib/accountingPosting";

export interface BankAccountLike {
  id: string;
  bank_name?: string | null;
  account_no?: string | null;
  opening_balance?: number | string | null;
  office_id?: string | null;
}

/**
 * Split accounts into those that still need an opening journal (`toPost`) and
 * those that already have one (`existing`). Accounts with a zero/blank opening
 * balance are ignored entirely. `postedRefs` is the set of existing
 * journal_entries.reference values (e.g. "OPENING-BANK-<id>").
 */
export function partitionOpenings(
  accounts: BankAccountLike[],
  postedRefs: Set<string>,
): { toPost: BankAccountLike[]; existing: BankAccountLike[] } {
  const toPost: BankAccountLike[] = [];
  const existing: BankAccountLike[] = [];
  for (const ac of accounts) {
    if (Number(ac.opening_balance || 0) === 0) continue;
    (postedRefs.has(bankOpeningRef(ac.id)) ? existing : toPost).push(ac);
  }
  return { toPost, existing };
}

export type PostResult = "posted" | "exists" | "skipped";

/**
 * Fold per-account post results into an audit summary. `posted` counts newly
 * created journals; `already_existed` counts idempotent skips.
 */
export function summarizeBackfill(
  results: Array<{ account: BankAccountLike; result: PostResult }>,
): { total: number; posted: number; already_existed: number; accounts: Array<{ bank_account_id: string; bank: string; opening_balance: number; result: PostResult }> } {
  let posted = 0;
  let already_existed = 0;
  const accounts: Array<{ bank_account_id: string; bank: string; opening_balance: number; result: PostResult }> = [];
  for (const { account, result } of results) {
    if (result === "posted") {
      posted++;
      accounts.push({
        bank_account_id: account.id,
        bank: `${account.bank_name ?? ""} ${account.account_no ?? ""}`.trim(),
        opening_balance: Number(account.opening_balance || 0),
        result,
      });
    } else if (result === "exists") {
      already_existed++;
    }
  }
  return { total: results.length, posted, already_existed, accounts };
}
