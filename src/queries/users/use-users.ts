import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BranchesService } from "../../modules/branches/services/branches.service";
import {
  type CreateUserInput,
  type ListUsersParams,
  type UpdateUserInput,
  UsersService,
} from "../../modules/users/services/users.service";

const usersKeys = {
  all: ["users"] as const,
  list: (
    params: Required<Pick<ListUsersParams, "page" | "pageSize">> &
      Pick<ListUsersParams, "search" | "branchCode">
  ) => [...usersKeys.all, "list", params] as const,
};

const branchesKeys = {
  all: ["branches"] as const,
  list: () => [...branchesKeys.all, "list"] as const,
};

export const useUsers = (params: {
  page: number;
  pageSize: number;
  search?: string;
  branchCode?: string;
}) => {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => UsersService.list(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
};

export const useBranches = (enabled: boolean) => {
  return useQuery({
    queryKey: branchesKeys.list(),
    queryFn: () => BranchesService.list(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => UsersService.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all, exact: false });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateUserInput }) =>
      UsersService.update(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all, exact: false });
    },
  });
};

export const useDeactivateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => UsersService.deactivate(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all, exact: false });
    },
  });
};
