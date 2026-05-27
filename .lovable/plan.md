# Farmer Module Enhancement Plan

১৪টা request কে ৫টা logical group এ ভাগ করছি। প্রতিটা group আলাদা migration + UI change হবে যাতে review সহজ হয়।

---

## Group A — Land + Patwari (req #1, #2, #4)

**DB changes (`lands` table):**
- নতুন column: `patwari_id uuid` (references farmers — patwari নিজেও একটা farmer/staff record)
- পুরাতন patwari assign system (যেটা আলাদা page/table-এ ছিল) remove

**UI:**
- Land Add/Edit dialog-এ "পাটুয়ারি" dropdown (FarmerSearchSelect দিয়ে)
- Farmer Profile → Lands tab-এ "পাটুয়ারি" column add
- পুরাতন patwari assignment page/menu remove

---

## Group B — Ownership & Sharecrop (req #3, #6, #8, #9)

**DB changes (`lands` table):**
- `tenure_type text` — values: `own` / `borga` (sharecrop)
- `owner_farmer_id uuid` — মালিকের farmer_id (borga হলে required)
- `area_decimal` constraint: একই owner+dag combination-এ মোট বর্গা+নিজ চাষ ≤ মোট জমি (validation trigger)

**Logic:**
- জমির মালিকের ৭৫ শতক → একাধিক row হিসেবে split করা যাবে: 70 শতক borga (farmer A), 5 শতক own (মালিক নিজে)
- সেচ চার্জ যেই farmer_id-তে land row আছে তার বিপরীতে generate হবে (existing flow)

**UI:**
- Land Add form-এ "জমির ধরন" radio: নিজস্ব / বর্গা
- বর্গা select হলে "মালিকের নাম" FarmerSearchSelect দেখাবে
- Farmer Profile → Lands tab-এ borga row-তে "মালিক: [নাম]" — clickable link → owner farmer profile
- **Owner View** (Farmer Profile-এর নতুন "মালিকানাধীন জমি" tab):
  - সব borga-দেয়া জমির list + কোন farmer-এ assigned + ঐ জমির latest irrigation invoice status (Paid/Unpaid badge)
- **Tenant view** (existing Lands tab): নিজের জমি + অন্যের থেকে borga নেওয়া জমি — already covers req #9

---

## Group C — Land Inheritance & Transfer History (req #5, #7)

**DB changes:** নতুন table `land_transfer_history`
- columns: `land_id`, `from_farmer_id`, `to_farmer_id`, `transfer_type` (inheritance/borga_transfer/sale), `area_decimal`, `remark`, `transferred_at`, `created_by`
- পুরাতন land row never modified — নতুন land row create হবে নতুন owner-এ, original row "transferred" status-এ archive

**UI:**
- Land row → "Transfer/বণ্টন" button:
  - Inheritance mode: মালিকের n জন ছেলে select → equal split (or custom %) → n টা নতুন land row auto-create
  - Borga transfer mode: এক বর্গাদার → অন্য বর্গাদার, remark field সহ
- Land History tab: পুরো transfer chain timeline view, remark সহ

---

## Group D — Savings Statement & Profit (req #10, #11)

**DB changes (`savings_transactions`):**
- নতুন kind value: `profit` (admin manual entry)
- নতুন column: `field_receipt_no text` (ফিল্ড রশিদ নাম্বার, optional)
- নতুন column: `remark text` (existing memo rename বা parallel)
- Withdrawal validation trigger: `amount > current_balance` হলে reject

**UI:**
- Savings page → "Profit Entry" button (admin only): farmer select + amount + remark
- Farmer Profile → Statement tab columns: তারিখ | রশিদ# | ফিল্ড রশিদ# | টাইপ | জমা | উত্তলন | প্রফিট | চলমান ব্যালেন্স | রিমার্ক | স্ট্যাটাস
- Withdrawal form: balance check + error message "জমাকৃত টাকার বেশি উত্তলন সম্ভব নয়"

---

## Group E — Loan Guarantor & Flexible Plan (req #12, #13, #14)

**DB changes:**
- নতুন table `loan_guarantors`: `loan_id`, `farmer_id` (nullable), `name`, `father_name`, `village`, `mobile`, `nid`
- `loans` table: `repayment_mode text` — values: `installment` / `bullet` (lump-sum at end)
- `loans` table: `fully_paid_on date`, computed `days_to_repay` (issue → fully_paid)

**UI:**
- Loan create form: 
  - Repayment mode toggle (installment vs bullet)
  - Guarantor section: manual entry fields OR "Select farmer" toggle (auto-fill from farmer record)
  - Nominee section removed from loan (savings-only)
- Loan summary: ইস্যু তারিখ, পরিষোধ তারিখ, কত দিন, mode
- Previous loan repayment days নতুন loan create-এ informational badge হিসেবে দেখাবে (eligibility hint)
- Installment list table: নতুন column "পেমেন্ট রশিদ#" (linked payment receipt_no)

---

## Execution Order

1. Group A (smallest, foundation) → migration + UI
2. Group D (savings — independent) → migration + UI  
3. Group B (ownership) → migration + UI
4. Group E (loan) → migration + UI
5. Group C (transfer/inheritance — most complex, depends on B) → migration + UI

প্রতিটা group শেষ করে browser test করে next-এ যাব।

---

## Questions আমার (approve করার আগে)

1. **Patwari** কি farmer record-এর মধ্যেই একটা flag/role, নাকি আলাদা `staff` table আছে? — existing schema check করব implementation-এ।
2. **Inheritance split**: equal split default, কিন্তু custom % override allow করব?
3. **Profit entry** কি savings_balance-এ যোগ হবে (compounded), নাকি শুধু statement-এ দেখাবে আলাদা column হিসেবে?

আপনি approve করলে Group A থেকে শুরু করছি। কোনো group reorder/skip চাইলে বলুন।