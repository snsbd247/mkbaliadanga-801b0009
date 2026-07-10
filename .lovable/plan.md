# সেচ ক্যাশ↔ব্যাংক + ব্যাকআপ/রিস্টোর উন্নয়ন

Eight features, built in order. Group A = Sech cash↔bank (items 1–4), Group B = backup/restore (items 5–8). All changes stay additive so no existing module breaks.

## Group A — Sech cash ↔ bank

**1. One-click Sech deposit/withdraw from payment**
- On the irrigation payment surface (`IrrigationInvoices.tsx` / `Payments.tsx`), add a "সেচ নগদ ব্যাংকে জমা" button that opens a small confirm dialog (amount + target Sech bank account, pre-filled from the day's collected cash).
- On confirm, reuse the existing `saveTxn` + `postBankCashTransfer` path in `BankAccounts.tsx` — extract that logic into a shared helper `src/lib/sechBankTransfer.ts` so both pages call the same guarded flow (`assertSechTransfer`). No auto-post without confirmation.

**2. Excel export for Sech Cash & Bank Movements report**
- In `SechCashBankMovements.tsx` add an "Excel" button next to the PDF button, using `exportExcel` from `src/lib/exports.ts`.
- Same date-range filter, same rows, and the same four total lines (deposits, withdrawals, cash-in-hand, bank balance) appended as in `exportPdf`.

**3. Audit-trail filtering + printable export**
- Add filters to the Audit tab: date range (reuse `from`/`to`), office, user, and stream (dropdowns populated from loaded data).
- Add a "প্রিন্ট / PDF" export for the filtered audit rows via `exportTablePDF`.

**4. Improved journal view**
- Show a per-transfer Dr/Cr summary line (Dr Bank / Cr Cash or reverse) for each journal entry.
- Make each row link to its source: parse the `reference` (`BANK-CASH-<txnId>`) to jump to the related bank transaction / invoice payment.

## Group B — Backup / restore

**5. Post-restore verification**
- After a restore, call a new lightweight edge action that returns row counts per table (via `pg_tables_public_list` + `count`). Show a table in `Backup.tsx` comparing expected vs actual counts, flagging mismatches red.

**6. Automatic pre-restore snapshot**
- Before running a restore, `Backup.tsx` first calls `db-export` and downloads/stores the current full SQL as an auto-snapshot ("rollback point"), surfaced with a restore-this-snapshot action.

**7. Real-time restore progress + per-table logs**
- Split the restore payload table-by-table on the client, send each table's SQL sequentially to `db-restore`, and render a progress bar + per-table status log (ok / rows / error) so a failure shows exactly which table stopped.

**8. Scheduled full SQL backups**
- Add a `backup_schedules` settings row (frequency + retention) and a `scheduled-backup` edge function invoked by pg_cron; it runs `db-export`, stores the file, and prunes older-than-retention backups.

## Technical notes
- New files: `src/lib/sechBankTransfer.ts`, `supabase/functions/scheduled-backup/index.ts`; edits to `IrrigationInvoices.tsx`/`Payments.tsx`, `SechCashBankMovements.tsx`, `Backup.tsx`, `db-restore`, `db-export`.
- DB: one migration for `backup_schedules` (with GRANTs + RLS, developer-only) and a `table_row_counts()` RPC for verification; pg_cron scheduling inserted via the insert tool (contains project URL/anon key).
- Reuse existing `exports.ts`, `accountingPosting.ts`, `cashStreamGuard.ts`, `exec_sql_admin` — no rewrites of working logic.
