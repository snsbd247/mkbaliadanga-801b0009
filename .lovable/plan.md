# সেচ ক্যাশ ↔ ব্যাংক ট্রান্সফার — Plan

বর্তমান সিস্টেমে ইতিমধ্যে যা আছে: `bank_transactions`-এ deposit/withdraw, স্ট্রিম-ভিত্তিক ক্যাশবুক লিংকিং (`cashbookStreamForAccount`), স্ট্রিম-লক, এবং `logAudit`। এই ভিত্তির উপর ৪টি ফিচার যোগ করা হবে।

## 1. দ্রুত ব্যাংক জমা/উত্তোলন বাটন
- **কোথায়:** `src/pages/BankAccounts.tsx`-এ একটি নতুন "সেচ ক্যাশ ব্যাংকে জমা" কুইক-অ্যাকশন কার্ড/বাটন। (ইনভয়েস পেমেন্ট স্ক্রিনে প্রতি-পেমেন্ট অটো-ট্রান্সফার করলে প্রতিটি ছোট নগদ আলাদা ব্যাংক লেনদেন তৈরি করবে যা বাস্তবে অবাঞ্ছিত — তাই একত্রে "আজকের সেচ নগদ ব্যাংকে জমা" বাটন বেশি উপযোগী।)
- একটি হেল্পার (`buildSechDepositTx`) যা নির্বাচিত সেচ ব্যাংক অ্যাকাউন্ট + পরিমাণ নিয়ে বিদ্যমান `saveTxn` লজিক পুনঃব্যবহার করে deposit/withdraw সারি ও মিরর করা ক্যাশবুক সারি তৈরি করবে।

## 2. স্ট্রিম ভ্যালিডেশন
- নতুন pure হেল্পার `src/lib/cashStreamGuard.ts`: `assertSechTransfer(account)` — অ্যাকাউন্টের `stream` `sech`/`sech_small` না হলে ব্লক করে বাংলা এরর ফেরত দেয়।
- কুইক-জমা/উত্তোলন ও (ঐচ্ছিকভাবে) ট্রান্সফারে এই গার্ড প্রয়োগ; ভুল স্ট্রিম হলে toast এরর ও সেভ বন্ধ।
- Unit test দিয়ে গার্ড যাচাই।

## 3. সেচ ক্যাশ ও ব্যাংক মুভমেন্ট রিপোর্ট (তারিখ রেঞ্জ + PDF)
- নতুন পেজ `src/pages/reports/SechCashBankMovements.tsx` (route `/reports/sech-cash-bank`)।
- ইনপুট: from/to তারিখ (ডিফল্ট চলতি অর্থবছর)।
- দেখাবে: সেচ ওপেনিং ক্যাশ, সেচ আয়/খরচ, ব্যাংকে জমা, ব্যাংক থেকে উত্তোলন, ক্লোজিং ক্যাশ-ইন-হ্যান্ড (সেচ), এবং সেচ ব্যাংক ব্যালেন্স — বিদ্যমান `computeFinancialSummary`/`financialSummary.ts` লজিক পুনঃব্যবহার করে।
- লেনদেন তালিকা: তারিখভিত্তিক deposit/withdraw সারি।
- বিদ্যমান `exportTablePDF` (থেকে `@/lib/exports`) দিয়ে প্রিন্টেবল PDF এক্সপোর্ট বাটন।
- সাইডবারে Accounting সেকশনে লিংক + পারমিশন গার্ড।

## 4. ট্রান্সফার অডিট ট্রেইল + জার্নাল ভিউ
- ট্রান্সফার/জমা/উত্তোলন ইতিমধ্যে `logAudit` দিয়ে `system_audit_logs`-এ যায়; নিশ্চিত করা হবে প্রতিটি cash↔bank মুভমেন্ট লগ হয়।
- একই রিপোর্ট পেজে একটি "অডিট ও জার্নাল" ট্যাব: `system_audit_logs` (module `bank_transaction`) + সংশ্লিষ্ট `ledger_entries`/`journal_entries` (Dr/Cr) দেখাবে যাতে reconciliation সহজ হয়।
- জার্নাল পোস্টিং: deposit → Dr Bank(1020)/Cr Cash(1010); withdraw → উল্টো। বিদ্যমান `accountingPosting.ts` প্যাটার্ন অনুসরণ করে একটি হেল্পার যোগ; ব্যাকফিল ঐচ্ছিক।

## টেকনিক্যাল নোট
- ফ্রন্টএন্ড-কেন্দ্রিক; নতুন DB টেবিল লাগবে না (বিদ্যমান `bank_transactions`, `system_audit_logs`, `ledger_entries` ব্যবহার)।
- সব নতুন গণনা লজিক pure ফাংশনে রেখে unit test যোগ করা হবে।
- বাংলা UI, বিদ্যমান ডিজাইন টোকেন ও কম্পোনেন্ট ব্যবহার।

## ফাইল
- নতুন: `src/lib/cashStreamGuard.ts`, `src/pages/reports/SechCashBankMovements.tsx`, টেস্ট।
- সম্পাদনা: `src/pages/BankAccounts.tsx`, `src/App.tsx`, `src/components/layout/AppSidebar.tsx`, প্রয়োজনে `src/lib/accountingPosting.ts`।
