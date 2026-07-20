import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export interface AnalyticsDashboard {
  scope: { type: "BRANCH" | "USER"; id: string; name: string };
  period: { from: string; to: string; currency: "MXN" | "USD" };
  kpis: {
    created: number;
    quoted: number;
    approved: number;
    quotedAmount: number;
    approvedAmount: number;
    averageTicket: number;
    conversionRate: number;
    pending: number;
    ordersGenerated: number;
    orderAmount: number;
    pendingItems: number;
  };
  trend: Array<{ date: string; created: number; quoted: number; approved: number; orders: number }>;
  pipeline: Array<{ status: string; count: number; amount: number }>;
  channels: Array<{ channel: string; count: number; amount: number }>;
  captureMethods: Array<{ method: "SYSTEM" | "EXCEL_IMPORT"; count: number; amount: number }>;
  rejectionReasons: Array<{ reason: string; count: number; amount: number }>;
  sellerRanking: Array<{ userId: string; name: string; quotes: number; approved: number; quotedAmount: number; approvedAmount: number; conversionRate: number }>;
  providerRanking: Array<{ userId: string; name: string; branchName: string; quotes: number; approved: number; approvedAmount: number }>;
  attribution: { direct: number; provided: number };
  contribution: { workedQuotes: number; workedApprovedAmount: number; providedQuotes: number; providedApprovedAmount: number };
  pendingQuotes: Array<{ id: string; quoteNumber: string; customerName: string; status: string; total: number; createdAt: string; daysOpen: number }>;
}

export interface AnalyticsParams { from: string; to: string; currency: "MXN" | "USD"; branchId?: string; userId?: string }

const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida.");
  return { Authorization: `Bearer ${token}` };
};

const request = async (path: string, params: AnalyticsParams): Promise<AnalyticsDashboard> => {
  try {
    const { data } = await coreHttpClient.get<AnalyticsDashboard>(path, { headers: headers(), params });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
      throw new Error(error.response.data.error);
    }
    throw new Error("No se pudieron cargar los indicadores.");
  }
};

export class AnalyticsService {
  static branch(params: AnalyticsParams): Promise<AnalyticsDashboard> {
    return request("/api/analytics/branch", params);
  }

  static user(params: AnalyticsParams): Promise<AnalyticsDashboard> {
    return request("/api/analytics/user", params);
  }
}
