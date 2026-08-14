import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { NotificationCenter } from "../shared/notifications/notification-center";
import { configureNotifier } from "../shared/notifications/notifier";
import { toastifyNotificationAdapter } from "../shared/notifications/toastify.adapter";
import { queryClient } from "./query-client";

configureNotifier(toastifyNotificationAdapter);

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NotificationCenter />
    </QueryClientProvider>
  );
};
