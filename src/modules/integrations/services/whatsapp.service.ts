import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export interface WhatsAppConversationWindow {
  active: boolean;
  deliveryMode: "FREE_FORM" | "TEMPLATE";
  lastInboundAt: string | null;
  expiresAt: string | null;
}

export class WhatsAppService {
  static async getConversationWindow(phone: string): Promise<WhatsAppConversationWindow> {
    const token = getAuthToken();
    if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");
    const response = await coreHttpClient.get<WhatsAppConversationWindow>(
      "/api/integrations/twilio/whatsapp/window",
      {
        params: { phone },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }
}
