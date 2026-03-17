import { useQuery } from "@tanstack/react-query";
import { ErpUsersService } from "../../modules/users/services/erp-users.service";

export const useErpUserSearch = (term: string, enabled = true) => {
  return useQuery({
    queryKey: ["erp-users", "search", term],
    queryFn: ({ signal }) => ErpUsersService.search(term, signal),
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
};
