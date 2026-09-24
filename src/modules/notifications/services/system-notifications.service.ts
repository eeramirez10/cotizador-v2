import axios from "axios";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import { getAuthToken } from "../../../store/auth/auth.store";

export interface SystemNotificationRecord {
  id: string;
  type: "CUSTOMER_ONBOARDING_ERP_LINKED";
  title: string;
  message: string;
  reference: string;
  targetPath: string;
  createdAt: string;
  readAt: string | null;
}

const headers = () => ({ Authorization: `Bearer ${getAuthToken() || ""}` });

export class SystemNotificationsService {
  static async list(): Promise<SystemNotificationRecord[]> {
    try {
      const { data } = await coreHttpClient.get<{ items: SystemNotificationRecord[] }>("/api/notifications", { headers: headers() });
      return data.items;
    } catch (error) {
      if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") throw new Error(error.response.data.error);
      throw error;
    }
  }

  static async markRead(id: string): Promise<void> {
    await coreHttpClient.patch(`/api/notifications/${encodeURIComponent(id)}/read`, {}, { headers: headers() });
  }
}
