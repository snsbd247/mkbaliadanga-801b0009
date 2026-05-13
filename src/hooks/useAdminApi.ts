import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UsersApi, RolesApi, OfficesApi, AuditApi, SmsApi, QrApi,
  User, Office,
} from "@/lib/api/admin";

// Users
export const useUsers = (params: { q?: string; page?: number; per_page?: number } = {}) =>
  useQuery({ queryKey: ["api", "users", params], queryFn: () => UsersApi.list(params) });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<User> & { password: string }) => UsersApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "users"] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<User>) => UsersApi.update(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "users"] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: UsersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "users"] }),
  });
};

export const useAssignRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role_id }: { id: string; role_id: string }) => UsersApi.assignRole(id, role_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "users"] }),
  });
};

export const useRemoveRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) => UsersApi.removeRole(id, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "users"] }),
  });
};

// Roles & Permissions
export const useRoles = () =>
  useQuery({ queryKey: ["api", "roles"], queryFn: RolesApi.list });

export const usePermissions = () =>
  useQuery({ queryKey: ["api", "permissions"], queryFn: RolesApi.permissions });

export const useSyncRolePermissions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permission_ids }: { id: string; permission_ids: string[] }) =>
      RolesApi.syncPermissions(id, permission_ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "roles"] }),
  });
};

// Offices
export const useOffices = () =>
  useQuery({ queryKey: ["api", "offices"], queryFn: OfficesApi.list });

export const useCreateOffice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<Office>) => OfficesApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "offices"] }),
  });
};

export const useUpdateOffice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<Office>) => OfficesApi.update(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "offices"] }),
  });
};

// Audit
export const useAuditLogs = (params: { q?: string; from?: string; to?: string; page?: number; per_page?: number } = {}) =>
  useQuery({ queryKey: ["api", "audit", params], queryFn: () => AuditApi.list(params) });

// SMS
export const useSmsLogs = (params: { status?: string; page?: number; per_page?: number } = {}) =>
  useQuery({ queryKey: ["api", "sms", params], queryFn: () => SmsApi.logs(params) });

export const useSendSms = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: SmsApi.send,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "sms"] }),
  });
};

export const useRetrySms = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: SmsApi.retry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "sms"] }),
  });
};

// QR
export const useIssueQr = () =>
  useMutation({ mutationFn: QrApi.issue });

export const useRevokeQr = () =>
  useMutation({ mutationFn: QrApi.revoke });
