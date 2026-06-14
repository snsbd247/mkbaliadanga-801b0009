// Access rules for the OfficeIncome (Hawlat / Vangari / Anudan) tab and exports.
// Mirrors the RLS policies on public.office_incomes so the UI can gate actions.
//
// RLS summary:
//  - SELECT: super_admin (all offices) OR same office (admin/staff)
//  - INSERT: any authenticated user (scoped to their office on save)
//  - UPDATE/DELETE: super_admin OR admin within their own office
export type AppRole = "super_admin" | "admin" | "staff";

/** Can the user view the OfficeIncome tab / list / exports? */
export function canViewOfficeIncome(role: AppRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin" || role === "staff";
}

/** Can the user export (PDF / Excel / template) OfficeIncome data? */
export function canExportOfficeIncome(role: AppRole | null | undefined): boolean {
  // Exporting is a read action — anyone who can view can export.
  return canViewOfficeIncome(role);
}

/** Can the user create a new OfficeIncome receipt? */
export function canCreateOfficeIncome(role: AppRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin" || role === "staff";
}

/** Can the user edit/delete an existing OfficeIncome receipt? */
export function canManageOfficeIncome(role: AppRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}
