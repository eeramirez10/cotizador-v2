import type { WhatsAppRealtimeStatus } from "../../whatsapp/services/whatsapp-realtime.service";

export type AppNotificationSource = "WHATSAPP" | "QUOTE" | "SYSTEM";
export type AppNotificationKind =
  | "MESSAGE"
  | "QUOTE_ACCEPTED"
  | "QUOTE_REJECTED"
  | "QUOTE_CANCELLED"
  | "CUSTOMER_INFORMATION_REQUESTED"
  | "CUSTOMER_CHANGE_REQUESTED"
  | "CUSTOMER_ONBOARDING_ERP_LINKED";

export interface AppNotification {
  id: string;
  source: AppNotificationSource;
  sourceId: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  occurredAt: string;
  unreadCount: number;
  href: string;
}

export interface AppNotificationsContextValue {
  enabled: boolean;
  inboxEnabled: boolean;
  loading: boolean;
  items: AppNotification[];
  unreadCount: number;
  realtimeStatus: WhatsAppRealtimeStatus;
  refresh: () => Promise<void>;
  markRead: (notification: AppNotification) => Promise<void>;
}
