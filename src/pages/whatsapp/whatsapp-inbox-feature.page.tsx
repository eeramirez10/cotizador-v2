import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";
import { WhatsAppInboxPage } from "./whatsapp-inbox.page";

export const WhatsAppInboxFeaturePage = () => {
  const capabilities = useSystemCapabilities();

  if (capabilities.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Consultando configuración...
      </div>
    );
  }

  if (capabilities.data?.whatsAppInboxEnabled !== true) {
    return <Navigate to="/home" replace />;
  }

  return <WhatsAppInboxPage />;
};
