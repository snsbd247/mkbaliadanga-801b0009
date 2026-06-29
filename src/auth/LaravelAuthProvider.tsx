import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { ApiUser, login as apiLogin, logout as apiLogout, me as apiMe } from "@/lib/api/auth";
import { getApiToken, setApiToken } from "@/lib/api/client";

export type AppRole = "developer" | "super_admin" | "admin" | "committee" | "staff";

const STAFF_ROLES: AppRole[] = ["developer", "super_admin", "admin", "committee", "staff"];

/** Thrown after successful auth when the account is not authorised for the staff app. */
export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Validate that an authenticated account may use the staff app. Returns a safe message or null. */
export function validateStaffAccess(u: { roles?: string[] } | null | undefined): string | null {
  const roles = (u?.roles ?? []) as string[];
  if (roles.length === 0) {
    return "Your account has no role assigned yet. Please contact an administrator.";
  }
  if (!roles.some((r) => (STAFF_ROLES as string[]).includes(r))) {
    return "Your account is not authorised to access this app. Please contact an administrator.";
  }
  return null;
}

interface LaravelAuthCtx {
  user: ApiUser | null;
  loading: boolean;
  rolesLoaded: boolean;
  roles: AppRole[];
  officeId: string | null;
  isDeveloper: boolean;
  isSuper: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isCommittee: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<LaravelAuthCtx | undefined>(undefined);

export function LaravelAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (!getApiToken()) { setUser(null); setRolesLoaded(true); return; }
      const u = await apiMe();
      setUser(u);
      setRolesLoaded(true);
    } catch {
      setApiToken(null);
      setUser(null);
      setRolesLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const onUnauth = () => { setUser(null); setRolesLoaded(true); };
    window.addEventListener("api:unauthorized", onUnauth);
    return () => window.removeEventListener("api:unauthorized", onUnauth);
  }, [refresh]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { user } = await apiLogin(identifier, password);
    // Validate role/authorisation AFTER successful authentication.
    const denied = validateStaffAccess(user);
    if (denied) {
      // Drop the freshly-issued session so an unauthorised token isn't kept.
      try { await apiLogout(); } catch { /* ignore */ }
      setUser(null);
      setRolesLoaded(true);
      throw new AccessDeniedError(denied);
    }
    setUser(user);
    setRolesLoaded(true);
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const roles = (user?.roles ?? []) as AppRole[];
  const isDeveloper = roles.includes("developer");
  const isSuper = isDeveloper || roles.includes("super_admin");
  const isAdmin = isSuper || roles.includes("admin");
  const isCommittee = isSuper || roles.includes("committee");

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        rolesLoaded,
        roles,
        officeId: user?.office_id ?? null,
        isDeveloper,
        isSuper,
        isSuperAdmin: isSuper,
        isAdmin,
        isCommittee,
        signIn,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLaravelAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLaravelAuth must be used within LaravelAuthProvider");
  return c;
}
