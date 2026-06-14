import { describe, it, expect } from "vitest";
import {
  canViewOfficeIncome,
  canExportOfficeIncome,
  canCreateOfficeIncome,
  canManageOfficeIncome,
} from "@/lib/officeIncomePermissions";

describe("OfficeIncome access rules", () => {
  it("Super Admin can view, export, create and manage", () => {
    expect(canViewOfficeIncome("super_admin")).toBe(true);
    expect(canExportOfficeIncome("super_admin")).toBe(true);
    expect(canCreateOfficeIncome("super_admin")).toBe(true);
    expect(canManageOfficeIncome("super_admin")).toBe(true);
  });

  it("Admin can view, export, create and manage", () => {
    expect(canViewOfficeIncome("admin")).toBe(true);
    expect(canExportOfficeIncome("admin")).toBe(true);
    expect(canCreateOfficeIncome("admin")).toBe(true);
    expect(canManageOfficeIncome("admin")).toBe(true);
  });

  it("Staff can view, export and create but cannot edit/delete", () => {
    expect(canViewOfficeIncome("staff")).toBe(true);
    expect(canExportOfficeIncome("staff")).toBe(true);
    expect(canCreateOfficeIncome("staff")).toBe(true);
    expect(canManageOfficeIncome("staff")).toBe(false);
  });

  it("Unknown / no role has no access", () => {
    expect(canViewOfficeIncome(null)).toBe(false);
    expect(canExportOfficeIncome(undefined)).toBe(false);
    expect(canCreateOfficeIncome(null)).toBe(false);
    expect(canManageOfficeIncome(null)).toBe(false);
  });
});
