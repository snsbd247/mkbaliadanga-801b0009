import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveLoan, createLoan, deleteLoan, getLoan, listLoanPlans, listLoans, Loan } from "@/lib/api/loans";

const KEY = ["api", "loans"] as const;

export function useLoansList(params: Parameters<typeof listLoans>[0] = {}) {
  return useQuery({ queryKey: [...KEY, "list", params], queryFn: () => listLoans(params), staleTime: 30_000 });
}
export function useLoan(id: string | undefined) {
  return useQuery({ queryKey: [...KEY, "one", id], queryFn: () => getLoan(id!), enabled: !!id });
}
export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: Partial<Loan>) => createLoan(p), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useApproveLoan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => approveLoan(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteLoan(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useLoanPlans() {
  return useQuery({ queryKey: ["api", "loan-plans"], queryFn: listLoanPlans, staleTime: 5 * 60_000 });
}
