# সম্পূর্ণ ডেটা ইমপোর্ট সিস্টেম

লক্ষ্য: পুরো সফটওয়্যারের প্রতিটি প্রধান এন্টিটি (১) CSV/Excel ম্যানুয়াল ইমপোর্ট এবং (২) Demo Reset/Seed — দুই জায়গাতেই কভার হবে। কোনো মডিউল/ফিল্ড বাদ যাবে না।

## ১. Farmers ইমপোর্ট — সব ফিল্ড
`src/pages/FarmersImport.tsx` এর `COLUMNS`-এ বর্তমানে ১৯টি ফিল্ড আছে। যোগ হবে:
- `account_number`, `member_no` (সদস্য নম্বর)
- `voter_number`, `is_voter`
- `mouza`, `union`, `ward`, `village_name` (নাম দিয়ে ম্যাচ → id resolve)
- `status`, `savings_inactive`, `photo_url`
টেমপ্লেট (CSV+XLSX) ও insert/update payload আপডেট হবে।

## ২. Universal Importer — নতুন মডিউল
`src/pages/DataImport.tsx` ও `src/lib/importTemplates.ts`-এ নিচের নতুন মডিউল যোগ হবে (ড্রপডাউন + টেমপ্লেট + ইমপোর্ট হ্যান্ডলার):
- **Mouzas** — name, union, upazila
- **Seasons** — name, type, year, start/end date
- **Offices** — name, code, address
- **Bank Accounts** — bank_name, account_no, branch, opening_balance
- **Bank Transactions** — account_no, type, amount, txn_date, note
- **Assets** — name, category, purchase_date, value, office
- **Loan Guarantors** — borrower account_number, guarantor name/mobile/nid

বিদ্যমান ১৩টি মডিউল অপরিবর্তিত থাকবে (কোনো রিগ্রেশন নয়)।

## ৩. Demo Seed সম্পূর্ণ করা
`supabase/functions/demo-reset/index.ts` (`ln`) — যেসব মডিউলে এখন seed হয় না সেগুলোতে নমুনা ডেটা যোগ হবে: mouzas, seasons, offices, bank accounts+transactions, assets, loan guarantors, এবং farmers-এ নতুন ফিল্ডগুলো। `MODULE_VERIFY` কাউন্ট আপডেট হবে যাতে seed-এর পর ভেরিফিকেশন সব মডিউল ধরে।

## ৪. যাচাই
- টেমপ্লেট ডাউনলোড → কলাম মিল
- প্রতিটি নতুন মডিউলে নমুনা সারি ইমপোর্ট → DB-তে row তৈরি
- Demo Reset চালিয়ে প্রতিটি মডিউলে ডেটা ও verify count পাস

## টেকনিক্যাল নোট
- নতুন কোনো টেবিল তৈরি লাগবে না; সব টার্গেট টেবিল ইতিমধ্যে আছে (farmers, mouzas, seasons, offices, bank_accounts, bank_transactions, assets, loan_guarantors)।
- নাম→id রেজলিউশন বিদ্যমান প্যাটার্ন (mouza/office lookup) অনুসরণ করবে।
- account_number দিয়ে farmer lookup—বিদ্যমান হেল্পার পুনঃব্যবহার।
- RLS/গ্রান্ট পরিবর্তন নেই; ক্লায়েন্ট authenticated হিসেবে insert করবে।
