import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QuotesService,
  type QuoteCancellationReason,
  type QuoteRejectionReason,
  type QuoteApprovalReturnReason,
  type QuoteRevisionReason,
  type SavedQuoteStatus,
} from "../../modules/quotes/services/quotes.service";

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
    mutationFn: ({
      quoteId,
      status,
      rejection,
      cancellation,
      approvalReturn,
    }: {
      quoteId: string;
      status: SavedQuoteStatus;
      rejection?: { reason: QuoteRejectionReason; comment?: string };
      cancellation?: { reason: QuoteCancellationReason; comment?: string };
      approvalReturn?: { reason: QuoteApprovalReturnReason; comment?: string };
    }) => QuotesService.updateStatus(quoteId, status, rejection, cancellation, approvalReturn),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};

export const useCreateQuoteRevision = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, reason, comment }: { quoteId: string; reason: QuoteRevisionReason; comment?: string }) =>
      QuotesService.createRevision(quoteId, reason, comment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
    },
  });
};

export const useArchiveQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, reason }: { quoteId: string; reason: string }) => QuotesService.archiveQuote(quoteId, reason),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};

export const useRestoreQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId }: { quoteId: string }) => QuotesService.restoreQuote(quoteId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};

export const useRegisterErpQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, erpQuoteNumber }: { quoteId: string; erpQuoteNumber: string }) =>
      QuotesService.registerErpQuote(quoteId, erpQuoteNumber),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};

export const useDeleteQuotePermanently = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, confirmation, reason }: { quoteId: string; confirmation: string; reason: string }) =>
      QuotesService.deleteQuotePermanently(quoteId, confirmation, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
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

export const useDownloadQuoteOrderFile = () => {
  return useMutation({
    mutationFn: ({ quoteId }: { quoteId: string }) => QuotesService.downloadOrderFile(quoteId),
  });
};

export const useRegisterQuoteDeliveryAttempt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quoteId,
      channel,
      recipient,
      note,
    }: {
      quoteId: string;
      channel: "WHATSAPP" | "EMAIL";
      recipient: string;
      note?: string;
    }) => QuotesService.registerDeliveryAttempt(quoteId, { channel, recipient, note, status: "SENT" }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"], exact: false });
      await queryClient.invalidateQueries({ queryKey: quoteDetailKeys.byId(variables.quoteId), exact: false });
    },
  });
};
