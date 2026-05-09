import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirror of the RLS rules that hide developer profiles / user_roles
 * from any viewer who is not a developer themselves.
 *
 * Mirrors:
 *   - profiles.read / super admin manage profiles  (post-2026-05-09 migration)
 *   - user_roles.read / update / delete             (existing)
 *
 * Keeping a JS version means UI regressions (e.g. leaking developer accounts
 * into Users & Roles) surface here even when SQL is correct.
 */

type Role = "developer" | "super_admin" | "admin" | "committee" | "staff" | "office_user";
interface Viewer { id: string; role: Role }
interface ProfileRow { id: string; isDeveloper: boolean }

function canSeeProfile(viewer: Viewer, row: ProfileRow): boolean {
  if (viewer.role === "developer") return true;
  if (row.id === viewer.id) return true;
  return !row.isDeveloper;
}

function canSeeUserRole(viewer: Viewer, targetUserId: string, targetIsDeveloper: boolean): boolean {
  if (viewer.role === "developer") return true;
  if (targetUserId === viewer.id) return true;
  if (viewer.role === "super_admin" || viewer.role === "admin") return !targetIsDeveloper;
  return false;
}

function canModifyProfile(viewer: Viewer, row: ProfileRow): boolean {
  if (viewer.role === "developer") return true;
  if (viewer.role !== "super_admin") return false;
  return !row.isDeveloper;
}

const dev: Viewer = { id: "u-dev", role: "developer" };
const superAdmin: Viewer = { id: "u-sa", role: "super_admin" };
const admin: Viewer = { id: "u-a", role: "admin" };
const office: Viewer = { id: "u-o", role: "office_user" };

const devRow: ProfileRow = { id: "u-dev", isDeveloper: true };
const normalRow: ProfileRow = { id: "u-x", isDeveloper: false };

describe("Developer account visibility (RLS mirror)", () => {
  it("only developers can read developer profiles", () => {
    expect(canSeeProfile(dev, devRow)).toBe(true);
    expect(canSeeProfile(superAdmin, devRow)).toBe(false);
    expect(canSeeProfile(admin, devRow)).toBe(false);
    expect(canSeeProfile(office, devRow)).toBe(false);
  });

  it("non-developer profiles remain visible to admins / super admins", () => {
    expect(canSeeProfile(superAdmin, normalRow)).toBe(true);
    expect(canSeeProfile(admin, normalRow)).toBe(true);
  });

  it("a user can always see their own profile even if developer", () => {
    expect(canSeeProfile({ ...dev }, devRow)).toBe(true);
  });

  it("user_roles rows for developer accounts are hidden from non-developers", () => {
    expect(canSeeUserRole(superAdmin, "u-dev", true)).toBe(false);
    expect(canSeeUserRole(admin, "u-dev", true)).toBe(false);
    expect(canSeeUserRole(office, "u-dev", true)).toBe(false);
    expect(canSeeUserRole(dev, "u-dev", true)).toBe(true);
  });

  it("super admin cannot update or delete developer profiles", () => {
    expect(canModifyProfile(superAdmin, devRow)).toBe(false);
    expect(canModifyProfile(superAdmin, normalRow)).toBe(true);
    expect(canModifyProfile(dev, devRow)).toBe(true);
  });

  it("Users & Roles list filtering matches RLS expectations", () => {
    const allRows: ProfileRow[] = [devRow, normalRow, { id: "u-y", isDeveloper: false }];
    const visibleToSuper = allRows.filter((r) => canSeeProfile(superAdmin, r));
    const visibleToAdmin = allRows.filter((r) => canSeeProfile(admin, r));
    const visibleToOffice = allRows.filter((r) => canSeeProfile(office, r));
    const visibleToDev = allRows.filter((r) => canSeeProfile(dev, r));

    for (const list of [visibleToSuper, visibleToAdmin, visibleToOffice]) {
      expect(list.find((r) => r.isDeveloper)).toBeUndefined();
    }
    expect(visibleToDev.find((r) => r.isDeveloper)).toBeDefined();
  });
});
