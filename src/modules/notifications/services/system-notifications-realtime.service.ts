import { envs } from "../../../config/envs";
import { getAuthToken } from "../../../store/auth/auth.store";
import type { SystemNotificationRecord } from "./system-notifications.service";

interface SystemNotificationEvent {
  type: "SYSTEM_NOTIFICATION_CREATED";
  occurredAt: string;
  notification: Pick<SystemNotificationRecord, "id" | "type" | "title" | "message" | "targetPath">;
}

export class SystemNotificationsRealtimeClient {
  private readonly onEvent: (event: SystemNotificationEvent) => void;
  private readonly onReconnect: () => void;
  private socket: WebSocket | null = null;
  private timer: number | null = null;
  private attempts = 0;
  private stopped = false;

  constructor(onEvent: (event: SystemNotificationEvent) => void, onReconnect: () => void) {
    this.onEvent = onEvent;
    this.onReconnect = onReconnect;
  }

  start(): void { this.stopped = false; this.connect(); }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close(1000, "View closed");
    this.socket = null;
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    const token = getAuthToken();
    if (!token) return;
    const url = new URL(envs.CORE_API_URL || window.location.origin, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/$/, "")}/api/notifications/realtime`.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";

    try {
      const socket = new WebSocket(url.toString(), ["tuvansa-realtime", `auth.${token}`]);
      this.socket = socket;
      socket.onopen = () => {
        if (this.attempts > 0) this.onReconnect();
        this.attempts = 0;
      };
      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(String(data)) as SystemNotificationEvent;
          if (event.type === "SYSTEM_NOTIFICATION_CREATED" && event.notification?.id) this.onEvent(event);
        } catch { /* Ignore malformed events. */ }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.scheduleReconnect();
      };
    } catch { this.scheduleReconnect(); }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.timer !== null) return;
    const delay = Math.min(1_000 * 2 ** this.attempts, 30_000);
    this.attempts += 1;
    this.timer = window.setTimeout(() => { this.timer = null; this.connect(); }, delay);
  }
}
