import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type WhatsAppConversationMode = "AI" | "HUMAN";
export type WhatsAppMessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";

export interface WhatsAppQuoteContext {
  id: string;
  quoteNumber: string;
  status: string;
}

export interface WhatsAppInboxConversation {
  id: string;
  participantPhone: string;
  customerId: string | null;
  customerName: string;
  contactId: string | null;
  contactName: string | null;
  sellerName: string | null;
  quote: WhatsAppQuoteContext | null;
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

  static async messages(conversationId: string, cursor?: string): Promise<WhatsAppMessagePage> {
    try {
      const { data } = await coreHttpClient.get<WhatsAppMessagePage>(
        `/api/whatsapp/${encodeURIComponent(conversationId)}/messages`,
        {
          headers: headers(),
          params: { cursor: cursor || undefined, pageSize: 60 },
        },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudieron cargar los mensajes.");
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
}
