# A4 দুই-কপি সেচ রশিদ — সব জায়গায় একরকম

## লক্ষ্য
সেচ চার্জ ও বিবিধ আদায় রশিদ **সব জায়গা থেকে** (Receipts পেজ, Payments পেজ, IrrigationPaymentPanel, FarmerDetail, ScanPayment) ডাউনলোড করলে সবসময় **একটি A4 পোর্ট্রেট পেজ** আসবে — যার উপরের অর্ধেক "অফিস কপি" ও নিচের অর্ধেক "কৃষক কপি"। মাঝ বরাবর কেটে দুই কপি ব্যবহার করা যাবে। আলাদা A5 কপি, "both/farmer/office" মেনু আর থাকবে না।

## বর্তমান অবস্থা
- `renderPdf` (bnReceipts.ts) ইতিমধ্যে irrigation রশিদকে A4 দুই-ভাগে রেন্ডার করে ও "অফিস কপি"/"কৃষক কপি" লেবেল + কাটার ড্যাশড লাইন বসায়।
- কিন্তু এটি **একই কপির ছবি দুইবার** বসায় (উপরে-নিচে হুবহু এক), সত্যিকারের অফিস/কৃষক আলাদা কনটেন্ট নয়।
- Receipts ও Payments পেজে এখনও `ReceiptCopyMenu` (both/farmer/office) দেখায় ও `copy="farmer"` পাঠায়।

## পরিবর্তন

### ১. `src/lib/bnReceipts.ts` — সত্যিকারের দুই-কপি রেন্ডার
- `renderPdf`-এ irrigationTwoUp হলে দুইটি ক্যানভাস তৈরি হবে: একটি `copy="office"`, একটি `copy="farmer"`।
- উপরের অর্ধে অফিস কপির ছবি, নিচের অর্ধে কৃষক কপির ছবি বসবে (লেবেল ও কাটার লাইন আগের মতোই)।
- `copy` প্যারামিটার irrigationTwoUp-এ উপেক্ষিত হবে (সবসময় দুই কপি)।

### ২. Receipts ও Payments পেজ — মেনু সরানো
- `src/pages/Receipts.tsx` ও `src/pages/Payments.tsx`: irrigation রশিদের জন্য `ReceiptCopyMenu` (both/farmer/office) বাদ, শুধু একটি "ডাউনলোড / প্রিন্ট" বাটন যা সরাসরি A4 দুই-কপি নামাবে।
- non-irrigation রশিদে আগের আচরণ অপরিবর্তিত।
- `IrrigationPaymentPanel.tsx` ও `ScanPayment.tsx`-এর ডাউনলোড কলগুলো একই A4 দুই-কপি পথে যাবে (কোনো `copy` নির্ভরতা নয়)।

### ৩. প্রিভিউ সামঞ্জস্য
- `IrrigationReceiptPreviewDialog` প্রিভিউ ও ডাউনলোড একই A4 দুই-কপি আউটপুট দেখাবে যাতে প্রিভিউ = প্রিন্ট।

### ৪. টেস্ট
- `bnReceipts`/receiptFlow টেস্টে দুই ভিন্ন কপি রেন্ডার + A4 পোর্ট্রেট নিশ্চিত করার কেস যোগ/হালনাগাদ।

## প্রভাবিত ফাইল
- `src/lib/bnReceipts.ts`
- `src/pages/Receipts.tsx`
- `src/pages/Payments.tsx`
- `src/components/payments/IrrigationPaymentPanel.tsx`
- `src/pages/ScanPayment.tsx`
- `src/components/receipts/IrrigationReceiptPreviewDialog.tsx`
- সংশ্লিষ্ট টেস্ট ফাইল

কোনো ব্যবসায়িক হিসাব/ডেটা পরিবর্তন নেই — শুধু রশিদ আউটপুট ফরম্যাট।