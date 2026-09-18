import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type WhatsAppConversationMode = "AI" | "HUMAN";
export type WhatsAppLeadStatus = "NEW" | "COLLECTING_INFORMATION" | "PENDING_ASSIGNMENT" | "ASSIGNED" | "CONVERTED" | "DISCARDED";
export type WhatsAppMessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";

export interface WhatsAppQuoteContext {
  id: string;
  quoteNumber: string;
  status: string;
}

export interface WhatsAppRelatedQuote extends WhatsAppQuoteContext {
  currency: "MXN" | "USD";
  total: number;
  revisionNumber: number;
  rootQuoteId: string | null;
  previousVersionId: string | null;
  sellerName: string;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface WhatsAppRelatedQuoteList {
  items: WhatsAppRelatedQuote[];
  total: number;
}

export interface WhatsAppInboxConversation {
  id: string;
  participantType: "CUSTOMER" | "INTERNAL_USER" | "UNKNOWN";
  participantPhone: string;
  customerId: string | null;
  customerName: string;
  contactId: string | null;
  contactName: string | null;
  sellerName: string | null;
  quote: WhatsAppQuoteContext | null;
  lead: {
    id: string;
    status: WhatsAppLeadStatus;
    contactName: string | null;
    companyName: string | null;
    email: string | null;
    location: string | null;
    requestSummary: string | null;
    assignedSellerId: string | null;
    assignedSellerName: string | null;
    assignedBranchId: string | null;
    assignedBranchName: string | null;
    assignedAt: string | null;
    customerId: string | null;
    convertedByUserId: string | null;
    convertedAt: string | null;
  } | null;
  mode: WhatsAppConversationMode;
  handledByName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastInboundAt: string | null;
  unreadCount: number;
}

export interface WhatsAppInboxMessage {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  authorType: "CUSTOMER" | "AI" | "USER" | "SYSTEM";
  authorName: string;
  body: string;
  messageType: "TEXT" | "QUOTE_DOCUMENT";
  status: WhatsAppMessageStatus;
  occurredAt: string;
  quote: WhatsAppQuoteContext | null;
  fileAssetId: string | null;
  attachments: WhatsAppInboundAttachment[];
}

export interface WhatsAppInboundAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  quoteExtractedAt: string | null;
  quoteExtractionCount: number;
  quoteExtractedByUserId: string | null;
  quoteExtractedByName: string | null;
  lastQuoteDraftId: string | null;
}

export interface WhatsAppConversationPage {
  items: WhatsAppInboxConversation[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface WhatsAppMessagePage {
  items: WhatsAppInboxMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DeleteWhatsAppConversationResult {
  conversationId: string;
  deletedProspect: boolean;
  deletedFileCount: number;
  failedFileCount: number;
  preservedQuoteCount: number;
  preservedQuoteFileCount: number;
}

const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const mapError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
    return new Error(error.response.data.error);
  }
  return error instanceof Error ? error : new Error(fallback);
};

export class WhatsAppInboxService {
  static async deleteConversation(conversationId: string): Promise<DeleteWhatsAppConversationResult> {
    try {
      const { data } = await coreHttpClient.delete<DeleteWhatsAppConversationResult>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}`,
        { headers: headers() },
      );
      window.dispatchEvent(new CustomEvent("tuvansa:whatsapp-conversation-deleted", {
        detail: { conversationId },
      }));
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo eliminar la conversación.");
    }
  }

  static async markAttachmentQuoteExtracted(
    attachmentId: string,
    clientDraftId: string,
  ): Promise<WhatsAppInboundAttachment> {
    try {
      const { data } = await coreHttpClient.post<WhatsAppInboundAttachment>(
        `/api/whatsapp/attachments/${encodeURIComponent(attachmentId)}/quote-extractions`,
        { clientDraftId },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo registrar que el archivo fue procesado.");
    }
  }

  static async attachmentBlob(attachmentId: string): Promise<Blob> {
    try {
      const response = await coreHttpClient.get<Blob>(
        `/api/whatsapp/attachments/${encodeURIComponent(attachmentId)}/download`,
        { headers: headers(), responseType: "blob" },
      );
      return response.data;
    } catch (error) {
      throw mapError(error, "No se pudo abrir el archivo recibido por WhatsApp.");
    }
  }

  static async downloadAttachment(attachment: WhatsAppInboundAttachment): Promise<void> {
    const blob = await this.attachmentBlob(attachment.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.originalName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  static async list(params: { query?: string; cursor?: string; pageSize?: number } = {}): Promise<WhatsAppConversationPage> {
    try {
      const { data } = await coreHttpClient.get<WhatsAppConversationPage>("/api/whatsapp", {
        headers: headers(),
        params: {
          search: params.query?.trim() || undefined,
          cursor: params.cursor || undefined,
          pageSize: params.pageSize || 30,
        },
      });
      return data;
    } catch (error) {
      throw mapError(error, "No se pudieron cargar las conversaciones.");
    }
  }

  static async get(conversationId: string): Promise<WhatsAppInboxConversation> {
    try {
      const { data } = await coreHttpClient.get<WhatsAppInboxConversation>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}`,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo cargar la conversación.");
    }
  }

  static async messages(
    conversationId: string,
    options: { cursor?: string; after?: string; pageSize?: number } = {},
  ): Promise<WhatsAppMessagePage> {
    try {
      const { data } = await coreHttpClient.get<WhatsAppMessagePage>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/messages`,
        {
          headers: headers(),
          params: {
            cursor: options.cursor || undefined,
            after: options.after || undefined,
            pageSize: options.pageSize || 60,
          },
        },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudieron cargar los mensajes.");
    }
  }

  static async quotes(conversationId: string): Promise<WhatsAppRelatedQuoteList> {
    try {
      const { data } = await coreHttpClient.get<WhatsAppRelatedQuoteList>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/quotes`,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudieron cargar las cotizaciones de la conversación.");
    }
  }

  static async send(conversationId: string, body: string, clientMessageId: string): Promise<void> {
    try {
      await coreHttpClient.post(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/messages`,
        { body, clientMessageId },
        { headers: headers() },
      );
    } catch (error) {
      throw mapError(error, "No se pudo enviar el mensaje.");
    }
  }

  static async markRead(conversationId: string): Promise<void> {
    try {
      await coreHttpClient.patch(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/read`,
        {},
        { headers: headers() },
      );
      window.dispatchEvent(new CustomEvent("tuvansa:whatsapp-conversation-read", {
        detail: { conversationId },
      }));
    } catch (error) {
      throw mapError(error, "No se pudo marcar la conversación como leída.");
    }
  }

  static async setMode(conversationId: string, mode: WhatsAppConversationMode): Promise<WhatsAppInboxConversation> {
    try {
      const { data } = await coreHttpClient.patch<WhatsAppInboxConversation>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/mode`,
        { mode },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo cambiar el modo de atención.");
    }
  }

  static async assignLead(conversationId: string, sellerId: string): Promise<WhatsAppInboxConversation> {
    try {
      const { data } = await coreHttpClient.patch<WhatsAppInboxConversation>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/lead-assignment`,
        { sellerId },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo asignar el prospecto.");
    }
  }

  static async convertLead(
    conversationId: string,
    customerId: string,
    customerContactId: string | null,
  ): Promise<WhatsAppInboxConversation> {
    try {
      const { data } = await coreHttpClient.patch<WhatsAppInboxConversation>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/lead-conversion`,
        { customerId, customerContactId },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo convertir el prospecto en cliente.");
    }
  }
}
