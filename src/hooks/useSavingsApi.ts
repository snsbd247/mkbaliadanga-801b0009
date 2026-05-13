import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deposit, getSavings, listSavings, openSavings, withdraw } from "@/lib/api/savings";

const KEY = ["api", "savings"] as const;

export function useSavingsList(params: Parameters<typeof listSavings>[0] = {}) {
  return useQuery({ queryKey: [...KEY, "list", params], queryFn: () => listSavings(params), staleTime: 30_000 });
}
export function useSavings(id: string | undefined) {
  return useQuery({ queryKey: [...KEY, "one", id], queryFn: () => getSavings(id!), enabled: !!id });
}
export function useOpenSavings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: openSavings, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) => deposit(id, amount, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) => withdraw(id, amount, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
