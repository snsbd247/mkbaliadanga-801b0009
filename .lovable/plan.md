## Enterprise Asset Lifecycle & Inventory Management System

A complete, bilingual (BN/EN), backward-compatible Asset module integrated with the existing accounting, audit, and permission systems. Implementation will be phased to keep each step shippable and verifiable.

---

### Phase 1 — Foundation (DB + Permissions + i18n)

**Database (single safe migration, all new tables, no changes to existing tables):**
- `asset_categories` (office_id, name_bn, name_en, code, tracking_mode, is_active, soft delete)
- `assets` (registry — office_id, category_id, asset_code, serial_no, name_bn/en, tracking_mode, purchase_price, current_status, current_location_id, installed_at, soft delete)
- `asset_stocks` (office_id, asset_id, location_id, quantity)
- `asset_purchases` (links to accounting journal entry id)
- `asset_movements` (from/to location, qty, moved_by, remarks)
- `asset_installations` (location, install_date, condition, installed_by)
- `asset_maintenance_logs` (vendor, cost, downtime, status)
- `asset_damage_reports` (severity, reported_by, status)
- `asset_disposals` (method: scrap_sale/write_off, sale_amount, journal_entry_id)
- `asset_audit_logs` (action_type, old_data, new_data jsonb)

**Status enum:** `purchased | in_stock | transferred | installed | maintenance | damaged | disposed`
**Tracking mode enum:** `quantity | serial`

**RLS:** office-scoped SELECT/INSERT/UPDATE for staff via `has_role` + `office_id`; super_admin full access. Soft delete via `deleted_at`. All FKs nullable where they touch existing tables to preserve isolation.

**Permissions:** add `assets` module to permission matrix with `can_view / can_add / can_edit / can_delete` — without altering existing module rows.

**i18n:** add `assets.*` namespace to `src/i18n/translations.ts` with Bengali-first labels for every page title, button, form field, validation, status, and report header.

---

### Phase 2 — Master Data UI
- `/assets/categories` — CRUD with search, filter, activate/deactivate, soft delete
- `/assets/items` — Asset registry with full Details Page (`/assets/items/:id`) showing tabs: Purchase, Stock, Movement, Installation, Maintenance, Disposal, Accounting Impact, Audit

### Phase 3 — Operations
- `/assets/purchase` — purchase entry → creates `asset_purchases` + journal entry (Dr Asset / Cr Cash|AP) via existing accounting helpers, idempotent
- `/assets/stock` — live stock view with stock-in/out/transfer/adjustment
- `/assets/movement` — movement form + Details Page
- `/assets/installation` — install entry + Details Page
- `/assets/maintenance` — maintenance log + Details Page
- `/assets/damage` — damage report
- `/assets/disposal` — disposal flow → journal entry (Dr Cash / Cr Disposal Income, P/L calc) + receipt

All write operations: transactional, write to `asset_audit_logs`, update `assets.current_status` via DB trigger.

### Phase 4 — Dashboard, Reports & Audit
- `/assets/dashboard` — counts by status, low-stock alerts, recent movements (cached query)
- `/assets/reports/*` — Register, Stock, Movement, Installation, Maintenance, Damage, Disposal, Valuation, Audit — all with filters (office, category, status, location, date range) and CSV/Excel/PDF export
- `/assets/audit` — full audit log viewer

### Phase 5 — Sidebar, Demo, Tests
- Add "Assets / এসেট" group to `AppSidebar` (gated by `assets` permission)
- Demo seed for categories, assets, stock, movements, installations, maintenance, disposals; demo-reset edge function extension
- Unit tests (stock math, disposal P/L, audit shape), integration tests (purchase→journal, disposal→journal), Playwright E2E (movement flow, maintenance, disposal, bilingual smoke)
- Regression check: run existing irrigation, accounting, receipt, QR, export tests unchanged

---

### Backward-Compatibility Guarantees
- **No edits** to existing tables, RLS policies, journal posting helpers, or dashboard queries — only additive
- New journal entries reuse existing `journal_entries` API with a distinct `source_module='assets'` tag so existing reports filter naturally
- New sidebar items only appear with the new `assets` permission (default off)
- All migrations additive, nullable, reversible

### Technical Details
- Tables in `public` schema; FK to `offices`, `locations`, `auth.users` (no FK to `auth.users` from data tables — store uuid only per project rule)
- Triggers: `assets_set_status_trg` (auto-update current_status on movement/install/maintenance/disposal), `assets_audit_trg` (write to `asset_audit_logs` on any change)
- Stock indexes: `(office_id, asset_id, location_id)`, `(asset_id, created_at desc)` on movements
- Accounting: extend existing `postJournalEntry()` call sites only — no new posting engine
- Bilingual: every new string flows through `t()`; no hard-coded labels; status/action enums mapped via `assets.status.*` / `assets.action.*` keys

### Phasing Strategy
Phase 1 ships first (DB + permissions + i18n scaffolding) so you can review schema and RLS before any UI. Each subsequent phase is a separate user-approved batch to keep diffs reviewable and the app green.

---

**Confirm to proceed with Phase 1 (migration + permissions + i18n keys), or tell me to adjust scope/order.**