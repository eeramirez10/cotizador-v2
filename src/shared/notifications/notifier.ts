export type NotificationLevel = "success" | "error" | "warning" | "info";

export interface NotificationOptions {
  id?: string;
  durationMs?: number;
}

export interface NotificationAdapter {
  notify: (level: NotificationLevel, message: string, options?: NotificationOptions) => void;
}

const consoleNotificationAdapter: NotificationAdapter = {
  notify: (level, message) => {
    const content = `[${level}] ${message}`;

    if (level === "error") {
      console.error(content);
      return;
    }

    if (level === "warning") {
      console.warn(content);
      return;
    }

    console.info(content);
  },
};

let activeAdapter: NotificationAdapter = consoleNotificationAdapter;

export const configureNotifier = (adapter: NotificationAdapter) => {
  activeAdapter = adapter;
};

const notify = (level: NotificationLevel, message: string, options?: NotificationOptions) => {
  activeAdapter.notify(level, message, options);
};

export const notifier = {
  success: (message: string, options?: NotificationOptions) => notify("success", message, options),
  error: (message: string, options?: NotificationOptions) => notify("error", message, options),
  warning: (message: string, options?: NotificationOptions) => notify("warning", message, options),
  info: (message: string, options?: NotificationOptions) => notify("info", message, options),
};
