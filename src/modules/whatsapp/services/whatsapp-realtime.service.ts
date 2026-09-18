import { envs } from "../../../config/envs";
import { getAuthToken } from "../../../store/auth/auth.store";
import type {
  WhatsAppInboxConversation,
  WhatsAppInboxMessage,
} from "./whatsapp-inbox.service";

export type WhatsAppRealtimeEventReason =
  | "MESSAGE_RECEIVED"
  | "MESSAGE_SENT"
  | "MESSAGE_STATUS_CHANGED"
  | "CONVERSATION_MODE_CHANGED"
  | "LEAD_UPDATED"
  | "LEAD_ASSIGNED"
  | "LEAD_CONVERTED"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "QUOTE_REJECTED"
  | "QUOTE_CANCELLED"
  | "CUSTOMER_INFORMATION_REQUESTED"
  | "CUSTOMER_CHANGE_REQUESTED"
  | "CONVERSATION_DELETED";

export interface QuoteCustomerDecisionRealtimePayload {
  quoteId: string;
  quoteNumber: string;
  status: "APPROVED" | "REJECTED" | "CANCELLED";
  customerName: string;
  contactName: string;
  sellerId: string;
  branchId: string;
  currency: "MXN" | "USD";
  total: number;
}

export interface QuoteCustomerRequestRealtimePayload {
  requestId: string;
  requestType: "INFORMATION" | "MODIFICATION";
  quoteId: string;
  quoteNumber: string;
  sellerId: string;
  branchId: string;
  detail: string;
}

export interface WhatsAppRealtimeEvent {
  type: "WHATSAPP_CONVERSATION_CHANGED" | "QUOTE_CUSTOMER_DECISION" | "QUOTE_CUSTOMER_REQUEST";
  conversationId: string;
  reason: WhatsAppRealtimeEventReason;
  occurredAt: string;
  message?: WhatsAppInboxMessage;
  messagePatch?: {
    id: string;
    status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  };
  conversation?: Partial<Pick<
    WhatsAppInboxConversation,
    "mode" | "handledByName" | "lastMessage" | "lastMessageAt" | "lastInboundAt" | "sellerName" | "customerName" | "contactName" | "lead"
  >>;
  deleted?: boolean;
  quoteDecision?: QuoteCustomerDecisionRealtimePayload;
  customerRequest?: QuoteCustomerRequestRealtimePayload;
}

export type WhatsAppRealtimeStatus = "connecting" | "connected" | "disconnected";

export const WHATSAPP_REALTIME_EVENT_NAME = "tuvansa:whatsapp-realtime";
export const WHATSAPP_REALTIME_STATUS_EVENT_NAME = "tuvansa:whatsapp-realtime-status";
export const WHATSAPP_REALTIME_RECONNECTED_EVENT_NAME = "tuvansa:whatsapp-realtime-reconnected";

let currentRealtimeStatus: WhatsAppRealtimeStatus = "disconnected";

export const getWhatsAppRealtimeStatus = (): WhatsAppRealtimeStatus => currentRealtimeStatus;

const publishRealtimeStatus = (status: WhatsAppRealtimeStatus): void => {
  currentRealtimeStatus = status;
  window.dispatchEvent(new CustomEvent(WHATSAPP_REALTIME_STATUS_EVENT_NAME, { detail: status }));
};

interface WhatsAppRealtimeClientOptions {
  onEvent: (event: WhatsAppRealtimeEvent) => void;
  onReconnect: () => void;
  onStatusChange?: (status: WhatsAppRealtimeStatus) => void;
}

export class WhatsAppRealtimeClient {
  private readonly options: WhatsAppRealtimeClientOptions;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private connectedOnce = false;
  private stopped = false;

  constructor(options: WhatsAppRealtimeClientOptions) {
    this.options = options;
  }

  start(): void {
    this.stopped = false;
    this.updateStatus("connecting");
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, "View closed");
    this.socket = null;
    this.updateStatus("disconnected");
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    const token = getAuthToken();
    if (!token) {
      this.updateStatus("disconnected");
      return;
    }

    try {
      this.updateStatus("connecting");
      const socket = new WebSocket(this.buildUrl(), ["tuvansa-realtime", `auth.${token}`]);
      this.socket = socket;
      socket.onopen = () => {
        const isReconnect = this.connectedOnce;
        this.connectedOnce = true;
        this.reconnectAttempts = 0;
        this.updateStatus("connected");
        if (isReconnect) {
          window.dispatchEvent(new Event(WHATSAPP_REALTIME_RECONNECTED_EVENT_NAME));
          this.options.onReconnect();
        }
      };
      socket.onmessage = (message) => this.handleMessage(message.data);
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        if (!this.stopped) this.updateStatus("disconnected");
        this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      this.updateStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private handleMessage(payload: unknown): void {
    if (typeof payload !== "string") return;
    try {
      const event = JSON.parse(payload) as Partial<WhatsAppRealtimeEvent>;
      if (
        ["WHATSAPP_CONVERSATION_CHANGED", "QUOTE_CUSTOMER_DECISION", "QUOTE_CUSTOMER_REQUEST"].includes(event.type || "")
        && typeof event.conversationId === "string"
        && typeof event.reason === "string"
      ) {
        const realtimeEvent = event as WhatsAppRealtimeEvent;
        window.dispatchEvent(new CustomEvent(WHATSAPP_REALTIME_EVENT_NAME, { detail: realtimeEvent }));
        this.options.onEvent(realtimeEvent);
      }
    } catch {
      // Ignore malformed events and keep the realtime connection alive.
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private buildUrl(): string {
    const url = new URL(envs.CORE_API_URL || window.location.origin, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/$/, "")}/api/whatsapp/realtime`.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  private updateStatus(status: WhatsAppRealtimeStatus): void {
    publishRealtimeStatus(status);
    this.options.onStatusChange?.(status);
  }
}
