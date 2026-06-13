## লক্ষ্য

দুইটা জিনিস ঠিক করা হবে, অন্য কোনো মডিউলে প্রভাব না ফেলে:

### ১. Transfer History-তে সম্পূর্ণ তথ্য সংরক্ষণ
এখন transfer history লাইভ `lands` রো থেকে দাগ/মৌজা/পরিমাণ টানে। জমি পরে বদলালে বা মুছলে পুরোনো হস্তান্তরের তথ্য হারিয়ে যায়/ভুল দেখায়। তাই হস্তান্তরের মুহূর্তের একটা snapshot সংরক্ষণ করব।

- `land_transfers` টেবিলে স্ন্যাপশট কলাম যোগ: `source_dag_no`, `source_mouza`, `source_land_size`, `source_owner_name`, `source_owner_code`।
- জমি হস্তান্তর তৈরির কোডে (যেখানে `land_transfers` insert হয়) এই snapshot ভ্যালু সেভ করা হবে।
- `LandTransferHistoryTab.tsx`-এ আগে snapshot দেখানো হবে; না থাকলে (পুরোনো রেকর্ড) লাইভ সম্পর্কিত জমি থেকে fallback — যাতে আগের সব তথ্য (কোন মালিক, কত জমি, কোন দাগ, কোন মৌজা) দেখা যায়।

### ২. এক জমি একাধিক দাগ + একাধিক বর্গাদার
বর্তমানে `land_relations` ইতিমধ্যেই প্রতি জমির জন্য একাধিক বর্গাদার (আলাদা `area_decimal` সহ) সমর্থন করে। মূলত প্রদর্শন উন্নত করা হবে যাতে একটা জমি/দাগে কে কে বর্গা করছে স্পষ্ট দেখা যায়।

- `LandRelations.tsx`-এ active সম্পর্কগুলো জমি/দাগ অনুযায়ী গ্রুপ করে দেখানো হবে: প্রতি জমির মোট পরিমাণ, মালিকের অবশিষ্ট অংশ, এবং প্রতিটি বর্গাদারের অংশ ও পরিমাণ একসাথে।
- একাধিক দাগ থাকলে (`dag_numbers` array) সেটাও দাগের তালিকায় দেখানো হবে।
- বিদ্যমান টেবিল ভিউ ও add-form অপরিবর্তিত থাকবে; শুধু একটা সারাংশ/গ্রুপড সেকশন যোগ হবে।

## টেকনিক্যাল বিবরণ

ডাটাবেজ মাইগ্রেশন:
```sql
ALTER TABLE public.land_transfers
  ADD COLUMN IF NOT EXISTS source_dag_no text,
  ADD COLUMN IF NOT EXISTS source_mouza text,
  ADD COLUMN IF NOT EXISTS source_land_size numeric,
  ADD COLUMN IF NOT EXISTS source_owner_name text,
  ADD COLUMN IF NOT EXISTS source_owner_code text;
```
নতুন কলাম; RLS/grant অপরিবর্তিত (existing policy যথেষ্ট)।

কোড পরিবর্তন:
- transfer insert স্থান (যেখানে `land_transfers` insert হয়) — snapshot ফিল্ড যোগ।
- `src/components/farmers/LandTransferHistoryTab.tsx` — snapshot-first রেন্ডার + fallback।
- `src/components/LandRelations.tsx` — দাগ/জমি অনুযায়ী গ্রুপড সারাংশ সেকশন।

পুরোনো রেকর্ডে snapshot null থাকলে আগের আচরণ (লাইভ join) বহাল থাকবে, তাই অন্য মডিউলে সমস্যা হবে না।</parameter>
<parameter name="summary">Snapshot land details into transfer history and improve multi-dag/multi-borgadar land relation display