// Stream guard for cash ↔ bank transfers.
//
// সেচ (irrigation) নগদ শুধুমাত্র সেচ-স্ট্রিমের ব্যাংক অ্যাকাউন্টে জমা/উত্তোলন
// করা যাবে। ভুল স্ট্রিমের অ্যাকাউন্ট নির্বাচন করলে লেনদেন ব্লক হবে যাতে সেচ ও
// সমিতি/সেভিং নগদ কখনো মিশে না যায়।
//
// Pure, side-effect free & unit-tested.

export type AccountStream = string | null | undefined;

export interface BankAccountLike {
  stream?: AccountStream;
  bank_name?: string | null;
  account_no?: string | null;
}

/** সেচ (মেইন) ও ছোট সেচ — দুটোই irrigation cash side. */
export const SECH_STREAMS = ["sech", "sech_small"] as const;

export function isSechStream(stream: AccountStream): boolean {
  return SECH_STREAMS.includes(String(stream ?? "").toLowerCase() as (typeof SECH_STREAMS)[number]);
}

export interface StreamGuardResult {
  ok: boolean;
  /** Localized (Bengali) error message when blocked, otherwise null. */
  message: string | null;
}

const OK: StreamGuardResult = { ok: true, message: null };

/**
 * সেচ নগদ ↔ ব্যাংক ট্রান্সফারের জন্য নির্বাচিত ব্যাংক অ্যাকাউন্ট যাচাই করে।
 * অ্যাকাউন্ট না থাকলে বা স্ট্রিম সেচ না হলে ব্লক করে বাংলা এরর ফেরত দেয়।
 */
export function assertSechTransfer(account: BankAccountLike | null | undefined): StreamGuardResult {
  if (!account) {
    return { ok: false, message: "ব্যাংক অ্যাকাউন্ট নির্বাচন করুন।" };
  }
  if (!isSechStream(account.stream)) {
    const name = account.bank_name ? ` (${account.bank_name}${account.account_no ? " — " + account.account_no : ""})` : "";
    return {
      ok: false,
      message: `নির্বাচিত অ্যাকাউন্টটি${name} সেচ-স্ট্রিমের নয়। সেচ নগদ শুধুমাত্র সেচ (মেইন) বা ছোট সেচ অ্যাকাউন্টে জমা/উত্তোলন করা যাবে।`,
    };
  }
  return OK;
}
