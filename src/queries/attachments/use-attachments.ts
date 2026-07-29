import { useQuery } from "@tanstack/react-query";
import { AttachmentsService } from "../../modules/attachments/services/attachments.service";

export const attachmentKeys = {
  all: ["attachments"] as const,
  draft: (id: string) => ["attachments", "draft", id] as const,
  quote: (id: string) => ["attachments", "quote", id] as const,
  requisition: (id: string) => ["attachments", "requisition", id] as const,
};

export const useDraftAttachments = (clientDraftId: string) => useQuery({
  queryKey: attachmentKeys.draft(clientDraftId),
  queryFn: () => AttachmentsService.listQuoteDraft(clientDraftId),
  enabled: Boolean(clientDraftId),
  staleTime: 5_000,
});

export const useQuoteAttachments = (quoteId?: string) => useQuery({
  queryKey: attachmentKeys.quote(quoteId || ""),
  queryFn: () => AttachmentsService.listQuote(quoteId!),
  enabled: Boolean(quoteId),
  staleTime: 5_000,
});

export const useRequisitionAttachments = (requisitionId?: string | null) => useQuery({
  queryKey: attachmentKeys.requisition(requisitionId || ""),
  queryFn: () => AttachmentsService.listPurchaseRequisition(requisitionId!),
  enabled: Boolean(requisitionId),
  staleTime: 5_000,
});
