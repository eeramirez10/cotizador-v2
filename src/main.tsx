import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { AppProviders } from "./app/providers";
import { queryClient } from "./app/query-client";
import { appRouter } from "./app/router";
import { configureCoreUnauthorizedHandler } from "./modules/core/services/http/core-http.client";
import { notifier } from "./shared/notifications/notifier";
import { hasActiveSession, performLogout } from "./store/auth/auth.store";

configureCoreUnauthorizedHandler(() => {
  if (!hasActiveSession()) return;

  performLogout();
  queryClient.clear();
  notifier.warning("Tu sesión expiró. Inicia sesión nuevamente.");
  void appRouter.navigate("/login", { replace: true });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  </StrictMode>
);
