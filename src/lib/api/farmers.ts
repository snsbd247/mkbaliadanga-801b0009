import { api, Paginated } from "./client";

export type Farmer = {
  id: string;
  office_id: string;
  code: string;
  name: string;
  father_name?: string | null;
  mother_name?: string | null;
  phone?: string | null;
  nid?: string | null;
  address?: string | null;
  village?: string | null;
  union?: string | null;
  upazila?: string | null;
  district?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type FarmerListParams = {
  q?: string;
  page?: number;
  per_page?: number;
  status?: string;
  village?: string;
};

export async function listFarmers(params: FarmerListParams = {}): Promise<Paginated<Farmer>> {
  const { data } = await api.get("/farmers", { params });
  return data;
}

export async function getFarmer(id: string): Promise<Farmer> {
  const { data } = await api.get(`/farmers/${id}`);
  return data.data ?? data;
}

export async function createFarmer(payload: Partial<Farmer>): Promise<Farmer> {
  const { data } = await api.post("/farmers", payload);
  return data.data ?? data;
}

export async function updateFarmer(id: string, payload: Partial<Farmer>): Promise<Farmer> {
  const { data } = await api.put(`/farmers/${id}`, payload);
  return data.data ?? data;
}

export async function deleteFarmer(id: string): Promise<void> {
  await api.delete(`/farmers/${id}`);
}
