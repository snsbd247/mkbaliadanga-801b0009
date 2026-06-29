import { useAuth } from "@/auth/AuthProvider";
import { AccessDenied } from "./AccessDenied";

/**
 * Gate a page so only users with the `developer` role can access it.
 * Even super admins are blocked.
 */
export function RequireDeveloper({ children }: { children: React.ReactNode }) {
  const { rolesLoaded, isDeveloper } = useAuth();
  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isDeveloper) return <AccessDenied detail="Developer only" />;
  return <>{children}</>;
}
