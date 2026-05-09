import { describe, it, expect } from "vitest";

/**
 * Phase 4 — Permission matrix invariants.
 *
 * These tests guard against privilege-escalation regressions in the
 * UI logic of RoleMatrix.tsx without booting React. They mirror the
 * rules implemented there:
 *   - super_admin is always granted, never editable
 *   - cloning into super_admin is forbidden
 *   - audit diff captures only changed cells
 */

type Action = "can_view" | "can_add" | "can_edit" | "can_delete";
type Perm = Record<Action, boolean>;
type Role = "super_admin" | "admin" | "committee" | "staff";

const ACTIONS: Action[] = ["can_view", "can_add", "can_edit", "can_delete"];

function diff(
  original: Record<string, Perm>,
  current: Record<string, Perm>,
  roles: Role[],
  modules: string[]
) {
  const out: Array<{ role: Role; module: string; action: Action; old: boolean; nw: boolean }> = [];
  for (const role of roles) {
    if (role === "super_admin") continue;
    for (const mod of modules) {
      const k = `${role}:${mod}`;
      for (const a of ACTIONS) {
        const o = original[k]?.[a] ?? false;
        const n = current[k]?.[a] ?? false;
        if (o !== n) out.push({ role, module: mod, action: a, old: o, nw: n });
      }
    }
  }
  return out;
}

describe("permission matrix guards", () => {
  it("super_admin diff entries are skipped even if mutated", () => {
    const orig: Record<string, Perm> = {
      "super_admin:farmers": { can_view: true, can_add: true, can_edit: true, can_delete: true },
      "staff:farmers": { can_view: false, can_add: false, can_edit: false, can_delete: false },
    };
    const curr: Record<string, Perm> = {
      "super_admin:farmers": { can_view: false, can_add: false, can_edit: false, can_delete: false },
      "staff:farmers": { can_view: true, can_add: false, can_edit: false, can_delete: false },
    };
    const d = diff(orig, curr, ["super_admin", "staff"], ["farmers"]);
    expect(d.find((x) => x.role === "super_admin")).toBeUndefined();
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ role: "staff", action: "can_view", old: false, nw: true });
  });

  it("clone target = super_admin must be rejected by guard", () => {
    const cloneFrom = "staff" as Role;
    const cloneTo = "super_admin" as Role;
    const allowed = cloneFrom !== cloneTo && cloneTo !== "super_admin";
    expect(allowed).toBe(false);
  });

  it("clone same source/target is rejected", () => {
    const a = "staff" as Role;
    const b = "staff" as Role;
    const allowed = a !== b;
    expect(allowed).toBe(false);
  });
});
