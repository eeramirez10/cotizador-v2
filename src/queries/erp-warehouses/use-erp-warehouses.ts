import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ErpWarehousesService,
  type UpsertErpWarehouseInput,
  type WarehouseAccessMode,
} from "../../modules/erp-warehouses/services/erp-warehouses.service";

const keys = {
  all: ["erp-warehouses"] as const,
  list: () => [...keys.all, "list"] as const,
  branch: (id: string) => [...keys.all, "branch", id] as const,
  user: (id: string) => [...keys.all, "user", id] as const,
};

export const useErpWarehouses = () => useQuery({
  queryKey: keys.list(),
  queryFn: () => ErpWarehousesService.list(true),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
});

export const useBranchWarehouseAccess = (branchId: string) => useQuery({
  queryKey: keys.branch(branchId),
  queryFn: () => ErpWarehousesService.getBranchAccess(branchId),
  enabled: Boolean(branchId),
  refetchOnWindowFocus: false,
});

export const useUserWarehouseAccess = (userId: string) => useQuery({
  queryKey: keys.user(userId),
  queryFn: () => ErpWarehousesService.getUserAccess(userId),
  enabled: Boolean(userId),
  refetchOnWindowFocus: false,
});

export const useCreateErpWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertErpWarehouseInput) => ErpWarehousesService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateErpWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertErpWarehouseInput }) =>
      ErpWarehousesService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useReplaceBranchWarehouseAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, warehouseCodes }: { branchId: string; warehouseCodes: string[] }) =>
      ErpWarehousesService.replaceBranchAccess(branchId, warehouseCodes),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: keys.branch(variables.branchId) }),
  });
};

export const useReplaceUserWarehouseAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accessMode, warehouseCodes }: {
      userId: string;
      accessMode: WarehouseAccessMode;
      warehouseCodes: string[];
    }) => ErpWarehousesService.replaceUserAccess(userId, accessMode, warehouseCodes),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: keys.user(variables.userId) }),
  });
};
