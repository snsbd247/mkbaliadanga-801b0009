import { usePermissions, type ModuleKey, type Perm } from "@/lib/permissions";

/**
 * Single-action permission check hook.
 * Wraps usePermissions() for ergonomic call sites:
 *   const canEdit = usePermission("payments", "can_edit");
 */
export function usePermission(module: ModuleKey, action: keyof Perm = "can_view"): boolean {
  const { can } = usePermissions();
  return can(module, action);
}
