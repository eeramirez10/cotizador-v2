import { useQuery } from "@tanstack/react-query";
import { AiSimilarProductsService } from "../../modules/ai/services/ai-similar-products.service";

export const useAiSimilarProductSearch = (term: string, branchCode: string, enabled = true) => {
  return useQuery({
    queryKey: ["ai-products", "similar", branchCode, term],
    queryFn: ({ signal }) =>
      AiSimilarProductsService.search(
        {
          query: term,
          branchCode,
        },
        signal,
      ),
    enabled,
    staleTime: 20_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
