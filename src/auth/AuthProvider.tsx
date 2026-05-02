import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "committee" | "staff";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  officeId: string | null;
  isSuper: boolean;
  isAdmin: boolean; // admin or super
  isCommittee: boolean; // committee or super
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

  const loadProfile = async (uid: string) => {
    const [{ data: rolesData }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("office_id").eq("id", uid).maybeSingle(),
    ]);
    setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
    setOfficeId(prof?.office_id ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRoles([]);
        setOfficeId(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
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
    <Ctx.Provider value={{ user, session, loading, roles, officeId, isSuper, isAdmin, isCommittee, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
