import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador", PENDING: "Pendiente", PENDING_APPROVAL: "Por aprobar", CHANGES_REQUESTED: "Cambios solicitados",
  QUOTED: "Cotizada", APPROVED: "Aprobada", REJECTED: "Rechazada", CANCELLED: "Cancelada", SUPERSEDED: "Reemplazada",
};
export const CHANNEL_LABELS: Record<string, string> = {
  UNSPECIFIED: "Sin especificar", EMAIL: "Correo", PHONE: "Teléfono", WHATSAPP: "WhatsApp",
  AI_ASSISTANT: "Asistente IA", IN_PERSON: "Presencial", OTHER: "Otro",
};
export interface ReportFilters {
  from: string; to: string; timezone: string; branchId: string; sellerId: string;
  currency: "ALL" | "MXN" | "USD"; statuses: string[]; sourceChannel: string; captureMethod: string;
  compare: boolean; includeBreakdowns: boolean; includeDetails: boolean;
}
export interface ReportGroup {
  id: string; name: string; created: number; approved: number; orders: number;
  quotedMxn: number; quotedUsd: number; approvedMxn: number; approvedUsd: number;
}
export interface ReportQuoteRow {
  id: string; quoteNumber: string; customerReference: string | null; status: string; currency: "MXN" | "USD";
  total: number; createdAt: string; branchId: string; branchName: string; sellerId: string; sellerName: string;
  customerId: string; customerName: string; sourceChannel: string; captureMethod: string; orderGenerated: boolean;
}
export interface ReportTotals {
  created: number; quoted: number; approved: number; pending: number; ordersGenerated: number;
  quotedMxn: number; quotedUsd: number; approvedMxn: number; approvedUsd: number;
}
export interface CommercialReport {
  scopeName: string; periodFrom: string; periodTo: string; generatedAt: string; timezone: string;
  currency: ReportFilters["currency"]; filterLabels: string[]; totals: ReportTotals; approvalRate: number;
  orderMxn: number; orderUsd: number;
  sellers: Array<{ userId: string; name: string; quotes: number; approved: number; conversionRate: number;
    quotedMxn: number; quotedUsd: number; approvedMxn: number; approvedUsd: number }>;
  breakdowns: { branches: ReportGroup[]; customers: ReportGroup[]; statuses: ReportGroup[]; channels: ReportGroup[]; captureMethods: ReportGroup[] };
  details: { items: ReportQuoteRow[]; total: number; page: number; pageSize: number; totalPages: number };
  comparison: { periodFrom: string; periodTo: string; totals: ReportTotals } | null;
}
export interface ReportOptions {
  branches: Array<{ id: string; name: string; isActive: boolean }>;
  sellers: Array<{ id: string; name: string; branchId: string; isActive: boolean }>;
}
const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida.");
  return { Authorization: `Bearer ${token}` };
};
export const reportParams = (filters: ReportFilters, page = 1, pageSize = 25) => ({
  ...filters, statuses: [...filters.statuses].sort().join(","),
  branchId: filters.branchId || undefined, sellerId: filters.sellerId || undefined,
  sourceChannel: filters.sourceChannel || undefined, captureMethod: filters.captureMethod || undefined, page, pageSize,
});
export class CommercialReportsService {
  static async options(signal?: AbortSignal) {
    return (await coreHttpClient.get<ReportOptions>("/api/reports/options", { signal, headers: headers() })).data;
  }
  static async get(filters: ReportFilters, page: number, pageSize: number, signal?: AbortSignal) {
    return (await coreHttpClient.get<CommercialReport>("/api/reports/quotes", { signal, headers: headers(), params: reportParams(filters, page, pageSize) })).data;
  }
  static async pdf(filters: ReportFilters) {
    try {
      return (await coreHttpClient.get<Blob>("/api/reports/quotes/pdf", { responseType: "blob", headers: headers(), params: reportParams(filters) })).data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await error.response.data.text());
          if (typeof payload.error === "string") throw new Error(payload.error);
        } catch (parsed) { if (parsed instanceof Error && !(parsed instanceof SyntaxError)) throw parsed; }
      }
      throw error instanceof Error ? error : new Error("No se pudo generar el PDF.");
    }
  }
}
