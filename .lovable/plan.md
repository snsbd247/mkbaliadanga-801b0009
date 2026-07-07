# Plan: Receipt Serial Fix + Manual Patwari on Payment

## Problem 1 — রশিদ নম্বর admin এর সেট করা মান মানছে না

**যা পাওয়া গেছে (DB যাচাই করে):**
- Admin panel এ 4641 দেওয়া হলেও ডাটাবেসে `receipt_serial_start` এখনো **4** (সর্বশেষ আপডেট 2026-07-06) — অর্থাৎ 4641 আসলে সেভই হয়নি।
- সিরিয়াল কাউন্টার (`receipt_counters` SERIAL) এখন **8**, তাই পেমেন্টে ছোট নম্বর (৯) জেনারেট হচ্ছে।
- এছাড়া বর্তমান সার্ভার ফাংশনের হিসাব-এ off‑by‑one সমস্যা আছে: এটি start মানটাকেই প্রথম রশিদ হিসেবে দেয়, কিন্তু ক্লায়েন্ট চান start = "সর্বশেষ ব্যবহৃত", পরের রশিদ = start+1 (৪৬৪১ → ৪৬৪২)।

**দুটি আলাদা কারণ, দুটোই ঠিক করা হবে:**

### A. সেভ নির্ভরযোগ্য করা
- `ReceiptTemplate` save flow (edge function `receipt-serial-admin` → RPC `admin_set_receipt_serial_start` → direct table fallback) কেন 4641 persist করেনি তা যাচাই করব।
- edge function/RPC টেস্ট করে নিশ্চিত করব সেভ সফল হয় এবং সেভের পর `receipt_settings.receipt_serial_start` সঠিক মান ধরে রাখে। ব্যর্থ হলে ব্যবহারকারীকে পরিষ্কার error দেখাবে (নীরবে ব্যর্থ হবে না)।

### B. নম্বরিং সেমান্টিক ঠিক করা (start+1)
- নতুন migration এ `next_serial_receipt_no()` এমনভাবে লিখব যেন:
  - Admin start = N সেট করলে পরবর্তী জেনারেট হওয়া রশিদ = **N+1**।
  - Start বাড়ালে কাউন্টার সেই মানে জাম্প করে (ডুপ্লিকেট এড়াতে কখনো কমবে না)।
- `admin_set_receipt_serial_start` এর গার্ড এই নতুন সেমান্টিকের সাথে সামঞ্জস্য রাখা হবে (N < সর্বশেষ ইস্যু হলে reject)।
- `NOTIFY pgrst, 'reload schema'` যোগ করা হবে (মেমরির নিয়ম অনুযায়ী)।

এতে 4641 সেভ করলে পরবর্তী পেমেন্ট রশিদ 4642 হবে।

## Problem 2 — পেমেন্টের সময় পাটুয়ারি ম্যানুয়ালি সিলেক্ট

**বর্তমান আচরণ:** রশিদের পাটুয়ারি শুধু জমির (`lands.patwari_id`) সাথে যুক্ত পাটুয়ারি থেকে আসে; জমিতে পাটুয়ারি না থাকলে রশিদে পাটুয়ারি ফাঁকা থাকে।

**পরিবর্তন (`IrrigationPaymentPanel.tsx`):**
- অফিস-স্কোপড পাটুয়ারি তালিকা লোড করব।
- নির্বাচিত ইনভয়েসগুলোর কোনো জমিতেই পাটুয়ারি না থাকলে একটি "পাটুয়ারি নির্বাচন করুন" ড্রপডাউন দেখাব (থাকলে অটো-ভরা মান দেখাবে, ঐচ্ছিকভাবে ওভাররাইড)।
- রশিদ জেনারেশনে `patwari_name`/`patwari_mobile` এর জন্য: আগে জমির পাটুয়ারি, না পেলে ম্যানুয়ালি নির্বাচিত পাটুয়ারি ব্যবহার হবে।

## Technical details
- Migration: `next_serial_receipt_no()` পুনর্লিখন (start+1 সেমান্টিক) + `admin_set_receipt_serial_start` গার্ড আপডেট + schema reload।
- `src/lib/receiptSerial.ts` / `src/pages/ReceiptTemplate.tsx`: সেভ ব্যর্থতা যাচাই ও পরিষ্কার feedback নিশ্চিত করা।
- `src/components/payments/IrrigationPaymentPanel.tsx`: patwari তালিকা state + conditional Select + রশিদ payload এ fallback।
- কোনো অন্য মডিউল ভাঙবে না; সিরিয়াল সব stream এ শেয়ার্ড থাকবে।

## Verification
- Admin এ start সেট → DB তে মান নিশ্চিত → নতুন irrigation পেমেন্ট → রশিদ নম্বর = start+1।
- পাটুয়ারিহীন জমির ইনভয়েসে পেমেন্ট → ম্যানুয়াল পাটুয়ারি সিলেক্ট → রশিদে সেই পাটুয়ারি।
- tsgo টাইপচেক পাস।
