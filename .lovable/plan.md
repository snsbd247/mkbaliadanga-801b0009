## Phase C — Reports & Analytics

বর্তমান অবস্থা: Reports.tsx-এ ইতিমধ্যে অনেক tab আছে (Monthly Financial, Reconciliation, Irrigation, Arrears, Loan, Savings, Balances, Payments, Audit) এবং `src/pages/reports/` directory-তে 13+ specialized report রয়েছে। তাই Phase C কে নতুন core report বানানোর বদলে **gap-filling + analytics**-এ ফোকাস করব।

### C1 — Dashboard KPI widgets (1st step)
`src/pages/Dashboard.tsx`-এ নতুন KPI cards:
- আজকের সংগ্রহ (Irrigation + Savings + Loan repayment)
- চলতি মাসের মোট সংগ্রহ + গত মাসের তুলনা (%)
- মোট বকেয়া (Irrigation due + Loan outstanding)
- সক্রিয় সদস্য / নতুন সদস্য (এই মাস)
- চলমান ঋণ সংখ্যা + total disbursed
- ছোট sparkline chart (recharts) — last 30 days daily collection

### C2 — Member Statement PDF
`src/pages/FarmerStatement.tsx` থেকে A4 PDF export — Savings + Loans + Irrigation এক পেজে summary + transaction list, monthly receipt no সহ। Bilingual labels।

### C3 — Monthly Receipt Register report
নতুন report tab: type অনুযায়ী মাসিক receipt list (SAV/LOAN/IRR/COMBO) — receipt no, date, farmer, amount, collector — duplicate/gap detection সহ। CSV + PDF export।

### C4 — Collection Officer summary
কোন collector কত আদায় করেছে — date range filter, type-wise breakdown, top performer ranking।

### Technical notes
- নতুন DB migration লাগবে না — সব existing tables (`payments`, `savings_transactions`, `loan_payments`, `irrigation_invoices`, `receipt_sequences`) থেকে aggregate।
- Charts: existing `recharts` package use করব।
- Export: existing `exportTablePDF`, `exportExcel` (src/lib/exports.ts) reuse।
- Bilingual: `src/i18n/translations.ts`-এ key যোগ।
- Permission: existing `reports` ModuleKey।

### Order of execution
C1 → C2 → C3 → C4 — প্রতি step alada turn-এ ship হবে, "next" বললে পরেরটা।

প্রথমে **C1 (Dashboard KPI widgets)** শুরু করব। অনুমোদন দিলে এগোই।
