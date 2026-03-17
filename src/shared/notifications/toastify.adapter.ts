import { toast, type ToastOptions } from "react-toastify";
import type { NotificationAdapter, NotificationLevel, NotificationOptions } from "./notifier";

const mapOptions = (options?: NotificationOptions): ToastOptions => ({
  ...(options?.id ? { toastId: options.id } : {}),
  ...(typeof options?.durationMs === "number" ? { autoClose: options.durationMs } : {}),
});

const mapToastType = (level: NotificationLevel): ToastOptions["type"] => {
  if (level === "success") return "success";
  if (level === "error") return "error";
  if (level === "warning") return "warning";
  return "info";
};

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
  loading: (message, options) => {
    const toastOptions = mapOptions(options);
    return toast.loading(message, {
      ...toastOptions,
      autoClose: false,
      closeOnClick: false,
      draggable: false,
    });
  },
  update: (id, level, message, options) => {
    const toastOptions = mapOptions(options);
    toast.update(id, {
      ...toastOptions,
      render: message,
      type: mapToastType(level),
      isLoading: false,
      closeOnClick: true,
      draggable: true,
      autoClose: typeof options?.durationMs === "number" ? options.durationMs : 2800,
    });
  },
  dismiss: (id) => {
    toast.dismiss(id);
  },
};
