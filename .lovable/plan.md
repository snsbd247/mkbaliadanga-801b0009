## লক্ষ্য

ডেটাবেস ও UI কে সরল করা: Savings Plans বাদ, free-form Savings/Share deposit + withdraw (interest নাই, min ৳10/৳50), receipt number support (auto + manual field-receipt), irrigation rate সরলীকরণ, জমির পরিমাণ "শতক" এ standardize, account number শুধু DB-level (UI তে শুধু voter/manual নাম্বার)। বাকি সব আগের ৬ ধাপ আগেই complete।

## এই batch-এ যা করব (scope)

ব্যবহারকারীর নতুন বার্তায় কিছু আইটেম **আগেই করা হয়েছে** (DUES_BLOCK breakdown, voter history, voter cancel/reactivate tests, Savings dropdown, account auto-generate, Voter toggle savings trigger)। সেগুলো পুনরায় করব না। নতুন কাজ গুলো নিচে।

### ১. Savings/Share — সরল মডেল
- Savings Plans পেজ ও routes/sidebar entry সরিয়ে দিব (DB টেবিল রেখে দিব — legacy data সুরক্ষা)।
- Savings ফর্মে type: **Deposit, Share Deposit, Withdraw**।
- Min validation: deposit ≥ ৳10, share ≥ ৳50, withdraw > 0।
- Withdraw → status `pending` (existing approval flow আছেই, কেবল status badge ও approve/reject UI স্পষ্ট করব)।
- ব্যালেন্স check: withdraw amount > available balance হলে block।
- কোন interest calc নেই।

### ২. Receipt Number (manual + auto)
- `payments` ও `savings_transactions` এ `receipt_no text` কলাম যোগ।
- Insert এর সময় খালি থাকলে DB trigger auto-generate করবে (`RCPT-YYYYMMDD-####` office-wise sequential)।
- Form-এ optional "Field Receipt #" input — backdated entry তে staff ম্যানুয়াল বসাতে পারবে।
- Reports (Collection report, Savings list, Payments list) এ Receipt No কলাম যোগ।

### ৩. Irrigation Rate সরলীকরণ
- IrrigationRates ফর্ম থেকে Canal Charge / Maintenance / Other ফিল্ড UI তে hide। `base_rate` ই থাকবে।
- IrrigationCharges এন্ট্রিতেও এই তিনটি ০ default রাখব (DB কলাম legacy তে রাখব, UI hide)।

### ৪. জমির পরিমাণ — শতক
- Lands টেবিলের `land_size` সব জায়গায় "শতক" (decimal) হিসেবে label করব। Display unit "শতক/Decimal" everywhere।
- কোন numeric conversion করব না (data already numeric); শুধু label/placeholder/tooltip আপডেট।

### ৫. Account Number — DB-only
- Farmers list ও Farmer detail UI থেকে `account_number` কলাম/field hide।
- ম্যানুয়াল নম্বরের জায়গায় **Member No** (existing `member_no` text field) ব্যবহার করব — সব table/card/report এ সেটা দেখাবে।
- Voter toggle অন করলে auto-generate হয়ে DB তে account_number বসবে (already implemented), তবে UI তে দেখাবে না।
- "Post Office" ফিল্ড farmer form থেকে বাদ।

### ৬. Tests
- Savings deposit/share min validation tests
- Withdraw insufficient balance test
- Receipt number auto vs manual entry test

## যা করব না (out of scope)
- Unified transaction history, unified payment form, irrigation calc engine, loan interest settings, daily/monthly bilingual export — এগুলো অনেক বড় feature; পরবর্তী batch এ আলাদা ভাবে নেব।

## Migration summary
- ALTER TABLE `payments` ADD COLUMN `receipt_no text`
- ALTER TABLE `savings_transactions` ADD COLUMN `receipt_no text`
- Trigger: BEFORE INSERT — যদি `receipt_no` NULL হয় তবে `RCPT-YYYYMMDD-NNNN` (office-wise daily sequence) সেট করবে
- Index: `(office_id, receipt_no)` unique
- Add ENUM value `share_deposit` to `savings_txn_type` (replaces share_collection mapping)

## Files to touch
- supabase migration (new)
- src/pages/Savings.tsx — type options, min validation, balance check, receipt field, withdraw status display
- src/pages/Payments.tsx — receipt_no field + display
- src/pages/IrrigationRates.tsx — hide canal/maintenance/other
- src/pages/Farmers.tsx, FarmerDetail.tsx, BulkCards.tsx — hide account_number, drop post_office, show member_no
- src/components/card/MembershipCard.tsx — show member_no instead
- src/App.tsx + AppSidebar.tsx — remove SavingsPlans route/link
- src/pages/reports/CollectionReport.tsx — add Receipt No column
- New tests: Savings.minValidation, Receipt.autoGenerate

## কনফার্ম
এই scope এ এগোতে অনুমতি দিন? "Plans বাদ" সত্যিই DB টেবিল ড্রপ চান, নাকি শুধু UI hide (আমি UI hide preferred করছি — safer)?
