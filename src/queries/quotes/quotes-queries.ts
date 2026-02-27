import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { QuotesService } from "../../modules/quotes/services/quotes.service";

const quotesKeys = {
  all: ["quotes"] as const,
  list: (params: { page: number; pageSize: number }) => [...quotesKeys.all, "list", params] as const,
};

export const useQuotes = (params: { page: number; pageSize: number }) => {
  return useQuery({
    queryKey: quotesKeys.list(params),
    queryFn: () => QuotesService.list(params),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
};
