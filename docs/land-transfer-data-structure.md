# Land Transfer Data Structure & Demo Import Mapping

This document describes how land transfers (borga / sale / inheritance / split)
are stored, how the Demo Importer seeds them, and how integrity is verified so
that **both** the giving and receiving farmer profiles show correct data.

## 1. Tables

### `land_transfers` (one row per transfer event)
| column | purpose |
| --- | --- |
| `id` | transfer id |
| `source_land_id` | the land that was given/sold/split (may later be archived) |
| `source_farmer_id` | the owner who gave the land |
| `transfer_type` | `borga_transfer`, `borga_return`, `sale`, `inheritance`, `split`, `other` |
| `source_dag_no`, `source_mouza`, `source_land_size` | **snapshot** of the source land at transfer time |
| `source_owner_name`, `source_owner_code` | **snapshot** of the owner |
| `transferred_at` | date |

> The snapshot columns are critical: when the source land is fully given away it
> is archived (`deleted_at` set), so history must not depend on the live land row.

### `land_transfer_recipients` (one row per recipient)
| column | purpose |
| --- | --- |
| `transfer_id` | FK to `land_transfers` |
| `recipient_farmer_id` | who received the land |
| `new_land_id` | the **new active land row** created for the recipient |
| `area_decimal` | area allocated to this recipient (decimal / শতক) |

### `lands`
- Recipient gets a **new active row** (`deleted_at IS NULL`) under their `farmer_id`.
- Source row is **archived** (full give) or **decremented** (partial / split remainder).
- Unique index `uq_lands_farmer_dag` is partial: `WHERE deleted_at IS NULL`, so an
  archived row never blocks a later reclaim of the same dag.

## 2. Transfer semantics

| Type | Source land | Recipient land | Notes |
| --- | --- | --- | --- |
| `borga_transfer` | archived (or size reduced) | new active row for tenant | shows on tenant's profile + "Sharecropped by others" on owner |
| `borga_return` | revived / size merged back | recipient may equal owner | reclaim; do **not** flag recipient==source |
| `sale` | archived | new active row for buyer | ownership change |
| `inheritance` | archived | new rows for heirs | |
| `split` | reduced by allocated total | one new row per child | `sum(area) <= source size` |

## 3. Demo importer mapping (`supabase/functions/demo-reset/index.ts`)

`seedLandTransfers` mirrors the live app:
1. Pick a source farmer's land, snapshot its dag/mouza/size/owner into the transfer row.
2. Insert `land_transfer_recipients` with `area_decimal` and the new land id.
3. Create the recipient's new active `lands` row (correct `farmer_id`, dag, size).
4. Archive or decrement the source land row.

This guarantees the seeded data passes the same integrity checks as user-entered data.

## 4. Integrity verification

`src/lib/landTransferIntegrity.ts` (`checkLandTransferIntegrity`) validates every
transfer and returns coded violations. Run it from **Demo Manager → Land Transfer
Integrity** card, or in tests.

| code | severity | meaning |
| --- | --- | --- |
| `unknown_type` | error | transfer_type not in the known set |
| `missing_snapshot` | error | dag/size/owner snapshot missing |
| `no_recipients` | error | transfer has no recipient rows |
| `recipient_no_land` | error | recipient has no `new_land_id` |
| `recipient_land_missing` | error | new land row absent from `lands` |
| `recipient_land_archived` | warning | recipient land archived → not visible |
| `recipient_no_area` | error | area is zero/negative |
| `area_exceeds_source` | error | allocated area > source size |
| `recipient_equals_source` | warning | recipient == source (ownership transfer) |
| `source_land_missing` | warning | source land row gone (snapshot still holds history) |

## 5. Regression coverage

- `src/lib/__tests__/landTransferIntegrity.test.ts` — happy paths, every violation
  code, and two-profile visibility (source archived + recipient active row).
- `src/lib/__tests__/demoPresets.test.ts` — verifies `land_transfers` /
  `land_transfer_recipients` are part of the post-import row-count report so a
  module with zero transfers is surfaced.

Run with the test runner; both suites must pass before shipping demo-import changes.
