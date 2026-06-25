// Shared helpers for loan guarantors & extra nominees.
// Kept pure (no React/Supabase) so they can be unit-tested and reused by
// the loan form, the loan report exports, and validation.

export type PartyRole = "guarantor" | "nominee";

export type Party = {
  name: string;
  father_name: string;
  village: string;
  mobile: string;
  nid: string;
};

export const emptyParty = (): Party => ({ name: "", father_name: "", village: "", mobile: "", nid: "" });

/** A loan_guarantors row as stored/loaded from the database. */
export type PartyRow = {
  name?: string | null;
  father_name?: string | null;
  village?: string | null;
  mobile?: string | null;
  nid?: string | null;
  role?: string | null;
};

export const rowToParty = (r: PartyRow): Party => ({
  name: r.name ?? "",
  father_name: r.father_name ?? "",
  village: r.village ?? "",
  mobile: r.mobile ?? "",
  nid: r.nid ?? "",
});

/** Split loaded loan_guarantors rows into guarantors and nominees. */
export function splitParties(rows: PartyRow[] | null | undefined): { guarantors: Party[]; nominees: Party[] } {
  const list = rows ?? [];
  return {
    guarantors: list.filter((r) => (r.role ?? "guarantor") === "guarantor").map(rowToParty),
    nominees: list.filter((r) => r.role === "nominee").map(rowToParty),
  };
}

/** True when a party row has at least one non-empty field. */
export const partyHasData = (p: Party): boolean =>
  !!(p.name.trim() || p.father_name.trim() || p.village.trim() || p.mobile.trim() || p.nid.trim());

/** Bangladeshi NID: 10, 13 or 17 digits. */
export const isValidNid = (nid: string): boolean => /^(\d{10}|\d{13}|\d{17})$/.test(nid.trim());

export type PartyFieldError = { index: number; field: "name" | "nid"; code: "empty" | "invalid_nid" | "duplicate" };

/**
 * Validate a list of parties. Returns per-row field errors.
 * - empty rows (no data) are skipped
 * - name is required
 * - NID, if present, must be valid
 * - duplicates (same name + nid) are flagged on the later occurrence
 */
export function validateParties(list: Party[]): PartyFieldError[] {
  const errors: PartyFieldError[] = [];
  const seen = new Set<string>();
  list.forEach((p, index) => {
    if (!partyHasData(p)) return;
    if (!p.name.trim()) errors.push({ index, field: "name", code: "empty" });
    const nid = p.nid.trim();
    if (nid && !isValidNid(nid)) errors.push({ index, field: "nid", code: "invalid_nid" });
    const key = `${p.name.trim().toLowerCase()}|${nid}`;
    if (p.name.trim() && seen.has(key)) errors.push({ index, field: "name", code: "duplicate" });
    if (p.name.trim()) seen.add(key);
  });
  return errors;
}

/** Build insertable loan_guarantors rows for a loan (drops empty rows). */
export function buildPartyRows(
  loanId: string,
  guarantors: Party[],
  nominees: Party[],
  officeId: string | null,
): Array<PartyRow & { loan_id: string; office_id: string | null }> {
  const mk = (p: Party, role: PartyRole) => ({
    loan_id: loanId,
    role,
    name: p.name.trim(),
    father_name: p.father_name.trim() || null,
    village: p.village.trim() || null,
    mobile: p.mobile.trim() || null,
    nid: p.nid.trim() || null,
    office_id: officeId,
  });
  return [
    ...guarantors.filter((p) => p.name.trim()).map((p) => mk(p, "guarantor")),
    ...nominees.filter((p) => p.name.trim()).map((p) => mk(p, "nominee")),
  ];
}
