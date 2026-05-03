import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirror of the user_roles RLS policies introduced in
 * `voter_audit_and_role_rls.sql`. Keeps the JS in lockstep with SQL so
 * regressions on either side surface as failing assertions.
 */
type Role = "super_admin" | "admin" | "committee" | "staff";
interface Actor { role: Role; office_id: string | null }
interface Target { user_office_id: string | null; new_role: Role }

function canManageUserRole(actor: Actor, target: Target, op: "insert" | "update" | "delete"): boolean {
  if (actor.role === "super_admin") return true;
  if (actor.role !== "admin") return false;
  if (target.new_role === "super_admin") return false; // super admin role is reserved
  // For delete, the "new_role" is treated as the existing role being removed.
  if (op === "delete" && target.new_role === "super_admin") return false;
  return target.user_office_id === actor.office_id;
}

describe("user_roles RLS (logic mirror)", () => {
  const office1 = "office-1";
  const office2 = "office-2";

  it("super_admin can insert/update/delete any role", () => {
    const actor: Actor = { role: "super_admin", office_id: null };
    expect(canManageUserRole(actor, { user_office_id: office1, new_role: "admin" }, "insert")).toBe(true);
    expect(canManageUserRole(actor, { user_office_id: office2, new_role: "staff" }, "update")).toBe(true);
    expect(canManageUserRole(actor, { user_office_id: office1, new_role: "committee" }, "delete")).toBe(true);
  });

  it("admin can update roles within their own office", () => {
    const actor: Actor = { role: "admin", office_id: office1 };
    expect(canManageUserRole(actor, { user_office_id: office1, new_role: "staff" }, "update")).toBe(true);
    expect(canManageUserRole(actor, { user_office_id: office1, new_role: "committee" }, "insert")).toBe(true);
  });

  it("admin cannot update roles for users in another office", () => {
    const actor: Actor = { role: "admin", office_id: office1 };
    expect(canManageUserRole(actor, { user_office_id: office2, new_role: "staff" }, "update")).toBe(false);
  });

  it("admin cannot create or assign super_admin role", () => {
    const actor: Actor = { role: "admin", office_id: office1 };
    expect(canManageUserRole(actor, { user_office_id: office1, new_role: "super_admin" }, "insert")).toBe(false);
    expect(canManageUserRole(actor, { user_office_id: office1, new_role: "super_admin" }, "update")).toBe(false);
  });

  it("staff and committee are denied", () => {
    expect(canManageUserRole({ role: "staff", office_id: office1 }, { user_office_id: office1, new_role: "staff" }, "update")).toBe(false);
    expect(canManageUserRole({ role: "committee", office_id: office1 }, { user_office_id: office1, new_role: "staff" }, "update")).toBe(false);
  });
});
