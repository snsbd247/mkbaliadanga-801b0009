import { api, setApiToken } from "./client";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  office_id: string | null;
  roles: string[];
  permissions?: string[];
};

export async function login(email: string, password: string): Promise<{ user: ApiUser; token: string }> {
  const { data } = await api.post("/auth/login", { email, password });
  const token = data.token ?? data.access_token;
  if (!token) throw new Error("No token returned");
  setApiToken(token);
  return { user: data.user, token };
}

export async function me(): Promise<ApiUser> {
  const { data } = await api.get("/auth/me");
  return data.user ?? data;
}

export async function logout(): Promise<void> {
  try { await api.post("/auth/logout"); } catch {}
  setApiToken(null);
}

export async function logoutAll(): Promise<void> {
  try { await api.post("/auth/logout-all"); } catch {}
  setApiToken(null);
}

export async function requestPasswordReset(email: string) {
  await api.post("/auth/password/forgot", { email });
}

export async function resetPassword(token: string, email: string, password: string) {
  await api.post("/auth/password/reset", { token, email, password, password_confirmation: password });
}
