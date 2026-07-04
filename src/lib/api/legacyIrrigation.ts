import { api } from "./client";

export type LegacyIrrigationRow = {
  legacy_farmer_code?: string | null;
  farmer_name?: string | null;
  father_name?: string | null;
  village?: string | null;
  mobile_no?: string | null;
  mouza_name?: string | null;
  season_year?: string | null;
  land_shatak?: number | null;
  dag_no?: string | null;
  rate?: number | null;
  owner_id_name?: string | null;
  due_amount?: number | null;
  paid_amount?: number | null;
  owner_type_name?: string | null;
  owner_father_name?: string | null;
  owner_village?: string | null;
  owner_mobile_no?: string | null;
  owner_fid?: string | null;
  receipt_no?: string | null;
  collection_date?: string | null;
};

export type LegacyIrrigationRecord = LegacyIrrigationRow & {
  id: string;
  import_batch_id: string;
  created_at: string;
};

export type LegacyBatch = {
  import_batch_id: string;
  count: number;
  created_at: string;
};

export const LegacyIrrigationApi = {
  list: (params: { farmer_code?: string; season?: string; batch?: string }) =>
    api.get<LegacyIrrigationRecord[]>("/legacy-irrigation", { params }).then((r) => r.data),
  batches: () => api.get<LegacyBatch[]>("/legacy-irrigation/batches").then((r) => r.data),
  import: (rows: LegacyIrrigationRow[]) =>
    api.post<{ batch_id: string; inserted: number }>("/legacy-irrigation/import", { rows }).then((r) => r.data),
  deleteBatch: (batchId: string) =>
    api.delete<{ deleted: number }>(`/legacy-irrigation/batch/${batchId}`).then((r) => r.data),
};
