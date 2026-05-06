import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hydrateReceiptOptionsFromProfile } from "@/lib/receiptOptions";

export type AppRole = "developer" | "super_admin" | "admin" | "committee" | "staff";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
  roles: AppRole[];
  officeId: string | null;
  isDeveloper: boolean;
  isSuper: boolean; // developer or super_admin
  /** Alias for isSuper to standardize naming across pages. */
  isSuperAdmin: boolean;
  isAdmin: boolean; // developer, admin or super
  isCommittee: boolean; // developer, committee or super
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const loadProfile = async (uid: string) => {
    const [{ data: rolesData }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("office_id").eq("id", uid).maybeSingle(),
    ]);
    setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
    setOfficeId(prof?.office_id ?? null);
    setRolesLoaded(true);
    void hydrateReceiptOptionsFromProfile();
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setRolesLoaded(false);
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRoles([]);
        setOfficeId(null);
        setRolesLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      else setRolesLoaded(true);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };
  const refresh = async () => { if (user) await loadProfile(user.id); };

  const isSuper = roles.includes("super_admin");
  const isAdmin = isSuper || roles.includes("admin");
  const isCommittee = isSuper || roles.includes("committee");

  return (
    <Ctx.Provider value={{ user, session, loading, rolesLoaded, roles, officeId, isSuper, isSuperAdmin: isSuper, isAdmin, isCommittee, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
