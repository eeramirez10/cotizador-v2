import { AttachmentsService } from "../../attachments/services/attachments.service";
import { QuoteExtractionJobsService } from "../../quote-extraction/services/quote-extraction-jobs.service";
import type { ExtractionJobResultPayload, ExtractionJobStatusResponse } from "../../quote-extraction/types/quote-extraction-job.types";
import type { WhatsAppInboundAttachment } from "./whatsapp-inbox.service";
import { WhatsAppInboxService } from "./whatsapp-inbox.service";

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".xls", ".xlsx"]);
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const extensionOf = (name: string): string => name.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] || "";

export class WhatsAppQuoteExtractionService {
  static supports(attachment: WhatsAppInboundAttachment): boolean {
    const mimeType = attachment.mimeType.toLowerCase().split(";", 1)[0].trim();
    return SUPPORTED_EXTENSIONS.has(extensionOf(attachment.originalName))
      || SUPPORTED_MIME_TYPES.has(mimeType);
  }

  static async extract(
    attachment: WhatsAppInboundAttachment,
    clientDraftId: string,
    onStatus?: (status: ExtractionJobStatusResponse) => void,
  ): Promise<ExtractionJobResultPayload> {
    if (!this.supports(attachment)) {
      throw new Error("La extracción de partidas admite archivos PDF, XLS y XLSX.");
    }

    const blob = await WhatsAppInboxService.attachmentBlob(attachment.id);
    const file = new File([blob], attachment.originalName, {
      type: attachment.mimeType || blob.type || "application/octet-stream",
    });
    const linkedAttachment = await AttachmentsService.uploadQuoteSource(clientDraftId, file);

    try {
      const job = await QuoteExtractionJobsService.createJob(file);
      const completed = await QuoteExtractionJobsService.waitForCompletion(job.job_id, { onStatus });
      if (!completed.result) throw new Error("La extracción terminó sin información utilizable.");
      if (completed.result.items.length === 0) throw new Error("No se encontraron partidas para cotizar en el archivo.");
      return completed.result;
    } catch (error) {
      await AttachmentsService.delete(linkedAttachment.id).catch(() => undefined);
      throw error;
    }
  }
}
