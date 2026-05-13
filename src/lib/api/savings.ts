import { api, Paginated } from "./client";

export type SavingsAccount = {
  id: string;
  farmer_id: string;
  account_no: string;
  balance: number;
  status: "active" | "closed";
  opened_at?: string;
};

export type SavingsTxn = {
  id: string;
  account_id: string;
  type: "deposit" | "withdraw";
  amount: number;
  occurred_at: string;
  note?: string | null;
};

export async function listSavings(params: { q?: string; farmer_id?: string; page?: number; per_page?: number } = {}): Promise<Paginated<SavingsAccount>> {
  const { data } = await api.get("/savings", { params });
  return data;
}
export async function getSavings(id: string): Promise<SavingsAccount & { transactions?: SavingsTxn[] }> {
  const { data } = await api.get(`/savings/${id}`);
  return data.data ?? data;
}
export async function openSavings(payload: { farmer_id: string; opening_balance?: number }): Promise<SavingsAccount> {
  const { data } = await api.post("/savings", payload);
  return data.data ?? data;
}
export async function deposit(id: string, amount: number, note?: string): Promise<SavingsTxn> {
  const { data } = await api.post(`/savings/${id}/deposit`, { amount, note });
  return data.data ?? data;
}
export async function withdraw(id: string, amount: number, note?: string): Promise<SavingsTxn> {
  const { data } = await api.post(`/savings/${id}/withdraw`, { amount, note });
  return data.data ?? data;
}
