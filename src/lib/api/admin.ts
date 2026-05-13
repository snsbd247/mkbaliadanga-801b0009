import { api, Paginated } from "./client";

export type User = {
  id: string; name: string; email: string; phone?: string | null;
  office_id?: string | null; is_active?: boolean;
  roles?: { id: string; name: string }[];
};
export type Role = { id: string; name: string; description?: string | null };
export type Permission = { id: string; key: string; module?: string | null };
export type Office = { id: string; name: string; code?: string | null; address?: string | null; is_active?: boolean };
export type Audit = {
  id: string; user_id?: string | null; action: string; entity_type?: string | null;
  entity_id?: string | null; meta?: any; created_at: string;
};
export type SmsLog = {
  id: string; to: string; body: string; status: string; provider?: string | null;
  error?: string | null; created_at: string;
};
export type QrToken = {
  id: string; subject_type: string; subject_id: string; token: string;
  expires_at?: string | null; revoked_at?: string | null; created_at: string;
};

export const UsersApi = {
  list: (params: { q?: string; page?: number; per_page?: number } = {}) =>
    api.get<Paginated<User>>("/users", { params }).then(r => r.data),
  create: (p: Partial<User> & { password: string }) => api.post<User>("/users", p).then(r => r.data),
  update: (id: string, p: Partial<User>) => api.put<User>(`/users/${id}`, p).then(r => r.data),
  delete: (id: string) => api.delete(`/users/${id}`).then(r => r.data),
  assignRole: (id: string, role_id: string) => api.post(`/users/${id}/roles`, { role_id }).then(r => r.data),
  removeRole: (id: string, roleId: string) => api.delete(`/users/${id}/roles/${roleId}`).then(r => r.data),
};

export const RolesApi = {
  list: () => api.get<Role[]>("/roles").then(r => r.data),
  permissions: () => api.get<Permission[]>("/permissions").then(r => r.data),
  syncPermissions: (id: string, permission_ids: string[]) =>
    api.post(`/roles/${id}/permissions`, { permission_ids }).then(r => r.data),
};

export const OfficesApi = {
  list: () => api.get<Office[]>("/offices").then(r => r.data),
  create: (p: Partial<Office>) => api.post<Office>("/offices", p).then(r => r.data),
  update: (id: string, p: Partial<Office>) => api.put<Office>(`/offices/${id}`, p).then(r => r.data),
};

export const AuditApi = {
  list: (params: { q?: string; from?: string; to?: string; page?: number; per_page?: number } = {}) =>
    api.get<Paginated<Audit>>("/audit-logs", { params }).then(r => r.data),
};

export const SmsApi = {
  logs: (params: { status?: string; page?: number; per_page?: number } = {}) =>
    api.get<Paginated<SmsLog>>("/sms/logs", { params }).then(r => r.data),
  send: (p: { to: string; body: string }) => api.post("/sms/send", p).then(r => r.data),
  retry: (id: string) => api.post("/sms/retry", { id }).then(r => r.data),
};

export const QrApi = {
  issue: (p: { subject_type: string; subject_id: string; ttl_days?: number }) =>
    api.post<QrToken>("/qr/issue", p).then(r => r.data),
  revoke: (id: string) => api.delete(`/qr/${id}`).then(r => r.data),
  resolve: (token: string) => api.post("/qr/resolve", { token }).then(r => r.data),
};
