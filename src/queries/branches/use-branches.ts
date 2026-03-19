import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateBranchInput,
  BranchesService,
  type UpdateBranchInput,
} from "../../modules/branches/services/branches.service";

const branchesKeys = {
  all: ["branches"] as const,
  list: () => [...branchesKeys.all, "list"] as const,
};

export const useBranchesList = () =>
  useQuery({
    queryKey: branchesKeys.list(),
    queryFn: () => BranchesService.list(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useCreateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBranchInput) => BranchesService.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchesKeys.all, exact: false });
    },
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ branchId, input }: { branchId: string; input: UpdateBranchInput }) =>
      BranchesService.update(branchId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchesKeys.all, exact: false });
    },
  });
};

export const useDeactivateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branchId: string) => BranchesService.deactivate(branchId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchesKeys.all, exact: false });
    },
  });
};
