import { api } from "./client";

export type RequiredAdmin = {
  username: string;
  expected_role: string;
  exists: boolean;
  active: boolean;
  has_role: boolean;
  ok: boolean;
};

export type UserRoleRow = {
  id: string;
  username: string;
  name: string;
  active: boolean;
  roles: string[];
};

export type VerifyResponse = {
  required: RequiredAdmin[];
  users: UserRoleRow[];
  actions?: string[];
};

export const adminVerify = {
  status: () => api.get<VerifyResponse>("/admin/verify").then((r) => r.data),
  fix: () => api.post<VerifyResponse>("/admin/verify/fix").then((r) => r.data),
};
