import { createContext, useContext } from "react";
import type { AppNotificationsContextValue } from "../types/app-notification.types";

const defaultValue: AppNotificationsContextValue = {
  enabled: false,
  loading: false,
  items: [],
  unreadCount: 0,
  realtimeStatus: "disconnected",
  refresh: async () => undefined,
  markRead: async () => undefined,
};

export const AppNotificationsContext = createContext<AppNotificationsContextValue>(defaultValue);

export const useAppNotifications = (): AppNotificationsContextValue =>
  useContext(AppNotificationsContext);
