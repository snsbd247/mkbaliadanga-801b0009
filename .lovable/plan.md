## লক্ষ্য

৪টি কাজ একসাথে: (১) সব page-এর mobile/tablet/desktop screenshot test, (২) overlap-পাওয়া page-এর PDF/Excel report export, (৩) কার্ড/টেবিলে লম্বা নাম/email/number এ truncate + tooltip, (৪) print preview overlap fix।

## ১. Automated responsive screenshot test

**Tool:** Playwright (project-এ already configured)। নতুন spec: `e2e/responsive-overlap.spec.ts`।

- Viewport: `375×812` (mobile), `768×1024` (tablet), `1440×900` (desktop)।
- Test login একবার (test admin user via env: `E2E_EMAIL`/`E2E_PASSWORD`), তারপর session reuse।
- Page list: কোডবেস scan করে route discover (`src/App.tsx` → `<Route>`), ৪০+ page।
- প্রতি (page × viewport) এ:
  - navigate, network-idle wait
  - JS দিয়ে overflow detect: প্রতিটি element-এর `scrollWidth > clientWidth` বা `getBoundingClientRect()` overlap check (sibling intersection in same flex/grid row)
  - screenshot save → `test-results/responsive/{page}-{viewport}.png`
  - overlap রিপোর্ট JSON-এ append: `{ page, viewport, issues:[{selector, kind}] }`
- চালানো: `npx playwright test e2e/responsive-overlap.spec.ts`।

**Auth blocker:** যদি `E2E_EMAIL` env না থাকে, test শুধু public route (`/auth`, `/verify-receipt`, `/farmer-portal/login`) screenshot করবে এবং report-এ blocker note লিখবে। User-কে env add করতে বলব।

## ২. Overlap report PDF/Excel export

`scripts/responsive-report.mjs`: test result JSON + screenshots নিয়ে—

- **PDF** (`pdf-lib` বা `reportlab` via python): summary table (page | viewport | issue count) + প্রতি issue-এ thumbnail।
- **XLSX** (`exceljs`/`openpyxl`): tab "Summary" + tab "Issues" with embedded screenshot link।
- Output: `/mnt/documents/responsive-overlap-report.pdf` + `.xlsx`।

User flow: `bun run e2e:responsive` → test → `node scripts/responsive-report.mjs` → report file।

## ৩. Truncate + tooltip component

নতুন component `src/components/ui/truncate-text.tsx`:

```tsx
<TruncateText className="max-w-[200px]">{longText}</TruncateText>
```

- CSS: `truncate` (single line) বা `line-clamp-2`
- Hover/focus → shadcn `<Tooltip>` দেখায় full text
- Mobile: tap to show
- Auto-detect overflow (scrollWidth > clientWidth) — overflow না থাকলে tooltip render-ই হবে না

**যেখানে apply করব** (high-impact spots):
- `FarmerDetail.tsx` — name, father, mother, NID, mobile cells
- `Farmers.tsx` table rows — name + mobile column
- `Payments.tsx` — farmer name + receipt no
- `Loans.tsx`, `Savings.tsx` — farmer column
- `AppLayout.tsx` header — user email (already truncated, add tooltip)
- `NotificationBell` — title

(বাকি page-গুলো auto fix করবে আগের `index.css` rule দিয়ে — শুধু high-traffic ৬–৭ জায়গায় explicit truncate+tooltip যোগ করব।)

## ৪. Print preview overlap fix

Print-ভিত্তিক page: `FarmerProfileReport`, `BulkCards`, `ReceiptTemplate`, `LoanReceiptSettings preview`, `Payments` receipt, `FarmerCard`, `Cashbook`, `Reports`, `FinancialReports`, `CollectionReport`, `ExpensesReport`, `IrrigationDueReport`।

`src/index.css`-এ `@media print` block-এ যোগ:

```css
@media print {
  .no-print { display: none !important; }
  body { background: white; }
  /* Page setup */
  @page { size: A4; margin: 12mm; }
  /* Prevent row/card cut across pages */
  tr, .print-keep { page-break-inside: avoid; }
  thead { display: table-header-group; } /* repeat header on each page */
  tfoot { display: table-footer-group; }
  /* Long-text wrap in print */
  td, th, .print-wrap { overflow-wrap: anywhere; word-break: break-word; }
  /* Hide overflow scroll bars in print */
  [data-table-wrap], .overflow-x-auto, .overflow-auto { overflow: visible !important; }
  /* Prevent fixed header overlap */
  header, .sticky { position: static !important; }
}
```

প্রতিটি print-page একবার screenshot test (Playwright `page.emulateMedia({ media: 'print' })`) → overlap check + report এ যোগ।

## Deliverable

- **নতুন:** `e2e/responsive-overlap.spec.ts`, `scripts/responsive-report.mjs`, `src/components/ui/truncate-text.tsx`
- **edit:** `src/index.css` (print block extend), `package.json` (script `e2e:responsive`), high-traffic ৬–৭ page truncate+tooltip integration
- **output:** `/mnt/documents/responsive-overlap-report.pdf` + `.xlsx`

## Technical notes / Limitations

- Test runner-এ login credentials দরকার (env বা auth-bypass)। না দিলে private route skip হবে।
- প্রথম run-এ ১০–১৫ মিনিট লাগবে (৪০ page × ৩ viewport)।
- "Overlap" detect heuristic — sibling bounding-box intersection + scrollWidth check; ১০০% accurate না, false positive হতে পারে। Report এ visual confirmation-এর জন্য screenshot থাকবে।
- Print CSS এর effect শুধু browser print preview-তে দেখা যাবে; PDF generation যেগুলো `pdfmake` দিয়ে হয় (যেমন bnReceipts) সেগুলোতে আলাদাভাবে এই rule apply হবে না।

## প্রশ্ন

প্ল্যান approve করলে শুরু করি — শুধু confirm করুন:

1. E2E test-এর জন্য admin login credential আছে কি (`E2E_EMAIL`/`E2E_PASSWORD` secret হিসেবে add করতে হবে)? না থাকলে শুধু public page test হবে।
2. Report format — PDF, XLSX, না দুটোই?
