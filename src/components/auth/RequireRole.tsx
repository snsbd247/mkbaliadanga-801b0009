import { useAuth, type AppRole } from "@/auth/AuthProvider";
import { AccessDenied } from "./AccessDenied";

/**
 * Gate a page by allowed roles. Super admin always passes.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: AppRole[];
  children: React.ReactNode;
  /** @deprecated kept for backward compat; not used. */
  fallbackTo?: string;
}) {
  const { rolesLoaded, roles: userRoles, isSuper } = useAuth();
  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const allowed = isSuper || userRoles.some((r) => roles.includes(r));
  if (!allowed) return <AccessDenied detail={`Required role: ${roles.join(" / ")}`} />;
  return <>{children}</>;
}
