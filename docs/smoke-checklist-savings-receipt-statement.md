# Smoke Regression Checklist — Savings / Receipt / Statement

Use after any change in Savings, Receipt, Statement, Combined Payment, or
Irrigation invoice/payment code paths. Target time: **~5 minutes**.

Legend: ✅ pass · ⚠️ minor · ❌ blocker

---

## 0. Pre-checks
- [ ] App boots without console errors at `/dashboard`.
- [ ] Active office is set in header (no "No office" banner).
- [ ] Language toggle (EN ⇄ BN) works without re-login.

## 1. Savings module (`/savings`)
- [ ] List loads, search by name/code works.
- [ ] **Deposit**: create new deposit → toast success → row appears at top.
- [ ] **Withdrawal**: balance check prevents over-withdraw.
- [ ] Receipt no follows `SAV-YYYY-MM-####` (or office-configured prefix).
- [ ] Approve / Reject pending entries reflects in list immediately.
- [ ] Delete (RBAC permitted) requires confirm and soft-deletes.

## 2. Receipt system
- [ ] Single-entry receipt PDF prints with company brand + Bengali fonts intact.
- [ ] **QR code** present and links to `https://<host>/r/<token>` or `/verify/<token>`.
- [ ] Scan QR on phone → public verify page shows: receipt no, date, type, status, amount, masked mobile.
- [ ] Voided/cancelled receipt → verify page shows red "voided" banner.
- [ ] Reprint last receipt button (Payments page) opens the last record's print menu.
- [ ] Combined receipt (`/combined-payment`) renders all 3 lines + grand total.

## 3. Statement module (`/farmer-statement`)
- [ ] Select farmer → savings/loan/irrigation tabs all load without RLS error.
- [ ] **Irrigation carry-forward**: pick a `From` date after some past invoices → top row shows "Opening due (carry-forward)" with non-zero balance.
- [ ] Date range filter works for all 3 kinds.
- [ ] PDF export — Bengali characters render correctly (no boxes).
- [ ] Excel export opens in Excel/LibreOffice with proper columns.
- [ ] **Full Statement PDF** (Savings + Loans + Irrigation) generates and is non-empty.
- [ ] Member-wise health card shows Savings balance, Loan due, Irrigation due, Land area.

## 4. Combined Payment (`/combined-payment`)
- [ ] Select farmer → outstanding loans populate dropdown.
- [ ] Enter loan repayment > remaining → red helper text + Save button disabled.
- [ ] Negative amount → toast error.
- [ ] On Save: same receipt no across savings/share/loan lines.
- [ ] After save → Savings list, Loans detail, Payments list, and Farmer Statement all reflect the new entry **without manual refresh** (cache invalidation).
- [ ] "Print Receipt" works on small + A4 paper sizes.

## 5. Irrigation interactions (cross-module)
- [ ] New irrigation payment → Farmer Statement irrigation tab updates immediately.
- [ ] Carry-forward opening + new invoices sum equals current irrigation due on dashboard.
- [ ] Category report (`/reports/irrigation-category`) totals match invoice payments table for the date range.

## 6. RBAC / multi-office isolation
- [ ] User from Office A cannot see Office B farmers in any statement/receipt.
- [ ] Read-only role cannot save in Combined Payment (button hidden or disabled).

## 7. Regression smoke (other modules — must NOT break)
- [ ] Farmers list opens, edit dialog saves.
- [ ] Loans `/loans` issue-loan dialog opens; FormErrorSummary shows on empty submit.
- [ ] Irrigation invoices list + bulk generate dialog opens.
- [ ] Reports menu opens all newly added reports without 404.
- [ ] Dashboard widgets render (no NaN, no infinite spinner).

---

### Sign-off
Tester: _____________   Date: __________   Result: ✅ / ❌

Attach screenshots for any ⚠️ or ❌ in `docs/smoke-runs/YYYY-MM-DD.md`.
