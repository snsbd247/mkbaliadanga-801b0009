import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/auth/AuthProvider";

/**
 * Gate a page by allowed roles. Super admin always passes.
 */
export function RequireRole({
  roles,
  children,
  fallbackTo = "/admin",
}: {
  roles: AppRole[];
  children: React.ReactNode;
  fallbackTo?: string;
}) {
  const { rolesLoaded, roles: userRoles, isSuper } = useAuth();
  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const allowed = isSuper || userRoles.some((r) => roles.includes(r));
  if (!allowed) return <Navigate to={fallbackTo} replace />;
  return <>{children}</>;
}
