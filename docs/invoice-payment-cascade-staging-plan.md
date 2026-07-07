# ইনভয়েস–পেমেন্ট ক্যাসকেড: স্টেজিং চেঞ্জ প্ল্যান

## উদ্দেশ্য
ইনভয়েস **ডিলিট** বা **আনপেইড** করলে ওই ইনভয়েসের বিপরীতে গৃহীত পেমেন্ট রসিদগুলো
স্বয়ংক্রিয়ভাবে void হবে এবং রসিপ্ট লিস্ট থেকে সরে যাবে — ডেটা ইন্টিগ্রিটি বজায় রেখে।

## পরিবর্তিত অংশ
- `src/lib/voidInvoicePayments.ts` — নতুন শেয়ারড হেল্পার `voidPaymentsForInvoice()`।
- `src/pages/IrrigationInvoices.tsx` — `deleteInvoice()` ও `markUnpaid()` হেল্পার ব্যবহার করে।

## আচরণ
1. `irrigation_invoice_payments` + `payment_allocations` (kind='irrigation') থেকে সংশ্লিষ্ট `payment_id` সংগ্রহ।
2. প্রতিটি `payments` রসিদ `status='voided'` (soft-void) — hard delete নয়।
3. `irrigation_invoice_payments` লিংক সারি মুছে ফেলা।
4. প্রতিটি void-এ `audit_logs` এন্ট্রি (`module=irrigation_payment`, `action_type=void`)।

## স্টেজিং রোলআউট ধাপ
1. স্টেজিং ডেটাবেসে একটি টেস্ট ইনভয়েস + পেমেন্ট তৈরি।
2. ইনভয়েস ডিলিট → রসিপ্ট লিস্টে ওই রসিদ অনুপস্থিত, অডিট লগ যাচাই।
3. আরেকটি ইনভয়েস আনপেইড → রসিদ void, `due_amount` পুনরুদ্ধার যাচাই।
4. e2e + integration টেস্ট চালানো (`payments-*`, `voidInvoicePayments`)।

## রিস্ক
| রিস্ক | প্রভাব | প্রশমন |
|-------|--------|--------|
| মিশ্র বরাদ্দ (savings+irrigation) রসিদ void | পুরো রসিদ void হয় | বিদ্যমান `voidPayment` আচরণের সাথে সামঞ্জস্যপূর্ণ; soft-void তাই পুনরুদ্ধারযোগ্য |
| আংশিকভাবে void হওয়া (network fail) | কিছু রসিদ void হয় না | হেল্পার প্রতি-রসিদ স্বতন্ত্র; পুনরায় ডিলিট করলে বাকিগুলো ধরা পড়ে |
| ভুল ইনভয়েস ডিলিট | রসিদ void | soft-void — DB থেকে `status` ফিরিয়ে রোলব্যাক সম্ভব |

## রোলব্যাক
- কোড: এই পরিবর্তনের কমিট রিভার্ট করলে পূর্বের আচরণে ফিরে যায়।
- ডেটা: void সম্পূর্ণ soft — প্রভাবিত `payments` রো-তে
  `status='approved', voided_at=NULL, voided_by=NULL, void_reason=NULL` সেট করে পুনরুদ্ধার;
  `irrigation_invoice_payments` লিংক আবার তৈরি করতে হবে (অডিট লগ থেকে reference)।
