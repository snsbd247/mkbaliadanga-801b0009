// Laravel/VPS build shim for the Supabase client.
//
// On the self-hosted VPS build (VITE_API_URL set) Vite aliases
// `@/integrations/supabase/client` to THIS module instead of the
// auto-generated Supabase client. The goal: the deployed app must have
// ZERO connection to Supabase — every read/write goes to the VPS Laravel
// API (MySQL). See vite.config.ts for the conditional alias.
//
// `db` already routes from()/rpc()/functions/storage to Laravel in this
// mode, so we delegate to it. Auth + realtime get inert/local stubs because
// the VPS app authenticates through LaravelAuthProvider (token-based), not
// Supabase Auth.

import { db } from "@/lib/db";
import { me, type ApiUser } from "@/lib/api/auth";
import { getApiToken } from "@/lib/api/client";

let cachedUser: ApiUser | null = null;

async function currentUser(): Promise<ApiUser | null> {
  if (!getApiToken()) return null;
  if (cachedUser) return cachedUser;
  try {
    cachedUser = await me();
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

function sessionFor(user: ApiUser | null) {
  const token = getApiToken();
  if (!token || !user) return null;
  return {
    access_token: token,
    token_type: "bearer",
    user: { id: user.id, email: user.email, user_metadata: {}, app_metadata: {} },
  };
}

const authStub = {
  async getSession() {
    const user = await currentUser();
    return { data: { session: sessionFor(user) }, error: null };
  },
  async getUser() {
    const user = await currentUser();
    return {
      data: { user: user ? { id: user.id, email: user.email } : null },
      error: null,
    };
  },
  onAuthStateChange(_cb?: unknown) {
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async signOut() {
    cachedUser = null;
    return { error: null };
  },
  async signInWithPassword() {
    return { data: { user: null, session: null }, error: { message: "Use the VPS login (token auth)." } };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: { message: "Password reset is handled by the server." } };
  },
  async updateUser() {
    return { data: { user: null }, error: { message: "Account updates are handled by the server." } };
  },
};

function channelStub() {
  const ch: any = {
    on() { return ch; },
    subscribe() { return ch; },
    unsubscribe() { return Promise.resolve("ok"); },
  };
  return ch;
}

// Supabase-client-shaped object backed entirely by the Laravel/MySQL API.
export const supabase: any = {
  from: (table: string) => db.from(table),
  rpc: (name: string, params?: Record<string, unknown>) => db.rpc(name, params),
  functions: { invoke: (name: string, opts?: { body?: unknown }) => db.functions.invoke(name, opts) },
  storage: { from: (bucket: string) => db.storage.from(bucket) },
  auth: authStub,
  channel: () => channelStub(),
  removeChannel: () => Promise.resolve("ok"),
};

export default supabase;
