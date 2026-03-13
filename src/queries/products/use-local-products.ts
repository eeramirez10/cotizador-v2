import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LocalProductsService,
  type ListLocalProductsParams,
  type UpdateLocalProductInput,
} from "../../modules/products/services/local-products.service";

const localProductsKeys = {
  all: ["local-products"] as const,
  list: (
    params: Required<Pick<ListLocalProductsParams, "page" | "pageSize">> &
      Pick<ListLocalProductsParams, "search" | "status">
  ) =>
    [...localProductsKeys.all, "list", params] as const,
};

export const useLocalProducts = (params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
}) => {
  return useQuery({
    queryKey: localProductsKeys.list(params),
    queryFn: () => LocalProductsService.list(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
};

export const useUpdateLocalProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: UpdateLocalProductInput }) =>
      LocalProductsService.updateById(productId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: localProductsKeys.all, exact: false });
    },
  });
};

export const useDeleteLocalProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => LocalProductsService.deleteById(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: localProductsKeys.all, exact: false });
    },
  });
};
