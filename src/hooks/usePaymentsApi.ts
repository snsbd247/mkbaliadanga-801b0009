import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPayment, deletePayment, getPayment, listPayments } from "@/lib/api/payments";

const KEY = ["api", "payments"] as const;

export function usePaymentsList(params: Parameters<typeof listPayments>[0] = {}) {
  return useQuery({ queryKey: [...KEY, "list", params], queryFn: () => listPayments(params), staleTime: 15_000 });
}
export function usePayment(id: string | undefined) {
  return useQuery({ queryKey: [...KEY, "one", id], queryFn: () => getPayment(id!), enabled: !!id });
}
export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: createPayment, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: deletePayment, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
