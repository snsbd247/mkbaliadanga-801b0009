# i18n Hardcoded Strings — Updated Audit

> Auto-generated from `node scripts/i18n-scan.mjs`. Re-run after edits to update.
> Total findings: **258** strings across project (snapshot).

## How to use this list

- Each entry maps a hardcoded string to its file + line.
- Replace literal text with `t("translationKey")` from `useLang()`.
- Add the new key to **both** `en` and `bn` blocks in `src/i18n/translations.ts`.
- Use a phase prefix when adding new keys (current: `p5d_`).
- Re-run scanner: `node scripts/i18n-scan.mjs`.

## Priority modules (user-visible)

### High priority
- `src/pages/Profile.tsx` — uses local `tr()` shim, not the global `t()`. Migrate all `tr("EN","BN")` calls to translation keys.
- `src/pages/FarmerProfileReport.tsx` — printable report, mixes Bangla (heading) + English labels. Needs full bilingual section labels.
- `src/pages/CardDesigner.tsx` — admin card designer; many hardcoded English form labels.
- `src/pages/BulkCards.tsx` — admin bulk card export; English-only labels.
- `src/pages/DataImport.tsx` — admin data import strings.
- `src/pages/LandDetail.tsx` — public detail page labels.
- `src/pages/FarmerDetail.tsx` — Bangla note text in receipts.
- `src/pages/Payments.tsx` — Bangla note text for receipts.

### Medium priority
- `src/pages/Farmers.tsx` — Bangla helper hint texts.
- `src/pages/Irrigation.tsx` — `Dag {n} ({size} শতক)` — extract unit.
- `src/pages/IrrigationRates.tsx` — `confirm()` text in Bangla.
- `src/pages/AuditLogs.tsx` — Bangla CSV headers (intentional? confirm).
- `src/pages/ShareCollection.tsx` — RowsTable inner component (FIXED in this phase).
- `src/pages/Backup.tsx` — TABLES `label` strings.

### Low priority / data seeds
- `src/pages/Accounts.tsx` — chart-of-accounts seed data uses Bangla `name_bn`. **Keep as data, not UI**.
- `src/lib/bnReceipts.ts`, `src/lib/bnNumber.ts` — BN-only by design. **Skip**.
- `src/i18n/translations.ts` — translation values themselves. **Skip**.

## Suggested key prefixes

| Phase | Prefix  | Scope                                  |
|-------|---------|----------------------------------------|
| 5d    | `p5d_`  | Profile, CardDesigner, BulkCards, DataImport |
| 5e    | `p5e_`  | FarmerProfileReport, LandDetail        |
| 5f    | `p5f_`  | Backup table labels, Irrigation units  |

## Re-run

```bash
node scripts/i18n-scan.mjs > docs/i18n-scan-output.txt
```

The CI now fails the build when new findings exceed the baseline; see
`scripts/i18n-check.mjs`.
