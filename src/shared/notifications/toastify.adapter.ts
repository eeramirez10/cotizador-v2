import { toast, type ToastOptions } from "react-toastify";
import type { NotificationAdapter, NotificationOptions } from "./notifier";

const mapOptions = (options?: NotificationOptions): ToastOptions => ({
  ...(options?.id ? { toastId: options.id } : {}),
  ...(typeof options?.durationMs === "number" ? { autoClose: options.durationMs } : {}),
});

export const toastifyNotificationAdapter: NotificationAdapter = {
  notify: (level, message, options) => {
    const toastOptions = mapOptions(options);

    if (level === "success") {
      toast.success(message, toastOptions);
      return;
    }

    if (level === "error") {
      toast.error(message, toastOptions);
      return;
    }

    if (level === "warning") {
      toast.warning(message, toastOptions);
      return;
    }

    toast.info(message, toastOptions);
  },
};
