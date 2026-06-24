/**
 * Lands module API wrapper (Laravel backend).
 * Guard calls with `isLaravelMode()`; Supabase remains the default in preview.
 */
import { apiClient, type Paginated } from "@/lib/api-client";

export type Land = {
  id: string;
  office_id: string | null;
  farmer_id: string | null;
  land_type_id?: string | null;
  dag_no?: string | null;
  khatian_no?: string | null;
  katha: number;
  shatak: number;
  owner_name?: string | null;
  land_status: string;
  is_active: boolean;
  extra?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type LandListParams = {
  search?: string;
  farmer_id?: string;
  office_id?: string;
  per_page?: number;
  page?: number;
};

export const landsApi = {
  list: (params?: LandListParams) => apiClient.get<Paginated<Land>>("/lands", params),
  get: (id: string) => apiClient.get<Land>(`/lands/${id}`),
  create: (payload: Partial<Land>) => apiClient.post<Land>("/lands", payload),
  update: (id: string, payload: Partial<Land>) => apiClient.put<Land>(`/lands/${id}`, payload),
  remove: (id: string) => apiClient.del<{ ok: boolean }>(`/lands/${id}`),
};

export type GeoItem = { id: string; name: string; bn_name?: string | null };

export const geoApi = {
  divisions: () => apiClient.get<GeoItem[]>("/geo/divisions"),
  districts: (division_id?: string) => apiClient.get<GeoItem[]>("/geo/districts", { division_id }),
  upazilas: (district_id?: string) => apiClient.get<GeoItem[]>("/geo/upazilas", { district_id }),
  unions: (upazila_id?: string) => apiClient.get<GeoItem[]>("/geo/unions", { upazila_id }),
  mouzas: (union_id?: string) => apiClient.get<GeoItem[]>("/geo/mouzas", { union_id }),
  patwaris: () => apiClient.get<GeoItem[]>("/geo/patwaris"),
  landTypes: () => apiClient.get<GeoItem[]>("/geo/land-types"),
};
