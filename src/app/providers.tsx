import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { NotificationCenter } from "../shared/notifications/notification-center";
import { configureNotifier } from "../shared/notifications/notifier";
import { muiNotificationAdapter } from "../shared/notifications/mui-notification.adapter";
import { queryClient } from "./query-client";
import { SharedPhoneConfirmationModal } from "../shared/components/modals/shared-phone-confirmation.modal";

configureNotifier(muiNotificationAdapter);

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NotificationCenter />
      <SharedPhoneConfirmationModal />
    </QueryClientProvider>
  );
};
