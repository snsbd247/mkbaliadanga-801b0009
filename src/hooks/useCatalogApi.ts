import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LandsApi, SeasonsApi, LoanPlansApi, IrrigationRatesApi, AssetsApi,
  Land, Season, LoanPlan, IrrigationRate, Asset,
} from "@/lib/api/catalog";

const inv = (qc: ReturnType<typeof useQueryClient>, key: string) =>
  qc.invalidateQueries({ queryKey: ["api", key] });

// Lands
export const useLands = (params: { farmer_id?: string; q?: string; page?: number; per_page?: number } = {}) =>
  useQuery({ queryKey: ["api", "lands", params], queryFn: () => LandsApi.list(params) });

export const useCreateLand = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: Partial<Land>) => LandsApi.create(p), onSuccess: () => inv(qc, "lands") });
};
export const useUpdateLand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<Land>) => LandsApi.update(id, p),
    onSuccess: () => inv(qc, "lands"),
  });
};
export const useDeleteLand = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: LandsApi.delete, onSuccess: () => inv(qc, "lands") });
};

// Seasons
export const useSeasons = () => useQuery({ queryKey: ["api", "seasons"], queryFn: SeasonsApi.list });
export const useCreateSeason = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: Partial<Season>) => SeasonsApi.create(p), onSuccess: () => inv(qc, "seasons") });
};
export const useUpdateSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<Season>) => SeasonsApi.update(id, p),
    onSuccess: () => inv(qc, "seasons"),
  });
};
export const useActivateSeason = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: SeasonsApi.activate, onSuccess: () => inv(qc, "seasons") });
};

// Loan Plans
export const useLoanPlans = () => useQuery({ queryKey: ["api", "loanPlans"], queryFn: LoanPlansApi.list });
export const useCreateLoanPlan = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: Partial<LoanPlan>) => LoanPlansApi.create(p), onSuccess: () => inv(qc, "loanPlans") });
};
export const useUpdateLoanPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<LoanPlan>) => LoanPlansApi.update(id, p),
    onSuccess: () => inv(qc, "loanPlans"),
  });
};
export const useDeleteLoanPlan = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: LoanPlansApi.delete, onSuccess: () => inv(qc, "loanPlans") });
};

// Irrigation Rates
export const useIrrigationRates = (params: { season_id?: string } = {}) =>
  useQuery({ queryKey: ["api", "irrigationRates", params], queryFn: () => IrrigationRatesApi.list(params) });
export const useCreateIrrigationRate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: Partial<IrrigationRate>) => IrrigationRatesApi.create(p), onSuccess: () => inv(qc, "irrigationRates") });
};
export const useUpdateIrrigationRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<IrrigationRate>) => IrrigationRatesApi.update(id, p),
    onSuccess: () => inv(qc, "irrigationRates"),
  });
};
export const useDeleteIrrigationRate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: IrrigationRatesApi.delete, onSuccess: () => inv(qc, "irrigationRates") });
};

// Assets
export const useAssets = (params: { q?: string; page?: number; per_page?: number } = {}) =>
  useQuery({ queryKey: ["api", "assets", params], queryFn: () => AssetsApi.list(params) });
export const useCreateAsset = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: Partial<Asset>) => AssetsApi.create(p), onSuccess: () => inv(qc, "assets") });
};
export const useUpdateAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Partial<Asset>) => AssetsApi.update(id, p),
    onSuccess: () => inv(qc, "assets"),
  });
};
