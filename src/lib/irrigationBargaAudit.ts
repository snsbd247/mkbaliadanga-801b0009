/**
 * Audit logging for Barga (sharecropper) due splits and payment allocations.
 *
 * Every split change and allocation change is recorded with the acting user
 * (resolved inside `logAudit`), office, reference id, and timestamp (server
 * `created_at`). Office-level access control is enforced by `assertBargaOffice`
 * so only the assigned office can view/export a parcel's Barga totals.
 */
import { logAudit } from "./audit";
import type { BargaRelation } from "./irrigationBargaSplit";
import type { BargaAllocationRow } from "./irrigationBargaAllocation";

export interface BargaSplitAuditInput {
  office_id: string | null;
  land_id: string;
  parcel_area: number;
  relations: BargaRelation[];
  previous?: BargaRelation[] | null;
}

/** Record a Barga split create/update with before/after relation snapshots. */
export async function auditBargaSplit(input: BargaSplitAuditInput): Promise<void> {
  await logAudit({
    office_id: input.office_id,
    module: "irrigation_invoice",
    action_type: input.previous ? "update" : "create",
    reference_id: input.land_id,
    old_data: input.previous
      ? { parcel_area: input.parcel_area, relations: input.previous }
      : null,
    new_data: { parcel_area: input.parcel_area, relations: input.relations },
  });
}

export interface BargaAllocationAuditInput {
  office_id: string | null;
  reference_id: string;
  amount: number;
  allocations: BargaAllocationRow[];
  leftover: number;
}

/** Record a Barga payment allocation change with the resulting rows. */
export async function auditBargaAllocation(
  input: BargaAllocationAuditInput,
): Promise<void> {
  await logAudit({
    office_id: input.office_id,
    module: "irrigation_payment",
    action_type: "override",
    reference_id: input.reference_id,
    old_data: null,
    new_data: {
      amount: input.amount,
      leftover: input.leftover,
      allocations: input.allocations,
    },
  });
}

/**
 * Office-level access guard: returns true only when the viewer's office matches
 * the parcel's office. Super admins (officeId === "*") may always view.
 */
export function canAccessBargaOffice(
  viewerOfficeId: string | null | undefined,
  parcelOfficeId: string | null | undefined,
): boolean {
  if (viewerOfficeId === "*") return true;
  if (!viewerOfficeId || !parcelOfficeId) return false;
  return viewerOfficeId === parcelOfficeId;
}

/** Filter parcels to the viewer's office before building totals/exports. */
export function filterBargaParcelsByOffice<T extends { office_id?: string | null }>(
  parcels: T[],
  viewerOfficeId: string | null | undefined,
): T[] {
  if (viewerOfficeId === "*") return parcels;
  return parcels.filter((p) => canAccessBargaOffice(viewerOfficeId, p.office_id));
}
