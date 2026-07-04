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
  file_name?: string | null;
  user_name?: string | null;
  total_rows?: number | null;
  skipped?: number | null;
  blocked?: number | null;
  status?: string | null;
};

export type LegacyBatchStatus = {
  exists: boolean;
  record_count: number;
  audit: {
    import_batch_id: string;
    file_name: string | null;
    user_name: string | null;
    total_rows: number;
    inserted: number;
    skipped: number;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
};

export type ImportResult = {
  batch_id: string;
  inserted: number;
  skipped: string[];
  skipped_count: number;
};

export const LegacyIrrigationApi = {
  list: (params: { farmer_code?: string; season?: string; batch?: string }) =>
    api.get<LegacyIrrigationRecord[]>("/legacy-irrigation", { params }).then((r) => r.data),
  batches: () => api.get<LegacyBatch[]>("/legacy-irrigation/batches").then((r) => r.data),
  batchStatus: (batchId: string) =>
    api.get<LegacyBatchStatus>(`/legacy-irrigation/batch/${batchId}/status`).then((r) => r.data),
  import: (
    rows: LegacyIrrigationRow[],
    opts?: {
      batch_id?: string;
      skip_duplicate_receipts?: boolean;
      file_name?: string;
      total_rows?: number;
      final?: boolean;
    },
  ) =>
    api
      .post<ImportResult>("/legacy-irrigation/import", { rows, ...opts })
      .then((r) => r.data),
  deleteBatch: (batchId: string) =>
    api.delete<{ deleted: number }>(`/legacy-irrigation/batch/${batchId}`).then((r) => r.data),
};

