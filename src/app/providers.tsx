import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { NotificationCenter } from "../shared/notifications/notification-center";
import { configureNotifier } from "../shared/notifications/notifier";
import { toastifyNotificationAdapter } from "../shared/notifications/toastify.adapter";

configureNotifier(toastifyNotificationAdapter);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NotificationCenter />
    </QueryClientProvider>
  );
};
