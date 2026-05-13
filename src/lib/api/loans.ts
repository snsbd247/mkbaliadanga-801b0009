import { api, Paginated } from "./client";

export type Loan = {
  id: string;
  farmer_id: string;
  loan_plan_id?: string | null;
  principal: number;
  interest_rate: number;
  tenure_months: number;
  status: "pending" | "approved" | "active" | "closed" | "rejected";
  disbursed_at?: string | null;
  outstanding?: number;
  created_at?: string;
};

export type LoanInstallment = {
  id: string;
  loan_id: string;
  due_date: string;
  principal_due: number;
  interest_due: number;
  paid_amount: number;
  status: "pending" | "partial" | "paid" | "overdue";
};

export async function listLoans(params: { q?: string; status?: string; farmer_id?: string; page?: number; per_page?: number } = {}): Promise<Paginated<Loan>> {
  const { data } = await api.get("/loans", { params });
  return data;
}
export async function getLoan(id: string): Promise<Loan & { installments?: LoanInstallment[] }> {
  const { data } = await api.get(`/loans/${id}`);
  return data.data ?? data;
}
export async function createLoan(payload: Partial<Loan>): Promise<Loan> {
  const { data } = await api.post("/loans", payload);
  return data.data ?? data;
}
export async function approveLoan(id: string): Promise<Loan> {
  const { data } = await api.post(`/loans/${id}/approve`);
  return data.data ?? data;
}
export async function deleteLoan(id: string): Promise<void> {
  await api.delete(`/loans/${id}`);
}

export type LoanPlan = { id: string; name: string; interest_rate: number; tenure_months: number; active: boolean };
export async function listLoanPlans(): Promise<LoanPlan[]> {
  const { data } = await api.get("/loan-plans");
  return data.data ?? data;
}
