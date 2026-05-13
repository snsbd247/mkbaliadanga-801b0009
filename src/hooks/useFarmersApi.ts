import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Farmer, FarmerListParams,
  createFarmer, deleteFarmer, getFarmer, listFarmers, updateFarmer,
} from "@/lib/api/farmers";

const KEY = ["api", "farmers"] as const;

export function useFarmersList(params: FarmerListParams = {}) {
  return useQuery({
    queryKey: [...KEY, "list", params],
    queryFn: () => listFarmers(params),
    staleTime: 30_000,
  });
}

export function useFarmer(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    queryFn: () => getFarmer(id!),
    enabled: !!id,
  });
}

export function useCreateFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Farmer>) => createFarmer(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Farmer> }) => updateFarmer(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFarmer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
