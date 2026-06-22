# সেচ, পেমেন্ট, ক্যাশবুক ও রিপোর্ট মডিউল ফাইনালাইজেশন

এটি বড় কাজ, তাই **৭টি ধাপে** ভাগ করা হলো। প্রতি ধাপ আলাদাভাবে টেস্ট ও ডেলিভার হবে যাতে অন্য কোনো মডিউল ভেঙে না যায়। প্রতিটি ধাপ শেষে আপনি যাচাই করবেন, তারপর পরের ধাপে যাবো।

---

## ধাপ ১ — Season Rate ও জমির ধরন সম্প্রসারণ
বর্তমানে আছে: উঁচু / নিচু / মাঝারি। নতুন যোগ হবে: **পুকুর, ভর্তি ফি, বিঘাত, সবজি/ক্রিয়া ফসল**।

- সিজন রেট কনফিগারেশনে নতুন ক্যাটেগরি যোগ (irrigation_categories / category_rates)।
- প্রতিটি ক্যাটেগরির জন্য আলাদা রেট ও হিসাবের একক (একর/বিঘা/পুকুর-ভিত্তিক/ফিক্সড ফি)।
- রসিদে জমির ধরন সঠিক লেবেলে দেখাবে (`irrigationLandType.ts` আপডেট)।

## ধাপ ২ — Mouza Simplification ও Dag Number
- ফার্মার/জমি ফর্মে Division→Village চেইন বাদ, শুধু **Mouza** ব্যবহার।
- Dag Number **আনলিমিটেড** — একাধিক ড্যাগ সংরক্ষণ ও রসিদে প্রদর্শন।
- বিদ্যমান ডেটা মাইগ্রেশন: প্রয়োজনে Village→Mouza ম্যাপিং (পুরোনো ডেটা নষ্ট হবে না)।

## ধাপ ৩ — বর্গা (Barga) Due Logic
- মালিকের জমির বর্গা অংশ → বর্গাদারের নামে ডিউ; অবশিষ্ট → মালিকের নামে ডিউ।
- জমি এডিট করলে ডিউ স্বয়ংক্রিয় পুনঃহিসাব।
- একই জমি একাধিক **Active** বর্গাদারে দেওয়া নিষেধ (ভ্যালিডেশন)।
- Invoice-পরবর্তী জমি Transfer হলে ডিউ নতুন মালিক/বর্গাদারে স্থানান্তর; পুরাতনের কাছে শূন্য।

## ধাপ ৪ — Invoice Generation, Filter ও Due হিসাব
- Invoice জেনারেট ফিল্টার: উঁচু/নিচু/মাঝারি/পুকুর/ভর্তি ফি/বিঘাত/সবজি — নির্বাচিতগুলোই Invoice হবে।
- **Double-due fix**: Invoice জেনারেটের পর Total Due দ্বিগুণ দেখাবে না।
- Season Rule: নতুন সিজনে আগের সিজন Paid হোক বা না হোক Invoice জেনারেট করা যাবে।
- Due/Paid ফিল্টার: Season Wise, Due, Paid, Partial, Invoice Wise, Receipt Wise।

## ধাপ ৫ — Receipt, Paid History ও Receipt Number
- **Due Invoice-এ রসিদ ডাউনলোড বন্ধ**; শুধু Payment হলে ডাউনলোড।
- পুরোনো "Paid Land" অপশন বাদ → নতুন **Paid History**: Season, Receipt No, Amount, Collection Date, Download।
- Receipt Number নতুন করে **১ থেকে** শুরু।
- Profile-এ দেখাবে: Own Land, Barga Land, Mouza, Dag No, Land Area, Due, Paid History।

## ধাপ ৬ — Payment, Approval, Edit/Cancel
- Profile → **Pay Now** সরাসরি Irrigation Payment-এ (Combination নয়)।
- Approval দরকার: Loan Disbursement, Withdrawal, Office Payout। দরকার নেই: Irrigation/Savings/Share Collection।
- Admin Receipt Edit (Mouza, Amount, Land Area, Fine ইত্যাদি) → সব Audit Log-এ।
- Admin Receipt **Cancel** → Status=Cancelled, রিপোর্ট/কালেকশনে গণনা হবে না, Audit Log-এ থাকবে।

## ধাপ ৭ — Cash Book, Report ও Historical Entry
- দুটি আলাদা Cash Book: **Irrigation** ও **Savings/Cooperative**; কলাম: Date, Voucher No, Description, Income, Expense, Balance (running balance)।
- Report ফিল্টার: Only Irrigation / Only Savings / Combined।
- Footer Summary: Total Irrigation, Savings, Loan, Profit, Grand Total।
- Cancelled রসিদ রিপোর্টে বাদ।
- **Historical Receipt Entry** স্ক্রিন: পুরোনো রসিদ এন্ট্রি (Farmer/Owner/Bargadar প্রোফাইল + Paid History-তে যোগ, নতুন ফরম্যাটে ডাউনলোড)। Data entry fields: Farmer ID/Name, Father, Village, Mobile, Owner ID, Mouza, Land Area, Rate, Land Type, Dag No, Total Charge, Receipt No, Collection Date (Patwari ফাঁকা)।

---

## কারিগরি নোট (ডেভেলপার)
- **DB**: `irrigation_categories`/`irrigation_category_rates` সম্প্রসারণ; `lands.mouza`+একাধিক dag; বর্গা সম্পর্কের জন্য `land_relations` ব্যবহার; `irrigation_invoices`/`receipts`-এ `status` (open/partial/paid/cancelled) ও cancel/edit audit ক্ষেত্র; receipt counter রিসেট। প্রতিটি নতুন টেবিলে GRANT + RLS।
- **Frontend**: `IrrigationInvoices.tsx`, `IrrigationPaymentPanel.tsx`, `Profile.tsx`, `Cashbook.tsx`, `Reports.tsx`/`IrrigationReports.tsx`, নতুন Historical Entry পেজ।
- দুটি ক্যাশ স্ট্রিম (সেচ vs সেভিং) আলাদা থাকবে — মেমোরি অনুযায়ী।
- প্রতিটি ধাপে বিদ্যমান টেস্ট চালানো হবে; রিগ্রেশন এড়াতে নতুন এজ-কেস টেস্ট যোগ হবে।

প্রথমে **ধাপ ১** থেকে শুরু করবো। অনুমোদন দিলে এগোই।
