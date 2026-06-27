## পুরো সফটওয়্যার অডিট — কি কি আছে (✅) আর কি কি নাই (❌)

আমি Irrigation, Payment, Cash Book, Report এবং Historical Entry মডিউলগুলো চেক করেছি। নিচে আপনার প্রতিটি পয়েন্টের বর্তমান অবস্থা দিলাম।

### ১. Irrigation Module

**১.১ বর্গা/মালিক Logic**
- ✅ বর্গা অংশ বর্গাদারের, অবশিষ্ট মালিকের নামে ডিউ (Unified Borga Model, `land_relations` দিয়ে)
- ✅ জমি Transfer-এ ডিউ নতুন পক্ষে যায় (`irrigationLandTransfer.ts`)
- ⚠️ জমি এডিট করে বাড়ালে ডিউ স্বয়ংক্রিয় recalculate — আংশিক, যাচাই দরকার
- ❌ একই জমি একাধিক Active বর্গাদারকে দেওয়া আটকানোর hard validation নাই
- ⚠️ একই মালিক+মৌজার একাধিক জমি একসাথে যোগ করে দেখানো — আংশিক

**১.২ Season Rate / Land Type**
- ✅ catalogue আছে: পুকুর, উঁচু, মাঝারি, নিচু
- ❌ **নাই: ভর্তি ফি, বিঘাত/বিঘাতা, সবজি/ক্রিয়া ফসল, বাগান, অন্যান্য** — যোগ করতে হবে

**১.৩ Profile Information**
- ✅ Own Land, Borga Land, Mouza, Dag No, Land Area, Due, Paid History দেখায়
- ⚠️ Land তথ্যে Season Rate Config-এর সব নাম দেখানো — যাচাই/সম্পূর্ণ করা দরকার

**১.৪ Due Calculation**
- ✅ Invoice-এর পর double-count আটকানো হয়েছে
- ✅ Transfer-এ ডিউ পুরাতন পক্ষ থেকে সরে যায়

**১.৫ Invoice Land Type Filter**
- ✅ আছে (`IrrigationInvoices.tsx`, `land_type_id` keyed) — তবে নতুন land type যোগ হলে এখানেও আসবে

**১.৬ Due/Paid Filter**
- ⚠️ Season Wise, Due, Paid আছে; ❌ Partial Paid, Invoice Wise, Receipt Wise filter সম্পূর্ণ নাই

**১.৭ Mouza Simplification** — ✅ শুধু Mouza ব্যবহার (MouzaSelect)
**১.৮ Dag Number Unlimited** — ⚠️ একাধিক dag সাপোর্ট আছে, "unlimited" UI যাচাই দরকার
**১.৯ Receipt Download Rule (Due হলে download নয়)** — ⚠️ আংশিক, কঠোরভাবে enforce করা দরকার
**১.১০ Paid History** (Season, Receipt No, Amount, Collection Date, Download + land তথ্য) — ⚠️ পুরাতন "Paid Land" বাদ + নতুন কলাম সেট করা বাকি
**১.১১ Receipt Number ১ থেকে শুরু** — ⚠️ counter reset যাচাই দরকার

### ২. Payment Module
- ✅ Profile → Pay Now সরাসরি Irrigation Payment-এ যায় (Combination নয়)
- ⚠️ Approval: Withdrawal/Loan-disbursement-এ আছে; ❌ Office payment approval + Collection-গুলো (Irrigation/Savings/Share/Loan) approval-free নিশ্চিত করা বাকি
- ⚠️ Receipt Edit (Mouza/Amount/Area/Fine) + Audit Log — আংশিক; এডিটের পর ভবিষ্যৎ সিজনে carry-forward নিশ্চিত করা বাকি
- ⚠️ Receipt Cancel (status=Cancelled, report থেকে বাদ, audit-এ থাকা) — void আছে, পূর্ণ Cancel ফ্লো যাচাই দরকার

### ৩. Cash Book
- ✅ আলাদা Irrigation Cash Book ও Society/Savings Cash Book আছে
- ✅ Date, Voucher/Receipt, Description, Income, Expense, Running Balance কলাম আছে

### ৪. Report Module
- ⚠️ Collection Report filter: Only Irrigation/Only Savings/Combined — আংশিক, একত্রে এক জায়গায় করা বাকি
- ⚠️ Footer Summary (Total Irrigation/Savings/Loan/Profit/Grand Total) — কিছু রিপোর্টে আছে, সব জায়গায় নাই
- ⚠️ Cancelled receipt report থেকে বাদ — Cancel ফ্লোর সাথে যুক্ত

### ৫. Historical Receipt Entry
- ❌ **পুরাতন রশিদ entry করার আলাদা Option নাই** — পুরো ফিচার নতুন বানাতে হবে (Farmer/Owner/Bargadar profile + Paid History + Collection report + Due add + নতুন format-এ download)

### ৬. Data Entry Fields
- ❌ Historical entry form-এর জন্য পূর্ণ ফিল্ড সেট (Farmer/Owner info, Mouza, Area, Rate, Land Type, Dag, Charge, Receipt No, Date, Note) নাই — #৫ এর অংশ

### ৭. Season Rule
- ⚠️ নতুন Season-এ Invoice generate; আগের Season Paid থাকলেও বাধা না — যাচাই/নিশ্চিত করা দরকার

---

### সারসংক্ষেপ — যেগুলো নতুন/বড় কাজ
1. **Land Type catalogue-এ ৫টি নতুন টাইপ যোগ** (ভর্তি ফি, বিঘাত, সবজি, বাগান, অন্যান্য)
2. **Historical Receipt Entry module** (পূর্ণ নতুন — #৫ ও #৬)
3. **Due/Paid filter সম্পূর্ণ** (Partial/Invoice-wise/Receipt-wise)
4. **Paid History পুনর্গঠন** (নতুন কলাম, পুরাতন Paid Land বাদ)
5. **Approval matrix ঠিক করা** (Office payment approval, collection approval-free)
6. **Report footer summary + Collection filter একত্রীকরণ**
7. **Receipt Cancel পূর্ণ ফ্লো** + এডিট carry-forward
8. **একই জমি multiple active borga block** validation

এখন বলেন কোনগুলো আগে করব — আমি ধাপে ধাপে করব যাতে কোনো মডিউল না ভাঙে।