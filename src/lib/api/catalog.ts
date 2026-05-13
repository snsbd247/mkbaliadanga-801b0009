import { api, Paginated } from "./client";

export type Land = {
  id: string; farmer_id: string; khatian_no?: string | null; dag_no?: string | null;
  area_decimal?: number | null; mouza?: string | null; notes?: string | null;
};
export type Season = {
  id: string; name: string; year?: number | null;
  start_date?: string | null; end_date?: string | null; is_active?: boolean;
};
export type LoanPlan = {
  id: string; name: string; principal: number; interest_rate: number;
  tenure_months: number; processing_fee?: number | null; description?: string | null; is_active?: boolean;
};
export type IrrigationRate = {
  id: string; season_id?: string | null; crop?: string | null;
  rate_per_decimal: number; effective_from?: string | null; effective_to?: string | null;
};
export type Asset = {
  id: string; name: string; category?: string | null; serial_no?: string | null;
  purchase_date?: string | null; cost?: number | null; status?: string | null; office_id?: string | null;
};

export const LandsApi = {
  list: (params: { farmer_id?: string; q?: string; page?: number; per_page?: number } = {}) =>
    api.get<Paginated<Land>>("/lands", { params }).then(r => r.data),
  create: (p: Partial<Land>) => api.post<Land>("/lands", p).then(r => r.data),
  update: (id: string, p: Partial<Land>) => api.put<Land>(`/lands/${id}`, p).then(r => r.data),
  delete: (id: string) => api.delete(`/lands/${id}`).then(r => r.data),
};

export const SeasonsApi = {
  list: () => api.get<Season[]>("/seasons").then(r => r.data),
  create: (p: Partial<Season>) => api.post<Season>("/seasons", p).then(r => r.data),
  update: (id: string, p: Partial<Season>) => api.put<Season>(`/seasons/${id}`, p).then(r => r.data),
  activate: (id: string) => api.post(`/seasons/${id}/activate`).then(r => r.data),
};

export const LoanPlansApi = {
  list: () => api.get<LoanPlan[]>("/loan-plans").then(r => r.data),
  create: (p: Partial<LoanPlan>) => api.post<LoanPlan>("/loan-plans", p).then(r => r.data),
  update: (id: string, p: Partial<LoanPlan>) => api.put<LoanPlan>(`/loan-plans/${id}`, p).then(r => r.data),
  delete: (id: string) => api.delete(`/loan-plans/${id}`).then(r => r.data),
};

export const IrrigationRatesApi = {
  list: (params: { season_id?: string } = {}) =>
    api.get<IrrigationRate[]>("/irrigation-rates", { params }).then(r => r.data),
  create: (p: Partial<IrrigationRate>) => api.post<IrrigationRate>("/irrigation-rates", p).then(r => r.data),
  update: (id: string, p: Partial<IrrigationRate>) => api.put<IrrigationRate>(`/irrigation-rates/${id}`, p).then(r => r.data),
  delete: (id: string) => api.delete(`/irrigation-rates/${id}`).then(r => r.data),
};

export const AssetsApi = {
  list: (params: { q?: string; page?: number; per_page?: number } = {}) =>
    api.get<Paginated<Asset>>("/assets", { params }).then(r => r.data),
  create: (p: Partial<Asset>) => api.post<Asset>("/assets", p).then(r => r.data),
  update: (id: string, p: Partial<Asset>) => api.put<Asset>(`/assets/${id}`, p).then(r => r.data),
};
