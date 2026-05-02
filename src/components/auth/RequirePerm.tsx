import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { usePermissions, type ModuleKey, type Perm } from "@/lib/permissions";

/**
 * Gate a page by a permission module + action.
 * Super admins always pass. While roles are still loading, render a placeholder.
 */
export function RequirePerm({
  module,
  action = "can_view",
  children,
  fallbackTo = "/admin",
}: {
  module: ModuleKey;
  action?: keyof Perm;
  children: React.ReactNode;
  fallbackTo?: string;
}) {
  const { rolesLoaded } = useAuth();
  const { can } = usePermissions();
  if (!rolesLoaded) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }
  if (!can(module, action)) {
    return <Navigate to={fallbackTo} replace />;
  }
  return <>{children}</>;
}
