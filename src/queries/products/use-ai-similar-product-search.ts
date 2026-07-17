import { useQuery } from "@tanstack/react-query";
import { AiSimilarProductsService } from "../../modules/ai/services/ai-similar-products.service";
import type { AiSimilarProductsEngine } from "../../modules/ai/types/ai-similar-product.types";

export const useAiSimilarProductSearch = (
  term: string,
  branchCode: string,
  engine: AiSimilarProductsEngine,
  enabled = true,
) => {
  return useQuery({
    queryKey: ["ai-products", "similar", engine, branchCode, term],
    queryFn: ({ signal }) =>
      AiSimilarProductsService.search(
        {
          query: term,
          branchCode,
          engine,
        },
        signal,
      ),
    enabled,
    staleTime: 20_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
