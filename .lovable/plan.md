# জমি ও পুরনো বকেয়া ইমপোর্ট প্ল্যান

ফার্মার ইমপোর্ট শেষ। এখন দুটি আলাদা জিনিস ইমপোর্ট করতে হবে — (১) জমি (নিজের চাষ + বর্গা) এবং (২) আগের সিজনের বকেয়া (opening due)। দুটোর জন্য আলাদা টেমপ্লেট ও আলাদা পেজ থাকবে যাতে গোলমাল না হয়।

## ১. জমি ইমপোর্ট (Lands Import)

নতুন পেজ `/lands/import` — একটাই Excel/CSV টেমপ্লেট, দুই ধরনের জমি একসাথে।

**টেমপ্লেট কলাম:**
```text
owner_farmer_id   (মালিকের farmer_id / account_number — required)
mouza             (মৌজা নাম বা mouza_id)
dag_no            (একাধিক হলে কমা দিয়ে: 12,15,30)
land_type         (আমন২৬ / ইরি২৬ ইত্যাদি — code বা নাম)
field_type        (উচু / নিচু / মাঝারি — ধান হলে)
land_size         (শতক, . এর পর ৪ ডিজিট পর্যন্ত)
owner_type        (own = নিজে চাষ / borga = বর্গা)
sharecropper_id   (borga হলে বর্গাদারের farmer_id — own হলে খালি)
borga_area        (borga হলে বর্গাদারকে দেয়া শতক; খালি হলে share_percentage)
share_percentage  (borga হলে শতাংশ, যেমন 50)
note
```

**প্রসেসিং লজিক:**
- প্রতিটি সারিতে একটি `lands` রেকর্ড তৈরি হবে (owner = owner_farmer_id, land_size, mouza, dag_numbers ইত্যাদি)।
- `owner_type = borga` হলে অতিরিক্তভাবে একটি `land_relations` রেকর্ড তৈরি হবে (owner + sharecropper + borga_area/share_percentage)। বাকি জমি (remaining) স্বয়ংক্রিয়ভাবে মালিকের billable থাকে — বিদ্যমান `splitBillableArea` লজিক অনুযায়ী।
- একই জমি একাধিক বর্গাদারে ভাগ থাকলে একই dag/mouza-তে একাধিক borga সারি দেওয়া যাবে (একই land-এর সাথে map করার জন্য একটি ঐচ্ছিক `land_ref` key ব্যবহার করব)।

**ভ্যালিডেশন (insert-এর আগে):**
- owner_farmer_id ডাটাবেজে আছে কিনা।
- borga হলে sharecropper_id আছে কিনা ও owner ≠ sharecropper।
- borga_area ≤ land_size; একাধিক borga-র যোগফল ≤ land_size (overlap চেক — বিদ্যমান `validateNoOverlappingBorga`)।
- land_type / mouza resolve হয় কিনা (না হলে পরিষ্কার বাংলা error)।
- প্রিভিউ টেবিলে valid/invalid রঙ + এরর মেসেজ, তারপর "Import" বাটন।

## ২. পুরনো বকেয়া ইমপোর্ট (Opening Due Import)

আগের সিজনের বকেয়া + তার জরিমানা — এটি জমির সাথে নয়, **প্রতি farmer (বা প্রতি জমি) প্রতি opening balance** হিসেবে আসবে। রশিদে "বকেয়া" ও "জরিমানা" আলাদা দেখাতে হয়, তাই আলাদা ফিল্ডে রাখব।

নতুন পেজ `/irrigation/opening-due/import`।

**টেমপ্লেট কলাম:**
```text
farmer_id          (required)
season             (কোন সিজনের বকেয়া — যেমন "আমন ২০২৫")
previous_due       (আগের সিজনের অপরিশোধিত জমির চার্জ)
previous_penalty   (ঐ বকেয়ার জরিমানা)
as_of_date         (বকেয়া হিসাবের তারিখ)
note
```

**সংরক্ষণ:** প্রতিটি সারি একটি carry-forward এন্ট্রি হিসেবে যাবে — চলতি সিজনের ইনভয়েস হিসাব করার সময় এই opening due + penalty যোগ হবে ("হাল = চলতি চার্জ + জরিমানা + আগের বকেয়া + আগের জরিমানা")।

**দুটি অপশন (আপনি বেছে দেবেন):**
- **(ক)** বিদ্যমান `irrigation_invoices`-এ আগের সিজনের একটি invoice তৈরি করে `due` সেট করা — তাহলে স্বাভাবিক due ট্র্যাকিং/পেমেন্ট ফ্লোতেই চলে আসবে।
- **(খ)** আলাদা `irrigation_opening_dues` টেবিল — কেবল রেফারেন্স/carry-forward হিসেবে, চলতি ইনভয়েসে যোগ হবে।

## যা নিশ্চিত করব
- দুটো ইমপোর্টই idempotent: farmer_id + season দিয়ে duplicate চেক, পুনরায় চালালে UPDATE হবে।
- import_audit_logs-এ কে কখন কতগুলো রেকর্ড ইমপোর্ট করল তা রেকর্ড।
- কোনো module না ভেঙে — বিদ্যমান barga split ও invoice ক্যালকুলেশন reuse করব।

## আপনার সিদ্ধান্ত দরকার
1. জমি ও বকেয়া — একসাথে এক ফাইলে নাকি দুই আলাদা ফাইলে? (আমি দুই আলাদা সুপারিশ করছি)
2. পুরনো বকেয়া — প্রতি **farmer** এক লাইনে, নাকি প্রতি **জমি/দাগ** আলাদা লাইনে?
3. বকেয়া সংরক্ষণ — উপরের **(ক)** না **(খ)**?
4. একই জমিতে একাধিক বর্গাদার map করতে `land_ref` key পদ্ধতি ঠিক আছে কিনা।
