# ইনভয়েস ডিলিট/আনপেইড করলে পেমেন্টও রিমুভ

## সমস্যা
বর্তমানে:
- **ইনভয়েস ডিলিট** (`deleteInvoice`) করলে শুধু ইনভয়েসটাই soft-delete হয় (`deleted_at`)। ওই ইনভয়েসের বিপরীতে রিসিভ করা পেমেন্ট (`payments` টেবিলের রসিদ) থেকে যায়।
- **আনপেইড করা** (`markUnpaid`) করলে শুধু `irrigation_invoice_payments` লিংক টেবিলের সারি মুছে যায়, কিন্তু আসল পেমেন্ট রসিদ (`payments`) ও তার বরাদ্দ (`payment_allocations`) থেকে যায় — ফলে রসিদ তালিকায় এখনো দেখা যায়।

## লক্ষ্য
কোনো ইনভয়েস ডিলিট করলে বা এডিট করে আনপেইড করলে, ওই ইনভয়েসের বিপরীতে রিসিভ করা পেমেন্টগুলোও রিমুভ হবে (void হবে, যাতে অডিট ট্রেইল থাকে)।

## পরিবর্তনসমূহ (শুধু ফ্রন্টএন্ড)

### ১. নতুন শেয়ারড হেল্পার — `src/lib/voidInvoicePayments.ts`
একটি ফাংশন `voidPaymentsForInvoice(invoiceId, { actorId, reason })` যা:
1. `irrigation_invoice_payments` থেকে `payment_id`-গুলো বের করে + `payment_allocations` (kind='irrigation', reference_id=invoiceId) থেকেও `payment_id` সংগ্রহ করে।
2. প্রতিটি সংশ্লিষ্ট `payments` রসিদকে void করে (`status='voided'`, `voided_at`, `void_reason`) — hard delete নয়, যাতে রসিদ ইতিহাসে থাকে।
3. `irrigation_invoice_payments` লিংক সারিগুলো মুছে দেয়।
4. প্রতিটি void-এর জন্য `audit_logs`-এ এন্ট্রি রাখে।

> নোট: savings ইত্যাদি মিশ্র বরাদ্দ থাকলে বর্তমান void যুক্তির মতোই শুধু irrigation অংশ রিভার্স করা হবে; সম্পূর্ণ রসিদ void হবে (বিদ্যমান `voidPayment` আচরণের সাথে সামঞ্জস্যপূর্ণ)।

### ২. `deleteInvoice` (IrrigationInvoices.tsx, ~line 300)
- confirm ডায়ালগের বার্তায় জানানো হবে যে সংশ্লিষ্ট পেমেন্টও রিমুভ হবে।
- ইনভয়েস soft-delete করার **আগে** `voidPaymentsForInvoice(inv.id)` কল করা হবে।
- toast: "ইনভয়েস ও সংশ্লিষ্ট পেমেন্ট মুছে ফেলা হয়েছে"।

### ৩. `markUnpaid` (IrrigationInvoices.tsx, ~line 1099)
- বর্তমান `irrigation_invoice_payments.delete()` এর জায়গায় `voidPaymentsForInvoice(inv.id)` ব্যবহার করা হবে — যাতে আসল রসিদও void হয়।
- এরপর আগের মতোই ইনভয়েস `paid_amount=0`, `due_amount=payable`, `invoice_status='generated'` করা হবে।

## যাচাই
- বিদ্যমান e2e (`payment-edit-permission`, `irrigation-payment-*`) চালিয়ে দেখা।
- একটি নতুন সংক্ষিপ্ত পরীক্ষা: ইনভয়েসে পেমেন্ট → ডিলিট → রসিদ তালিকায় ওই পেমেন্ট আর দেখায় না ও void হিসেবে চিহ্নিত।
- `tsgo --noEmit` টাইপচেক।

অনুমোদন দিলে বাস্তবায়ন শুরু করব।