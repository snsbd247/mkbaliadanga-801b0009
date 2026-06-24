/**
 * Receipts module API wrapper (Laravel backend).
 * Guard calls with `isLaravelMode()`; Supabase remains the default in preview.
 */
import { apiClient, type Paginated } from "@/lib/api-client";

export type Receipt = {
  id: string;
  office_id: string | null;
  farmer_id: string | null;
  payment_id?: string | null;
  receipt_no: string;
  kind: string;
  amount: number;
  payload?: Record<string, unknown> | null;
  is_void: boolean;
  created_at?: string;
};

export type ReceiptListParams = {
  search?: string;
  kind?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
};

export const receiptsApi = {
  list: (params?: ReceiptListParams) => apiClient.get<Paginated<Receipt>>("/receipts", params),
  get: (id: string) => apiClient.get<Receipt>(`/receipts/${id}`),
  void: (id: string) => apiClient.post<{ ok: boolean; receipt: Receipt }>(`/receipts/${id}/void`),
};
