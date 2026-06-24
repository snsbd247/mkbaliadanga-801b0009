/**
 * Savings & Loans module API wrappers (Laravel backend).
 * Guard calls with `isLaravelMode()`; Supabase remains the default in preview.
 */
import { apiClient, type Paginated } from "@/lib/api-client";

export type SavingsTransaction = {
  id: string;
  office_id: string | null;
  farmer_id: string | null;
  plan_id?: string | null;
  type: "deposit" | "withdraw";
  amount: number;
  receipt_no?: string | null;
  txn_date?: string | null;
  created_at?: string;
};

export const savingsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<Paginated<SavingsTransaction>>("/savings/transactions", params),
  create: (payload: Partial<SavingsTransaction>) =>
    apiClient.post<SavingsTransaction>("/savings/transactions", payload),
};

export type Loan = {
  id: string;
  office_id: string | null;
  farmer_id: string | null;
  loan_no?: string | null;
  principal: number;
  interest_rate: number;
  paid: number;
  outstanding: number;
  status: string;
  created_at?: string;
};

export const loansApi = {
  list: (params?: Record<string, unknown>) => apiClient.get<Paginated<Loan>>("/loans", params),
  get: (id: string) => apiClient.get<Loan>(`/loans/${id}`),
  create: (payload: Partial<Loan>) => apiClient.post<Loan>("/loans", payload),
  collect: (loanId: string, payload: { amount: number; principal_part?: number; interest_part?: number; paid_at?: string }) =>
    apiClient.post<{ receipt_no: string; loan: Loan }>(`/loans/${loanId}/collect`, payload),
};
