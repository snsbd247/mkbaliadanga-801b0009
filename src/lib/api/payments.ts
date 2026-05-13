import { api, Paginated } from "./client";

export type PaymentAllocation = {
  target_type: "loan" | "savings" | "irrigation_invoice";
  target_id: string;
  amount: number;
};

export type Payment = {
  id: string;
  farmer_id: string;
  amount: number;
  method: "cash" | "bank" | "mobile" | "cheque";
  reference?: string | null;
  receipt_no?: string | null;
  occurred_at: string;
  allocations?: PaymentAllocation[];
  created_at?: string;
};

export async function listPayments(params: { q?: string; farmer_id?: string; from?: string; to?: string; page?: number; per_page?: number } = {}): Promise<Paginated<Payment>> {
  const { data } = await api.get("/payments", { params });
  return data;
}

export async function getPayment(id: string): Promise<Payment> {
  const { data } = await api.get(`/payments/${id}`);
  return data.data ?? data;
}

export async function createPayment(payload: {
  farmer_id: string;
  amount: number;
  method: Payment["method"];
  reference?: string;
  occurred_at?: string;
  allocations: PaymentAllocation[];
}): Promise<Payment> {
  const { data } = await api.post("/payments", payload);
  return data.data ?? data;
}

export async function deletePayment(id: string): Promise<void> {
  await api.delete(`/payments/${id}`);
}
