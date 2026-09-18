import type { NotificationAdapter } from "./notifier";
import {
  dismissMuiNotification,
  enqueueMuiNotification,
  updateMuiNotification,
} from "./mui-notification.store";

export const muiNotificationAdapter: NotificationAdapter = {
  notify: (level, message, options) => {
    enqueueMuiNotification(level, message, options);
  },
  loading: (message, options) => enqueueMuiNotification("info", message, options, true),
  update: (id, level, message, options) => {
    updateMuiNotification(id, level, message, options);
  },
  dismiss: (id) => {
    dismissMuiNotification(id);
  },
};
