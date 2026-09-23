import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type SystemSettingKey =
  | "QUOTE_INTERNAL_APPROVAL_ENABLED"
  | "REQUISITION_INTERNAL_APPROVAL_ENABLED"
  | "ORDER_FILE_WITHOUT_STOCK_ENABLED"
  | "ORDER_FILE_WITH_LOCAL_CUSTOMER_ENABLED"
  | "SELLER_EXCEL_IMPORT_ENABLED"
  | "WHATSAPP_INBOX_ENABLED"
  | "WHATSAPP_ASSISTANT_ENABLED"
  | "WHATSAPP_HUMAN_TAKEOVER_MINUTES"
  | "WHATSAPP_HUMAN_RESPONSE_GRACE_MINUTES"
  | "WHATSAPP_HUMAN_TAKEOVER_MAX_MINUTES";

export type SystemSettingCategory = "QUOTES" | "PROCUREMENT" | "WHATSAPP";

export interface ManagedSystemSetting {
  key: SystemSettingKey;
  category: SystemSettingCategory;
  label: string;
  description: string;
  type: "BOOLEAN" | "INTEGER";
  defaultValue: boolean | number;
  value: boolean | number;
  min?: number;
  max?: number;
  unit?: string;
  available: boolean;
  availabilityMessage?: string;
  warning?: string;
  overridden: boolean;
  updatedAt: string | null;
}

const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const message = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const apiMessage = (error.response?.data as { error?: string } | undefined)?.error;
    return new Error(apiMessage || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
};

export class SystemSettingsService {
  static async list(): Promise<ManagedSystemSetting[]> {
    try {
      const { data } = await coreHttpClient.get<ManagedSystemSetting[]>("/api/system/settings", { headers: headers() });
      return data || [];
    } catch (error) {
      throw message(error, "No se pudo cargar la configuración del sistema.");
    }
  }

  static async update(settings: Array<{ key: SystemSettingKey; value: boolean | number }>): Promise<ManagedSystemSetting[]> {
    try {
      const { data } = await coreHttpClient.patch<ManagedSystemSetting[]>("/api/system/settings", { settings }, { headers: headers() });
      return data || [];
    } catch (error) {
      throw message(error, "No se pudo guardar la configuración.");
    }
  }

  static async reset(keys: SystemSettingKey[]): Promise<ManagedSystemSetting[]> {
    try {
      const { data } = await coreHttpClient.post<ManagedSystemSetting[]>("/api/system/settings/reset", { keys }, { headers: headers() });
      return data || [];
    } catch (error) {
      throw message(error, "No se pudieron restaurar los valores predeterminados.");
    }
  }
}
