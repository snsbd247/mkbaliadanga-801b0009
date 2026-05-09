## লক্ষ্য

বর্তমানে **Seasons** তৈরির সময় season type হার্ডকোড enum (`aman`, `boro`, `iri`, `other`)। আর **irrigation_rates** এ পুরো সিজনের জন্য মাত্র একটা flat `base_rate` — জমির ধরন (high/medium/low/পুকুর/ডোবা) আলাদা করে রেট বসানো যায় না।

আপনি চান:
1. Admin panel থেকে season type list নিজের মতো করে তৈরি/সম্পাদনা — বোরো, আমন, ইরি, পুকুর, ডোবা ইত্যাদি।
2. সিজন তৈরির সময় ওই dynamic list থেকে type বাছাই।
3. প্রতিটি সিজনের জন্য **জমির ধরন অনুযায়ী** শতক প্রতি রেট সেট করা — যেমন বোরো-২০২৬ এ high_land=১৫, medium_land=১২, low_land=১০, পুকুর=২০।
4. ইনভয়েস তৈরির সময় land.field_type দেখে ওই matrix থেকে রেট auto-pickup হবে।

## পরিবর্তন

### 1. Database (migration)

- নতুন lookup table **`season_types`**: `code` (slug), `name`, `name_bn`, `is_active`, `sort_order`, `office_id` (nullable = global)
- নতুন lookup table **`field_types`**: একই pattern — যাতে পুকুর/ডোবা ইত্যাদি field_type ও admin add করতে পারেন
- Seed করা: বর্তমান enum values (`boro`, `aman`, `iri`, `other`) + (`high_land`, `medium_land`, `low_land`, `other`)
- `seasons` এ `season_type_id` (nullable, fk → season_types) যোগ। পুরোনো `type` enum কলাম রাখা হবে backward compat-এর জন্য — নতুন রো লিখলে দুটোই fill হবে যদি match করে
- নতুন table **`season_field_rates`**: `(season_id, field_type_code, rate_per_shotok, office_id)` — composite unique `(season_id, field_type_code, office_id)`
- RLS: office_read + admin_manage (existing pattern অনুসরণ করে)

### 2. Admin UI

- নতুন route **`/admin/season-types`**: `code`, `নাম`, `বাংলা নাম`, `সক্রিয়` — CRUD
- নতুন route **`/admin/field-types`**: একই pattern
- Sidebar এর Admin section এ দুটো entry যোগ

### 3. Seasons page (`src/pages/Seasons.tsx`)

- Type dropdown হার্ডকোড enum-এর বদলে `season_types` থেকে লোড
- Save করার সময় `season_type_id` সেট, সাথে `type` enum-এ map করতে চেষ্টা করবে (custom হলে `other`)
- প্রতিটি সিজনের রো-তে নতুন button **"রেট সেট করুন"** → একটা dialog খুলবে যেখানে field_types এর প্রতিটি row-এর পাশে rate input থাকবে। Save করলে `season_field_rates` upsert হবে।

### 4. Invoice generation

- `IrrigationInvoices.tsx > GenerateTab`:
  - একক `rate` input তুলে দেওয়া হবে (অথবা override হিসেবে রাখা হবে)
  - সিজন বাছাইয়ের পর `season_field_rates` লোড → preview generation এ প্রতিটি land-এর `field_type` দেখে rate map থেকে বের করবে
  - রেট খুঁজে না পেলে warning দেখাবে এবং ওই land skip করবে (count আলাদা দেখাবে)
- Manual dialog এও field_type অনুযায়ী auto-rate, কিন্তু override input থাকবে

### 5. টেস্ট

- `irrigationInvoice.extra.test.ts` এ rate matrix lookup helper-এর test যোগ
- `IrrigationRates.test.tsx` legacy — কেবল pass হলেই হবে; নতুন tab আলাদা টেস্ট পরে

### Out of scope (এই step-এ নয়)

- পুরোনো `irrigation_rates` table delete নয় — কেবল legacy fallback হিসেবে থাকবে
- enum `season_type` / `field_type` থেকে কলাম drop করা হবে না — runtime backward compat রক্ষা

## টেকনিক্যাল ডিটেইল

```text
season_types (id, code unique, name, name_bn, is_active, sort_order, office_id)
field_types  (id, code unique, name, name_bn, is_active, sort_order, office_id)
season_field_rates (id, season_id fk, field_type_code text, rate_per_shotok numeric,
                    office_id, created_by, created_at, updated_at,
                    UNIQUE(season_id, field_type_code, office_id))
seasons + season_type_id uuid REFERENCES season_types(id)
```

Invoice rate resolution order:
1. `season_field_rates` লুকআপ by `(season_id, land.field_type, office_id)` → fallback office_id NULL
2. না পেলে legacy `irrigation_rates.base_rate` (per_size, active)
3. না পেলে user-entered override
