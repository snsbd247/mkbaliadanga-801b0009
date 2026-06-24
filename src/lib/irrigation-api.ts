/**
 * Irrigation module API wrapper (Laravel backend).
 * Guard calls with `isLaravelMode()`; Supabase remains the default in preview.
 */
import { apiClient, type Paginated } from "@/lib/api-client";

export type IrrigationInvoice = {
  id: string;
  office_id: string | null;
  farmer_id: string | null;
  season_id?: string | null;
  invoice_no?: string | null;
  amount: number;
  maintenance: number;
  canal: number;
  delay_fee: number;
  paid: number;
  due: number;
  status: string;
  created_at?: string;
};

export type CollectPayload = {
  amount: number;
  delay_fee?: number;
  method?: string;
  paid_at?: string;
};

export const irrigationApi = {
  listInvoices: (params?: Record<string, unknown>) =>
    apiClient.get<Paginated<IrrigationInvoice>>("/irrigation/invoices", params),
  getInvoice: (id: string) => apiClient.get<IrrigationInvoice>(`/irrigation/invoices/${id}`),
  createInvoice: (payload: Partial<IrrigationInvoice>) =>
    apiClient.post<IrrigationInvoice>("/irrigation/invoices", payload),
  collect: (invoiceId: string, payload: CollectPayload) =>
    apiClient.post<{ receipt_no: string; invoice: IrrigationInvoice }>(
      `/irrigation/invoices/${invoiceId}/collect`,
      payload,
    ),
};
