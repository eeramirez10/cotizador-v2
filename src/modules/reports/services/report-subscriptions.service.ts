import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type ManagerReportType = "QUOTE_PERFORMANCE";
export type ManagerReportScope = "GLOBAL" | "BRANCH";
export type ManagerReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type ManagerReportRange =
  | "PREVIOUS_DAY"
  | "WEEK_TO_DATE"
  | "PREVIOUS_WEEK"
  | "MONTH_TO_DATE"
  | "PREVIOUS_MONTH"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS";

interface ReportUserSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "MANAGER";
  isActive: boolean;
  branch: {
    id: string;
    code: string;
    name: string;
  };
}

interface AuditUserSummary {
  id: string;
  fullName: string;
}

export interface ManagerReportSubscription {
  id: string;
  reportType: ManagerReportType;
  recipient: ReportUserSummary;
  scope: ManagerReportScope;
  branch: {
    id: string;
    code: string;
    name: string;
  } | null;
  frequency: ManagerReportFrequency;
  reportRange: ManagerReportRange;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  sendHour: number;
  sendMinute: number;
  timezone: string;
  isActive: boolean;
  createdBy: AuditUserSummary;
  updatedBy: AuditUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertManagerReportSubscriptionInput {
  recipientUserId: string;
  reportType: ManagerReportType;
  scope: ManagerReportScope;
  branchId: string | null;
  frequency: ManagerReportFrequency;
  reportRange: ManagerReportRange;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  sendHour: number;
  sendMinute: number;
  timezone: string;
}

export interface SendManagerReportNowResult {
  providerMessageId: string;
  status: "QUEUED" | "SENT";
  recipient: string;
  deliveryMode: "FREE_FORM" | "TEMPLATE";
  period: {
    from: string;
    to: string;
    label: string;
  };
}

const requireAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesion no valida. Inicia sesion nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const mapAxiosError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error(fallback);
};

export class ReportSubscriptionsService {
  static async list(): Promise<ManagerReportSubscription[]> {
    try {
      const { data } = await coreHttpClient.get<ManagerReportSubscription[]>(
        "/api/report-subscriptions",
        { headers: requireAuthHeaders() },
      );
      return data || [];
    } catch (error) {
      throw mapAxiosError(error, "No se pudieron cargar las suscripciones de reportes.");
    }
  }

  static async create(input: UpsertManagerReportSubscriptionInput): Promise<ManagerReportSubscription> {
    try {
      const { data } = await coreHttpClient.post<ManagerReportSubscription>(
        "/api/report-subscriptions",
        input,
        { headers: requireAuthHeaders() },
      );
      return data;
    } catch (error) {
      throw mapAxiosError(error, "No se pudo crear la suscripcion de reporte.");
    }
  }

  static async update(
    subscriptionId: string,
    input: UpsertManagerReportSubscriptionInput,
  ): Promise<ManagerReportSubscription> {
    try {
      const { data } = await coreHttpClient.patch<ManagerReportSubscription>(
        `/api/report-subscriptions/${encodeURIComponent(subscriptionId)}`,
        input,
        { headers: requireAuthHeaders() },
      );
      return data;
    } catch (error) {
      throw mapAxiosError(error, "No se pudo actualizar la suscripcion de reporte.");
    }
  }

  static async setActive(subscriptionId: string, isActive: boolean): Promise<ManagerReportSubscription> {
    try {
      const { data } = await coreHttpClient.patch<ManagerReportSubscription>(
        `/api/report-subscriptions/${encodeURIComponent(subscriptionId)}/status`,
        { isActive },
        { headers: requireAuthHeaders() },
      );
      return data;
    } catch (error) {
      throw mapAxiosError(error, "No se pudo cambiar el estado de la suscripcion.");
    }
  }

  static async sendNow(subscriptionId: string): Promise<SendManagerReportNowResult> {
    try {
      const { data } = await coreHttpClient.post<SendManagerReportNowResult>(
        `/api/report-subscriptions/${encodeURIComponent(subscriptionId)}/send-now`,
        {},
        { headers: requireAuthHeaders() },
      );
      return data;
    } catch (error) {
      throw mapAxiosError(error, "No se pudo enviar el reporte por WhatsApp.");
    }
  }
}
