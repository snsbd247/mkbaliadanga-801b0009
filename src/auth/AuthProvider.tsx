import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { hydrateReceiptOptionsFromProfile } from "@/lib/receiptOptions";
import { isLaravelBackend } from "@/lib/backend";
import { api, getApiToken, setApiToken } from "@/lib/api/client";

export type AppRole = "developer" | "super_admin" | "admin" | "committee" | "staff";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
  roles: AppRole[];
  officeId: string | null;
  isDeveloper: boolean;
  isSuper: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isCommittee: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

/**
 * Unified AuthProvider:
 * - Lovable preview / Supabase mode  → uses Supabase auth (same as before).
 * - VPS / Laravel mode (VITE_API_URL) → uses Laravel /auth/me + bearer token.
 *
 * The exposed shape stays identical so every existing page keeps working
 * without changes — only the backend swaps based on build env.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const loadedProfileUserIdRef = useRef<string | null>(null);

  // ── Supabase path ──────────────────────────────────────────────────
  const loadSupabaseProfile = async (uid: string) => {
    const [{ data: rolesData }, { data: prof }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", uid),
      db.from("profiles").select("office_id").eq("id", uid).maybeSingle(),
    ]);
    loadedProfileUserIdRef.current = uid;
    setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
    setOfficeId(prof?.office_id ?? null);
    setRolesLoaded(true);
    void hydrateReceiptOptionsFromProfile();
  };

  // ── Laravel path ───────────────────────────────────────────────────
  const loadLaravelMe = useCallback(async () => {
    if (!getApiToken()) {
      setUser(null);
      setSession(null);
      setRoles([]);
      setOfficeId(null);
      setRolesLoaded(true);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      const u = data.user ?? data;
      // Map Laravel user to a minimal Supabase-like User shape so existing pages work.
      setUser({ id: u.id, email: u.email, user_metadata: { name: u.name } } as unknown as User);
      setSession({ access_token: getApiToken() } as unknown as Session);
      setRoles((u.roles ?? []) as AppRole[]);
      setOfficeId(u.office_id ?? null);
      setRolesLoaded(true);
    } catch {
      setApiToken(null);
      setUser(null);
      setSession(null);
      setRoles([]);
      setOfficeId(null);
      setRolesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLaravelBackend) {
      loadLaravelMe().finally(() => setLoading(false));
      const onUnauth = () => {
        setUser(null);
        setSession(null);
        setRoles([]);
        setOfficeId(null);
        setRolesLoaded(true);
      };
      window.addEventListener("api:unauthorized", onUnauth);
      return () => window.removeEventListener("api:unauthorized", onUnauth);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (loadedProfileUserIdRef.current !== s.user.id) {
          setRolesLoaded(false);
          setTimeout(() => loadSupabaseProfile(s.user.id), 0);
        }
      } else {
        loadedProfileUserIdRef.current = null;
        setRoles([]);
        setOfficeId(null);
        setRolesLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadSupabaseProfile(s.user.id);
      else setRolesLoaded(true);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadLaravelMe]);

  const signOut = async () => {
    if (isLaravelBackend) {
      try { await api.post("/auth/logout"); } catch {}
      setApiToken(null);
      setUser(null); setSession(null); setRoles([]); setOfficeId(null);
    } else {
      await supabase.auth.signOut();
    }
  };

  const refresh = async () => {
    if (isLaravelBackend) await loadLaravelMe();
    else if (user) await loadSupabaseProfile(user.id);
  };

  const isDeveloper = roles.includes("developer");
  const isSuper = isDeveloper || roles.includes("super_admin");
  const isAdmin = isSuper || roles.includes("admin");
  const isCommittee = isSuper || roles.includes("committee");

  return (
    <Ctx.Provider value={{ user, session, loading, rolesLoaded, roles, officeId, isDeveloper, isSuper, isSuperAdmin: isSuper, isAdmin, isCommittee, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
