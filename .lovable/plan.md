# সমস্যা (Root Cause)

দুইটা আলাদা সিস্টেম আছে, যেগুলো একে অপরের সাথে যুক্ত নয়:

1. **Land Types ক্যাটালগ** — Irrigation Settings এ যে জমির ধরন (Land type) যোগ করা হয়, সেগুলো `land_types` টেবিলে যায় (ম্যানেজ হয় `src/pages/admin/Lookups.tsx` এ)। এগুলো শুধু **সিজন রেট** (`Seasons.tsx`) আর **ইনভয়েসিং** (`IrrigationInvoices.tsx`) এ ব্যবহার হয়।

2. **জমি এড/এডিট ফর্ম** (`src/pages/FarmerDetail.tsx`) — এখানে জমির ধরন বাছাই হয় একটা **হার্ডকোড করা ৩-অপশনের তালিকা** দিয়ে (`high_land` / `medium_land` / `low_land`), যা `lands.field_type` কলামে সেভ হয়।

ফলে: Irrigation Settings এ নতুন Land type যোগ করলেও জমি এড করার সময় সেটা আসে না — কারণ ফর্মটা `land_types` টেবিল পড়ে না, হার্ডকোড লিস্ট দেখায়।

```text
Irrigation Settings → land_types টেবিল ─┬─→ Season Rates ✅
                                        └─→ Invoicing ✅
                                        └─→ জমি এড ফর্ম ❌ (যুক্ত নেই)

জমি এড ফর্ম → হার্ডকোড field_type এনাম → lands.field_type
```

# ল্যান্ড টাইপ কোথায় কোথায় আছে

| জায়গা | ফাইল | কী ব্যবহার করে |
|---|---|---|
| Land type ম্যানেজ (যোগ/এডিট) | `src/pages/admin/Lookups.tsx` | `land_types` টেবিল |
| সিজন রেট সেটআপ | `src/pages/Seasons.tsx` | `land_types` টেবিল ✅ |
| ইনভয়েস জেনারেশন | `src/pages/IrrigationInvoices.tsx` | `land_type_id` + ফলব্যাক `field_type` ✅ |
| রেট রেজল্যুশন | `src/lib/seasonRates.ts` | আগে `land_type_id`, পরে `field_type` এনাম ✅ |
| **জমি এড ডায়ালগ** | `src/pages/FarmerDetail.tsx` (≈1259-1264) | হার্ডকোড এনাম ❌ |
| **জমি এডিট ডায়ালগ** | `src/pages/FarmerDetail.tsx` (≈1958-1963) | হার্ডকোড এনাম ❌ |
| বাল্ক ইমপোর্ট | `DataImport.tsx`, `importTemplates.ts` | `field_type` এনাম |
| রিপোর্ট/এক্সপোর্ট | `FarmerProfileReport.tsx`, `landExport.ts`, `exports.ts` | `field_type` লেবেল |

`lands` টেবিলে দুইটা কলামই আছে: `land_type_id` (FK → `land_types`, nullable) আর `field_type` (পুরোনো এনাম)।

# সমাধান পরিকল্পনা

লক্ষ্য: জমি এড/এডিট ফর্মে হার্ডকোড লিস্টের বদলে `land_types` ক্যাটালগ থেকে ডাইনামিক ড্রপডাউন দেখানো — কোনো মডিউল না ভেঙে।

### ধাপ ১ — রিইউজেবল `LandTypeSelect` কম্পোনেন্ট
- নতুন ফাইল `src/components/locations/LandTypeSelect.tsx`।
- `land_types` থেকে active (non-deleted) টাইপ লোড করবে, `sort_order` অনুযায়ী।
- value = `land_type_id` (string), লেবেল = `name_bn || name`।
- পুরোনো ডেটার জন্য fallback: যদি বর্তমান value তালিকায় না থাকে তাও দেখাবে (MouzaSelect-এর মতো প্যাটার্ন)।

### ধাপ ২ — জমি এড/এডিট ফর্ম আপডেট (`FarmerDetail.tsx`)
- এড ডায়ালগ (≈1259) ও এডিট ডায়ালগ (≈1958) এর হার্ডকোড `Select` সরিয়ে `LandTypeSelect` বসানো।
- `EMPTY_LAND` ও ফর্ম স্টেটে `land_type_id` যোগ করা।
- ইনসার্ট/আপডেটে `land_type_id` সেভ করা।
- **ব্যাকওয়ার্ড কম্প্যাট:** নির্বাচিত land type এর সাথে যদি একটা মানানসই এনাম থাকে, `field_type` ও পূরণ রাখা হবে (যাতে পুরোনো রিপোর্ট/ইনভয়েস ফলব্যাক না ভাঙে)। না মিললে `field_type` আগের ডিফল্ট থাকবে।

### ধাপ ৩ — প্রদর্শন আপডেট
- জমির লিস্ট/টেবিলে (`FarmerDetail.tsx` ≈1430) আগে `land_type_id` এর নাম দেখাবে, না থাকলে পুরোনো `field_type` লেবেল।

### ধাপ ৪ — যাচাই (কোনো মডিউল না ভাঙা নিশ্চিত করা)
- Borgadar auto-fill লজিক (≈1174) — `land_type_id` ও কপি হবে তা নিশ্চিত করা।
- টাইপচেক + বিল্ড।
- ইনভয়েসিং/রেট ফলব্যাক অপরিবর্তিত থাকছে যাচাই (seasonRates আগে থেকেই `land_type_id` সাপোর্ট করে)।

# যা বদলাবে না
- Bulk import টেমপ্লেট (`field_type`) — আলাদা টাস্ক, এই কাজে হাত দেব না।
- `land_types` ম্যানেজমেন্ট স্ক্রিন, সিজন রেট, ইনভয়েসিং লজিক — অপরিবর্তিত।
- পুরোনো `field_type` কলাম রাখা হবে (fallback এর জন্য), মুছব না।

অনুমোদন দিলে কাজ শুরু করব।