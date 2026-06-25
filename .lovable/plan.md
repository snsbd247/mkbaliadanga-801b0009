# Farmer Profile Tabs + Borga Lifecycle

## Goal
Lock the farmer profile to the 11 tabs you listed and make the **Land History** tab the single place to (a) give a parcel on borga, (b) sell/transfer a parcel to a new owner, (c) distribute a parcel among heirs, and (d) take borga back — all without ever corrupting earlier records.

## Tab list (final)
1. Lands — unchanged
2. ~~Paid Land~~ — removed (already gone; will confirm)
3. Land History — reworked (see below)
4. Transfer History — shows all land movements (unchanged display)
5. Savings · 6. Loans · 7. Statement · 8. Irrigation · 9. Payments · 10. Share Balance · 11. Notes — all unchanged

## Land History actions (the real work)
The action dialog gets 4 explicit modes instead of the current generic one:

### A. Give Borga (বর্গা দেওয়া)
- Owner picks one of their parcels + a sharecropper + the borga area (e.g. 800 of 1200 shotok).
- Owner **keeps** the parcel; only `land_size` is reduced by the borga area (remaining 400 stays with owner). Owner's parcel is NOT deleted.
- A new `lands` row is created for the sharecropper: `owner_type='borgadar'`, `owner_farmer_id = owner`, `land_size = borga area`. This makes the parcel appear in the **sharecropper's profile**.
- One `land_transfers` row (`transfer_type='borga_transfer'`) + recipient row records the event for history.

### B. Reclaim Borga (বর্গা ফেরত)
- From the owner's Land History, the active borga-out parcels are listed with a "ফেরত" button.
- Reclaim merges the borga area back into the owner's parcel (or recreates it), archives the sharecropper's borgadar parcel via `deleted_at`, and writes a `borga_return` transfer record.
- **Prior records are never edited** — the original `borga_transfer` row stays intact; the return is a separate event. History therefore shows: given out → returned.

### C. Sell / Transfer ownership (বিক্রি / হস্তান্তর)
- Existing behavior kept: source parcel archived (`deleted_at`), new owner parcel created (`owner_type='owner'`), `transfer_type='sale'`.

### D. Distribute among heirs (বণ্টন)
- Existing equal/custom split kept: source archived, one new `owner` parcel per heir, `transfer_type='inheritance'`. Equal-split of 1400 shotok across 3 heirs already supported.

## Technical notes
- `LandTransferDialog.tsx`: add a `mode` selector (`borga` | `sale` | `inheritance` | `reclaim`). Branch the submit logic:
  - borga: do NOT archive source; decrement source `land_size`; recipient parcel `owner_type='borgadar'`, `owner_farmer_id=sourceFarmerId`; single recipient.
  - reclaim: locate sharecropper's borgadar parcel, `deleted_at` it, add area back to owner parcel, write `borga_return` transfer.
  - sale/inheritance: keep current archive-and-clone path.
- Add `'borga_return'` to `TYPE_LABEL` in `LandTransferHistoryTab.tsx`.
- `FarmerDetail.tsx`: in Land History tab, derive the borga-out list (active `lands` where `owner_farmer_id = this farmer` and `owner_type='borgadar'`, grouped by sharecropper) and render Reclaim buttons there. Keep the existing "Owned (Borga)" view consistent with this source of truth.
- Keep the existing transfer-back guard (cannot reverse a sale to a prior owner), but it must NOT block borga returns.
- No schema migration expected — `lands` (`owner_type`, `owner_farmer_id`, `deleted_at`, `land_size`), `land_transfers`, and `land_transfer_recipients` already support this. Confirm during build; add a migration only if `borga_return` needs a constraint relaxed.

## Out of scope
Savings, Loans, Statement, Irrigation, Payments, Share Balance, Notes, and the Lands tab are untouched.
