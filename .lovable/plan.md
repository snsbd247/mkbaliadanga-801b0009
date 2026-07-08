# ফার্মার প্রোফাইল পেমেন্ট ট্যাব — রশিদ ঠিক করা

## সমস্যা
1. ফার্মার প্রোফাইলের **পেমেন্ট ট্যাবে** রশিদের প্রিভিউ ও ডাউনলোড আলাদা (পুরনো) কোড দিয়ে তৈরি হয় — পেমেন্ট পেজের রশিদের সাথে মিলছে না।
2. পেমেন্ট ট্যাবের রশিদ লিস্টে **রশিদ নম্বর** দেখায় না।
3. রশিদে "কৃষক এবং মালিক সভ্য সদস্য" নম্বর ভুল আসছে — বর্গা জমির ক্ষেত্রে **প্রথমে বর্গাদারের Savings Number**, তারপর `/` দিয়ে **জমির মালিকের Savings Number** আসা উচিত।

## কারণ
- `FarmerDetail.tsx`-এ প্রিভিউ ব্যবহার করে `buildPaidHistory` + `ReceiptPreviewModal` (নকল/লোকাল ডেটা) এবং ডাউনলোড ব্যবহার করে নিজস্ব `reprintReceipt()` — অথচ পেমেন্ট পেজ ব্যবহার করে শেয়ার্ড `buildPaymentReceiptData()` + `IrrigationReceiptPreviewDialog`।
- `irrigationReceiptData.ts`-এ `memberSummary = cultivatorSavingsNo ?? "N/A"` — শুধু চাষির Savings Number, বর্গা হলে মালিকের নম্বর যোগ হয় না। মালিকের কোয়েরিতে `account_number`/`savings_inactive` আনা হয় না।

## পরিকল্পনা

### ১. পেমেন্ট ট্যাবের রশিদ পেমেন্ট পেজের সাথে একীভূত করা
`src/pages/FarmerDetail.tsx`:
- `buildPaymentReceiptData` ও `IrrigationReceiptPreviewDialog` ইমপোর্ট করা।
- একটি `preview` স্টেট যোগ করা (পেমেন্ট পেজের মতো `{ data, copy }`)।
- পেমেন্ট রো-এর **Preview** বাটন: `buildPaymentReceiptData(p, { brand, receiptArgs, tx })` দিয়ে ডেটা তৈরি করে `IrrigationReceiptPreviewDialog`-এ দেখানো।
- **Download** (`ReceiptCopyMenu`): একই `buildPaymentReceiptData()` → `downloadBnReceiptPdf(...)`।
- পুরনো `reprintReceipt()` এবং পেমেন্ট-ট্যাব সংশ্লিষ্ট `buildPaidHistory`/`ReceiptPreviewModal` ব্যবহার সরানো (শুধু পেমেন্ট ট্যাবে; অন্য ট্যাব অক্ষত রাখা)।
- `brand` অবজেক্ট (company name/logo) পেমেন্ট পেজের মতো তৈরি করা।

### ২. রশিদ লিস্টে রশিদ নম্বর দেখানো
পেমেন্ট ট্যাবের টেবিলে একটি **"রশিদ নং"** কলাম যোগ করা, যা `p.receipt_no` (না থাকলে `autoReceiptNo`) দেখাবে।

### ৩. বর্গা/মালিকের Savings Number ঠিক করা
`src/lib/irrigationReceiptData.ts`:
- মালিকের কোয়েরিতে (`ownerRows`) `account_number, savings_inactive` যোগ করা।
- `ownerSavingsNo` বের করা (মালিক সদস্য হলে `account_number`, নইলে `N/A`)।
- `memberSummary` লজিক:
  - বর্গা হলে → `"{বর্গাদারের Savings No}/{মালিকের Savings No}"`
  - নিজ জমি হলে → শুধু `cultivatorSavingsNo` (আগের মতো)।

## টেকনিক্যাল নোট
- শুধু ফ্রন্টএন্ড/রশিদ-বিল্ডিং কোড পরিবর্তন; ডাটাবেজ স্কিমা বা অন্য মডিউল অপরিবর্তিত।
- শেয়ার্ড `buildPaymentReceiptData`/`irrigationReceiptData` পরিবর্তন পেমেন্ট পেজেও একই বর্গা/মালিক নম্বর সঠিকভাবে দেখাবে — অসংগতি দূর হবে।
- QR, সিরিয়াল নম্বর, সেভিং/লোন রশিদ — কোনোটিতে হাত দেওয়া হবে না।

## ঝুঁকি
- বর্গা `member_summary` পরিবর্তন পেমেন্ট পেজের রশিদেও প্রযোজ্য — এটাই কাঙ্ক্ষিত (সব জায়গায় এক রকম)।
