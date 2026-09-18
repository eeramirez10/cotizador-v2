import type { WhatsAppRealtimeStatus } from "../../whatsapp/services/whatsapp-realtime.service";

export type AppNotificationSource = "WHATSAPP";

export interface AppNotification {
  id: string;
  source: AppNotificationSource;
  sourceId: string;
  title: string;
  message: string;
  occurredAt: string;
  unreadCount: number;
  href: string;
}

export interface AppNotificationsContextValue {
  enabled: boolean;
  loading: boolean;
  items: AppNotification[];
  unreadCount: number;
  realtimeStatus: WhatsAppRealtimeStatus;
  refresh: () => Promise<void>;
  markRead: (notification: AppNotification) => Promise<void>;
}
