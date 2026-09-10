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
  | "QUOTE_SENT";

export interface WhatsAppRealtimeEvent {
  type: "WHATSAPP_CONVERSATION_CHANGED";
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
    "mode" | "handledByName" | "lastMessage" | "lastMessageAt" | "lastInboundAt"
  >>;
}

export type WhatsAppRealtimeStatus = "connecting" | "connected" | "disconnected";

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
    this.options.onStatusChange?.("connecting");
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, "View closed");
    this.socket = null;
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    const token = getAuthToken();
    if (!token) {
      this.options.onStatusChange?.("disconnected");
      return;
    }

    try {
      this.options.onStatusChange?.("connecting");
      const socket = new WebSocket(this.buildUrl(), ["tuvansa-realtime", `auth.${token}`]);
      this.socket = socket;
      socket.onopen = () => {
        const isReconnect = this.connectedOnce;
        this.connectedOnce = true;
        this.reconnectAttempts = 0;
        this.options.onStatusChange?.("connected");
        if (isReconnect) this.options.onReconnect();
      };
      socket.onmessage = (message) => this.handleMessage(message.data);
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        if (!this.stopped) this.options.onStatusChange?.("disconnected");
        this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      this.options.onStatusChange?.("disconnected");
      this.scheduleReconnect();
    }
  }

  private handleMessage(payload: unknown): void {
    if (typeof payload !== "string") return;
    try {
      const event = JSON.parse(payload) as Partial<WhatsAppRealtimeEvent>;
      if (
        event.type === "WHATSAPP_CONVERSATION_CHANGED"
        && typeof event.conversationId === "string"
        && typeof event.reason === "string"
      ) {
        const realtimeEvent = event as WhatsAppRealtimeEvent;
        window.dispatchEvent(new CustomEvent("tuvansa:whatsapp-realtime", { detail: realtimeEvent }));
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
}
