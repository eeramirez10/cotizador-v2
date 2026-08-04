import { useQuery } from "@tanstack/react-query";
import { ErpProductsService } from "../../modules/products/services/erp-products.service";

export const useErpProductSearch = (
  term: string,
  branchId: string,
  enabled = true,
  scope: "all" | "branch" = "all",
) => {
  return useQuery({
    queryKey: ["erp-products", scope, branchId, term],
    queryFn: ({ signal }) => scope === "branch"
      ? ErpProductsService.searchByTerm(term, branchId, signal)
      : ErpProductsService.searchAuthorized(term, signal),
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
};
