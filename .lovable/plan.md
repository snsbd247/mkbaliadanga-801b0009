## লক্ষ্য

Payments পেজে পেমেন্ট রিসিভ করার সময় ইউজার চাইলে (১) রশিদ নম্বর এবং (২) রশিদের তারিখ ম্যানুয়ালি বসাতে পারবেন — যাতে পুরনো গ্যাপ (যেমন 4754) পূরণ করা যায়। কিছু না দিলে আগের মতো সিরিয়াল অনুযায়ী অটো-জেনারেট হবে, কাউন্টার ভাঙবে না, অন্য মডিউল অক্ষত থাকবে।

## UI পরিবর্তন — `src/pages/Payments.tsx`

Payments ফর্মে বিদ্যমান "Field Receipt #" ইনপুটটির নাম পরিষ্কার করে "রশিদ নং (ম্যানুয়াল / গ্যাপ পূরণ)" রাখা হবে। পাশে নতুন একটি "রশিদের তারিখ (ঐচ্ছিক)" date-picker যোগ হবে (ডিফল্ট: আজ, ফাঁকা রাখলে সার্ভার-সাইড `now()`)।

Live validation বার:
- ফাঁকা → auto serial preview (আগের মতো)।
- সংখ্যা এবং current serial-start (পরবর্তী auto নম্বর) থেকে ছোট → সবুজ ব্যাজ "গ্যাপ পূরণ — সিরিয়াল অক্ষত থাকবে"।
- current serial-start-এর সমান/বড় → লাল ব্যাজ "সিরিয়াল ব্রেক করবে — অনুমোদিত নয়"।
- একই নম্বর অন্য active payment/receipt-এ থাকলে → লাল ব্যাজ "ডুপ্লিকেট"।

Permission: `payments_manual_receipt` (নতুন) বা `isSuper`/`isAdmin` না থাকলে ইনপুট দুটি disabled + tooltip "শুধু admin".

## সার্ভার-সাইড গার্ড — নতুন RPC

`supabase/migrations/…_manual_receipt_validation.sql`-এ নতুন RPC:

```
public.validate_manual_receipt_no(_no text)
  returns table(status text, reason text)
```

status = `ok_gap` (গ্যাপে পড়ে), `duplicate`, `would_break_serial`, `invalid_format`. Payments.tsx ইনসার্টের আগেই এটি কল করবে; সার্ভার সত্য উৎস (single source of truth) — কেউ ক্লায়েন্ট বাইপাস করলেও গার্ডেড।

`next_serial_receipt_no()` অপরিবর্তিত থাকবে — ম্যানুয়ালি বসানো গ্যাপ নম্বর `max_used`-এর চেয়ে ছোট বলে counter এগোবে না; auto serial আগের মতোই চলবে।

## Payments.tsx ইনসার্ট flow পরিবর্তন

```
if (manualReceiptNo) {
  const { data } = await db.rpc("validate_manual_receipt_no", { _no });
  if (data.status !== "ok_gap") toast.error(...); return;
}
payload.receipt_no = manualReceiptNo || await nextUnifiedReceiptNo(...);
if (manualDate) {
  payload.created_at = manualDate;   // ISO
  payload.occurred_at = manualDate;
}
```

`occurred_at` fallback আগেই সার্ভারে `now()`; explicit দিলে সেটি ব্যবহার হবে।

## Audit

যখন manual override হবে, `system_audit_logs`-এ entry:
`action='payment_manual_override'`, meta: `{ receipt_no, backdated_to, reason: 'gap-fill' }`. Cashbook reconciliation প্যানেলে এই receipt আর "missing" দেখাবে না — automatic।

## যেসব মডিউলে impact নেই তা নিশ্চিতকরণ

- Cashbook: `receipt_date` = `occurred_at || created_at` — ম্যানুয়াল তারিখেই সঠিক দিনে পড়বে।
- Irrigation invoice payments: `irrigation_invoice_payments.payment_id` FK — অপরিবর্তিত।
- Receipt PDF: `buildPaymentReceiptData` `p.created_at` ব্যবহার করে — ম্যানুয়াল তারিখই ছাপবে।
- Serial counter: গ্যাপ-নম্বর `max_used`-এর চেয়ে ছোট বলে `next_serial_receipt_no` অক্ষত।
- Reports/collection: সব `created_at`/`occurred_at` ভিত্তিক — ব্যাকডেটেড রো সঠিক মাসে যাবে।

## Regression টেস্ট

`src/lib/__tests__/manualReceiptValidation.test.ts` — pure validation ফাংশনের ইউনিট টেস্ট:
- gap number (4754 while serial=4770) → `ok_gap`
- ≥ serial-start → `would_break_serial`
- duplicate → `duplicate`
- non-numeric গ্যাপ চেষ্টা → `invalid_format`

## সিকিউরিটি

- Manual override শুধু admin/super বা `payments_manual_receipt` permission-holder।
- RPC `security definer`, `search_path=public`, শুধু `authenticated` grant।
- Audit log প্রতি override-এ বাধ্যতামূলক।

## ডেলিভারিতে যা যা থাকবে

1. নতুন migration: RPC `validate_manual_receipt_no` + permission slug + grants।
2. `src/pages/Payments.tsx`: ইনপুট UI, live validation, permission gate, insert flow।
3. Audit log ইনসার্ট helper।
4. Vitest ইউনিট টেস্ট।
5. `mem://features/payment-manual-receipt.md` — নিয়মগুলো memory-তে সেভ।

Approve করলে ধাপে ধাপে implement করি।