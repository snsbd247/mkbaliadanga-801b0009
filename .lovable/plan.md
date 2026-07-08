## লক্ষ্য

সেচ চার্জ ও বিবিধ আদায় রশিদের “কৃষক এবং মালিক সভ্য সদস্য” ফিল্ডে কখনও Farmer ID / member_no / farmer_code দেখানো যাবে না। এখানে সবসময় Savings Number (`account_number`) দেখাবে।

## রুল

1. নিজ জমি হলে:
   - শুধু কৃষকের Savings Number দেখাবে।
   - উদাহরণ: `01711`

2. বর্গা জমি হলে:
   - প্রথমে বর্গাদার/চাষির Savings Number।
   - তারপর `/` দিয়ে জমির মালিকের Savings Number।
   - উদাহরণ: `01711/01925`

3. কারও Savings Number না থাকলে:
   - শুধু সেই অংশে `নাই` দেখাবে।
   - উদাহরণ: `01711/নাই`, `নাই/01925`, `নাই`

4. এই ফিল্ডে fallback হিসেবে `member_no`, `farmer_code`, Farmer ID, বা ৫-ডিজিট farmer code ব্যবহার করা হবে না।

## কী পরিবর্তন করব

### 1. Canonical helper ঠিক করা
`receiptMemberSummary`-এর Savings Number resolver আপডেট করব যাতে:
- `account_number` থাকলে সেটিই Savings Number হিসেবে নেয়।
- `account_number` না থাকলে `voter_number` fallback হিসেবে নিতে পারে, যদি এটি সঞ্চয় নম্বর হিসেবে ব্যবহৃত হয়।
- `member_no`/`farmer_code` fallback পুরোপুরি বাদ থাকবে।
- `is_voter` false হলেও `account_number` থাকলে সেটি দেখাবে, কারণ এখানে প্রয়োজন Savings Number, ভোটার স্ট্যাটাস নয়।
- `savings_inactive` true হলে `নাই` থাকবে।

### 2. সব রশিদ সোর্স একই helper ব্যবহার করছে কিনা নিশ্চিত করা
নিচের entry point-গুলোতে একই canonical logic থাকবে:
- Payment page receipt download/preview
- Farmer profile receipt download/preview
- Scan/verify/source যেখানে `fetchPaymentReceiptData` ব্যবহার হয়

### 3. Farmer profile legacy/manual receipt path-ও ঠিক করা
Farmer profile-এর পুরনো/manual সেচ receipt builder-এ owner/cultivator data fetch করার সময় `account_number`, `voter_number`, `savings_inactive`, `is_voter` আছে কিনা নিশ্চিত করব এবং `buildMemberSummary` দিয়েই row বানাব।

### 4. Automated tests যোগ/আপডেট করা
টেস্টে এই caseগুলো cover করব:
- নিজ জমি: cultivator `account_number = 01711`, `member_no/farmer_code = 02473` হলেও output হবে `01711`, `02473` নয়।
- বর্গা জমি: output হবে `বর্গাদারSavings/মালিকSavings`।
- owner/cultivator কারও Savings Number না থাকলে শুধু সেই অংশে `নাই`।
- canonical receipt data JSON-এ “পরিশোধকৃত টাকা” row না থাকার আগের rule বজায় থাকবে।

## যাচাই

- Targeted receipt tests চালিয়ে নিশ্চিত করব।
- কোডে search করে নিশ্চিত করব “কৃষক এবং মালিক সভ্য সদস্য” row আর farmer code/member_no fallback থেকে তৈরি হচ্ছে না।

Approve করলে আমি এই প্ল্যান অনুযায়ী ফিক্স করব।