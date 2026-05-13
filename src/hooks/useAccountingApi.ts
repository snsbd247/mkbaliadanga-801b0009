import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountsApi, JournalsApi, JournalLine } from "@/lib/api/accounting";

export const useAccounts = () =>
  useQuery({ queryKey: ["api", "accounts"], queryFn: AccountsApi.list });

export const useCreateAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AccountsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "accounts"] }),
  });
};

export const useJournals = (params: { from?: string; to?: string; per_page?: number; page?: number } = {}) =>
  useQuery({ queryKey: ["api", "journals", params], queryFn: () => JournalsApi.list(params) });

export const useCreateJournal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { entry_date: string; memo?: string; reference?: string; lines: JournalLine[] }) =>
      JournalsApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api", "journals"] }),
  });
};
