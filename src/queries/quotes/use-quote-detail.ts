import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QuotesService, type SavedQuoteStatus } from "../../modules/quotes/services/quotes.service";

const quoteDetailKeys = {
  all: ["quotes", "detail"] as const,
  byId: (quoteId: string) => [...quoteDetailKeys.all, quoteId] as const,
};

export const useQuoteDetail = (quoteId?: string) => {
  return useQuery({
    queryKey: quoteId ? quoteDetailKeys.byId(quoteId) : ["quotes", "detail", "disabled"],
    queryFn: () => QuotesService.getById(quoteId!),
    enabled: Boolean(quoteId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
};

export const useUpdateQuoteStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: SavedQuoteStatus }) =>
      QuotesService.updateStatus(quoteId, status),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};

export const useGenerateQuoteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId }: { quoteId: string }) => QuotesService.generateOrder(quoteId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};
