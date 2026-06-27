# Finalization Plan — অগ্রাধিকার ৪–৭

চারটি বাকি কাজ ধাপে ধাপে শেষ করব, প্রতি ধাপের পর রিগ্রেশন টেস্ট চালিয়ে নিশ্চিত করব যেন অন্য কোনো মডিউল না ভাঙে। প্রতিটি ধাপ আলাদা করে ডেলিভার করব।

## ধাপ ৪ — Paid History পুনর্গঠন
- ফার্মার/মালিক/বর্গাদার প্রোফাইলে Paid History টেবিল নতুন কলামে সাজানো হবে: রশিদ নং, তারিখ, মৌজা/দাগ, জমির ধরন, পরিমাণ, রেট (একর/বিঘা), হাল চার্জ, জরিমানা, বকেয়া, মোট আদায়।
- পুরাতন "Paid Land" ভিত্তিক লজিক (যেটি জমি-ভিত্তিক স্ট্যাটাস দেখাত) বাদ দিয়ে invoice/payment-ভিত্তিক ইতিহাসে রূপান্তর।
- Cancelled রশিদ আলাদা ব্যাজে দেখানো হবে, টোটাল থেকে বাদ যাবে।

## ধাপ ৫ — Approval Matrix সম্পূর্ণ করা
- নিয়ম: **Office payment / Loan disbursement / Withdrawal → approval লাগবে**; **Irrigation / Savings deposit / Share collection → approval-free (auto-approved)**।
- `payments` ও সংশ্লিষ্ট insert পয়েন্টে kind অনুযায়ী status সেট হবে (collection = `approved`, payout = `pending`)।
- `Approvals.tsx`-এ শুধু approval-প্রয়োজন আইটেমগুলো দেখাবে; office payout আলাদা ট্যাবে যোগ হবে।

## ধাপ ৬ — Report Footer Summary + Collection Filter একত্রীকরণ
- `CollectionReport.tsx`-এ Collection filter (kind/সিজন/তারিখ/অফিস) ও footer Grand Total একটি জায়গায় মিলিয়ে দেওয়া হবে।
- Footer-এ মোট হাল, জরিমানা, বকেয়া, মোট আদায় — filtered set-এর সাথে হুবহু মিলবে।
- Cancelled রশিদ বাদ; PDF/Excel এক্সপোর্টেও একই টোটাল।

## ধাপ ৭ — Receipt Cancel + Edit সম্পূর্ণ ফ্লো (carry-forward সহ)
- Cancel: রশিদ void → invoice payment রিভার্স → due পুনরায় ওপেন → audit log; carried-forward থাকলে carry target-ও সঠিকভাবে রোলব্যাক।
- Edit: amount/penalty পরিবর্তনে due ও carry-forward পুনঃগণনা; পুরনো রশিদ নম্বর সংরক্ষণ।
- ডাবল-কাউন্টিং প্রতিরোধে `carried_forward` ফিল্টার বজায় থাকবে।

## টেকনিক্যাল নোট
- প্রভাবিত ফাইল: `src/pages/Approvals.tsx`, `src/pages/reports/CollectionReport.tsx`, `src/components/payments/IrrigationPaymentPanel.tsx`, `src/lib/irrigationPaymentLifecycle.ts`, `src/lib/farmerDues.ts`, FarmerDetail/Profile Paid History অংশ, ও সংশ্লিষ্ট edge function।
- প্রতিটি ধাপ শেষে `bunx vitest run` রিগ্রেশন চালানো হবে।

## প্রশ্ন
এই চারটি একসাথে অনুমোদন করবেন, নাকি কোন একটি ধাপ আগে শুরু করব?
