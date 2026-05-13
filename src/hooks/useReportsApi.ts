import { useQuery } from "@tanstack/react-query";
import { ReportsApi, DateRange } from "@/lib/api/reports";

export const useTrialBalance = (p: DateRange) =>
  useQuery({ queryKey: ["api", "reports", "tb", p], queryFn: () => ReportsApi.trialBalance(p) });

export const useProfitAndLoss = (p: DateRange) =>
  useQuery({ queryKey: ["api", "reports", "pl", p], queryFn: () => ReportsApi.profitAndLoss(p) });

export const useBalanceSheet = (p: { as_of?: string }) =>
  useQuery({ queryKey: ["api", "reports", "bs", p], queryFn: () => ReportsApi.balanceSheet(p) });

export const useCashbook = (p: DateRange) =>
  useQuery({ queryKey: ["api", "reports", "cb", p], queryFn: () => ReportsApi.cashbook(p) });
