/**
 * Farmers module API wrapper (Laravel backend).
 * Guard calls with `isLaravelMode()`; Supabase remains the default in preview.
 */
import { apiClient, type Paginated } from "@/lib/api-client";

export type Farmer = {
  id: string;
  office_id: string | null;
  code: string | null;
  name: string;
  bn_name?: string | null;
  father_name?: string | null;
  nid?: string | null;
  phone?: string | null;
  village?: string | null;
  status: string;
  is_member: boolean;
  is_blocked: boolean;
  extra?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type FarmerListParams = {
  search?: string;
  status?: string;
  office_id?: string;
  per_page?: number;
  page?: number;
};

export const farmersApi = {
  list: (params?: FarmerListParams) => apiClient.get<Paginated<Farmer>>("/farmers", params),
  get: (id: string) => apiClient.get<Farmer>(`/farmers/${id}`),
  create: (payload: Partial<Farmer>) => apiClient.post<Farmer>("/farmers", payload),
  update: (id: string, payload: Partial<Farmer>) => apiClient.put<Farmer>(`/farmers/${id}`, payload),
  remove: (id: string) => apiClient.del<{ ok: boolean }>(`/farmers/${id}`),
};
