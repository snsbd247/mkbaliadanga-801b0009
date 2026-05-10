import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

export type ModuleKey =
  | "dashboard" | "offices" | "farmers" | "seasons"
  | "savings" | "loans" | "irrigation" | "payments"
  | "reports" | "users" | "audit" | "settings"
  | "accounting" | "cashbook" | "approvals" | "sms" | "locations"
  | "assets";

export const ALL_MODULES: ModuleKey[] = [
  "dashboard","offices","farmers","seasons","savings","loans",
  "irrigation","payments","reports","users","audit","settings",
  "accounting","cashbook","approvals","sms","locations","assets",
];

export interface Perm { can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean; }

export const FULL: Perm = { can_view: true, can_add: true, can_edit: true, can_delete: true };
export const VIEW_ONLY: Perm = { can_view: true, can_add: false, can_edit: false, can_delete: false };
export const NONE: Perm = { can_view: false, can_add: false, can_edit: false, can_delete: false };

// Hardcoded fallback if DB role_permissions can't be read
const HARDCODED_STAFF: Record<string, Perm> = {
  dashboard: VIEW_ONLY,
  farmers: { can_view: true, can_add: true, can_edit: true, can_delete: false },
  savings: { can_view: true, can_add: true, can_edit: false, can_delete: false },
  loans: { can_view: true, can_add: true, can_edit: false, can_delete: false },
  irrigation: { can_view: true, can_add: true, can_edit: false, can_delete: false },
  payments: { can_view: true, can_add: true, can_edit: false, can_delete: false },
  reports: VIEW_ONLY,
  seasons: VIEW_ONLY,
  cashbook: VIEW_ONLY,
  approvals: VIEW_ONLY,
  offices: NONE, users: NONE, audit: NONE, settings: NONE,
  accounting: NONE, sms: NONE, locations: NONE,
  assets: { can_view: true, can_add: true, can_edit: false, can_delete: false },
};

export function usePermissions() {
  const { user, isSuper, isAdmin, roles } = useAuth();
  const [userMap, setUserMap] = useState<Record<string, Perm>>({});
  const [roleMap, setRoleMap] = useState<Record<string, Record<string, Perm>>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("user_permissions").select("*").eq("user_id", user.id).then(({ data }) => {
      const m: Record<string, Perm> = {};
      (data ?? []).forEach((r: any) => {
        m[r.module] = { can_view: r.can_view, can_add: r.can_add, can_edit: r.can_edit, can_delete: r.can_delete };
      });
      setUserMap(m);
    });
    supabase.from("role_permissions").select("*").then(({ data }) => {
      const rm: Record<string, Record<string, Perm>> = {};
      (data ?? []).forEach((r: any) => {
        (rm[r.role] ??= {})[r.module] = { can_view: r.can_view, can_add: r.can_add, can_edit: r.can_edit, can_delete: r.can_delete };
      });
      setRoleMap(rm);
    });
  }, [user?.id]);

  function can(module: ModuleKey, action: keyof Perm = "can_view"): boolean {
    if (isSuper) return true;
    const override = userMap[module];
    if (override) return override[action];

    // Try each user role's defaults
    for (const role of roles) {
      const rp = roleMap[role]?.[module];
      if (rp) return rp[action];
    }

    // Fallback to hardcoded defaults
    if (isAdmin) return true;
    return (HARDCODED_STAFF[module] ?? NONE)[action];
  }

  return { can, perms: userMap };
}
