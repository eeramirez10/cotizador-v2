import type {
  NotificationId,
  NotificationLevel,
  NotificationOptions,
} from "./notifier";

export interface MuiNotificationItem {
  id: NotificationId;
  level: NotificationLevel;
  message: string;
  durationMs: number | null;
  loading: boolean;
  revision: number;
  action?: NotificationOptions["action"];
  presentation?: NotificationOptions["presentation"];
}

type Listener = () => void;

let sequence = 0;
let items: MuiNotificationItem[] = [];
const listeners = new Set<Listener>();

const emit = (): void => listeners.forEach((listener) => listener());

export const nextNotificationId = (): NotificationId => {
  sequence += 1;
  return `notification-${Date.now()}-${sequence}`;
};

export const enqueueMuiNotification = (
  level: NotificationLevel,
  message: string,
  options?: NotificationOptions,
  loading = false,
): NotificationId => {
  const id = options?.id ?? nextNotificationId();
  const existing = items.find((item) => item.id === id);
  const next: MuiNotificationItem = {
    id,
    level,
    message,
    durationMs: loading ? null : options?.durationMs ?? 3_500,
    loading,
    revision: (existing?.revision ?? 0) + 1,
    action: options?.action,
    presentation: options?.presentation,
  };
  items = existing
    ? items.map((item) => item.id === id ? next : item)
    : [...items, next];
  emit();
  return id;
};

export const updateMuiNotification = (
  id: NotificationId,
  level: NotificationLevel,
  message: string,
  options?: NotificationOptions,
): void => {
  const existing = items.find((item) => item.id === id);
  if (!existing) {
    enqueueMuiNotification(level, message, { ...options, id });
    return;
  }
  items = items.map((item) => item.id === id
    ? {
      ...item,
      level,
      message,
      loading: false,
      durationMs: options?.durationMs ?? 2_800,
      revision: item.revision + 1,
      action: options?.action,
      presentation: options?.presentation,
    }
    : item);
  emit();
};

export const dismissMuiNotification = (id: NotificationId): void => {
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
};

export const subscribeMuiNotifications = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getMuiNotificationsSnapshot = (): MuiNotificationItem[] => items;
