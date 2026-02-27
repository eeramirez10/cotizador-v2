import { useQuery } from "@tanstack/react-query";
import { ErpProductsService } from "../../modules/products/services/erp-products.service";

export const useErpProductSearch = (term: string, branchId: string, enabled = true) => {
  return useQuery({
    queryKey: ["erp-products", "search", branchId, term],
    queryFn: ({ signal }) => ErpProductsService.searchByEan(term, branchId, signal),
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
};
