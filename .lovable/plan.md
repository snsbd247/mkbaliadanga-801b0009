## বর্তমান অবস্থা (যা পাওয়া গেছে)

- লোন পরিশোধ হয় `src/pages/CombinedPayment.tsx`-এ — একটিমাত্র "ঋণ পরিশোধ" অঙ্ক, আসল/লাভ আলাদা নেই। বাকি = `total_payable − মোট পরিশোধ`।
- `loan_payments` টেবিলে শুধু `amount`/`penalty_collected` আছে — আসল ও লাভ আলাদা সংরক্ষণের কলাম নেই।
- `loan_plans`-এ `interest_rate`, `duration_months` আছে; কোনো ডেডিকেটেড UI নেই (FarmerDetail/Diagnostics-এ ব্যবহার হয়)।
- সেভিং সদস্যতা = farmer.`is_voter` ফ্ল্যাগ (Savings A/C)। CombinedPayment-এ লোন দেওয়ার সময় এই চেক নেই।
- রসিদ: লোন/সঞ্চয় রসিদ `src/lib/bnReceipts.ts` (orientation `p|l`, paper `a4|letter` সাপোর্ট করে)। ডিফল্ট portrait/a4। A5 নেই bnReceipts-এ।

## পরিবর্তন পরিকল্পনা

### ১. লোন পরিশোধে আসল (বাধ্যতামূলক) + লাভ (অপশনাল, সাজেশনসহ)
- `CombinedPayment.tsx`-এ লোন সেকশনে দুটি ইনপুট: **আসল (৳)** বাধ্যতামূলক, **লাভ (৳)** অপশনাল।
- লাভের ঘরে placeholder/সাজেশন: লোন প্ল্যানের রেট অনুযায়ী এ পর্যন্ত জমা হওয়া মাসিক লাভ গণনা করে দেখাবে — `সাজেস্ট লাভ = বকেয়া আসল × (plan.interest_rate% ÷ duration_months) × অতিবাহিত মাস`। একটি "সাজেশন প্রয়োগ" বোতাম থাকবে।
- সংরক্ষণ: `loan_payments`-এ নতুন `principal_amount` ও `interest_amount` কলাম; `amount = principal + interest`।

### ২. লোন প্ল্যান ৬ মাস / ৯% — সম্পাদনযোগ্য
- নতুন ছোট অ্যাডমিন পেজ `/admin/loan-plans` (নাম, মেয়াদ মাস, সুদের হার, সক্রিয়) যাতে প্ল্যান যোগ/সম্পাদনা করা যায়। সাইডবারে Savings গ্রুপে লিংক।

### ৩. লোন দেওয়ার সময় সেভিং সদস্য বাধ্যতামূলক
- লোন ইস্যু/পরিশোধ ফর্মে farmer `is_voter` না হলে error: "শুধু সঞ্চয় সদস্যকে ঋণ দেওয়া যাবে"। CombinedPayment-এ লোন সিলেক্ট/পরিশোধ ব্লক হবে non-member হলে।

### ৪. লোন ও সঞ্চয় রসিদ A5 ল্যান্ডস্কেপ
- `bnReceipts.ts`-এ `paper` টাইপে `"a5"` যোগ; লোন/সঞ্চয় রসিদ কলে `paper:"a5", orientation:"l"` সেট করা হবে (`FarmerDetail`/`CombinedPayment`-এর প্রিন্ট কল)। লেআউট A5-ল্যান্ডস্কেপে ফিট করার সমন্বয়।

### ৫. আংশিক পরিশোধে জোরপূর্বক ডিউ নয়
- বাকি সবসময় `total_payable − মোট পরিশোধ` হিসেবে গণনা হবে (ইনস্টলমেন্ট-ভিত্তিক ৫০০ ফিক্সড ডিউ নয়)। ১০০ দিলে বাকি ১০০ কমবে, ৪০০ "due" দেখাবে না। কোনো ডিসকাউন্ট অপশন যোগ করা হবে না (ব্যবহারকারীর পছন্দ অনুযায়ী)।

## টেকনিক্যাল বিবরণ
- মাইগ্রেশন: `ALTER TABLE loan_payments ADD COLUMN principal_amount numeric, ADD COLUMN interest_amount numeric;` (RLS অপরিবর্তিত)।
- নতুন ফাইল: `src/pages/LoanPlans.tsx` + App.tsx রুট + AppSidebar লিংক।
- সম্পাদনা: `CombinedPayment.tsx` (আসল/লাভ ইনপুট, সাজেশন, সদস্য চেক, A5 রসিদ), `bnReceipts.ts` (a5)।
- পুরোনো রেকর্ডে `principal_amount` null হলে আগের মতো `amount` ব্যবহৃত হবে — অন্য মডিউল অপরিবর্তিত।

নিশ্চিত করতে একটি প্রশ্ন: লাভ গণনা কি "৬ মাসে একবারে ৯%" (পুরো মেয়াদে ৯%) ধরে অতিবাহিত মাস অনুযায়ী আনুপাতিক হবে, নাকি প্রতি মাসে ৯%? উপরে আমি আনুপাতিক (৯%÷৬ প্রতি মাস) ধরেছি।</parameter>
<parameter name="summary">Loan repayment principal/interest split with monthly interest suggestion, editable loan plans, savings-member requirement, A5 landscape receipts, flexible partial payments