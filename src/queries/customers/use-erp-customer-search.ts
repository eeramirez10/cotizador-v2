import { useQuery } from "@tanstack/react-query";
import { ErpCustomersService } from "../../modules/clients/services/erp-customers.service";

export const useErpCustomerSearch = (term: string, enabled = true) => {
  return useQuery({
    queryKey: ["erp-customers", "search", term],
    queryFn: ({ signal }) => ErpCustomersService.searchByTerm(term, signal),
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
};
