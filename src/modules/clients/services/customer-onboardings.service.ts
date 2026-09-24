import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type CustomerOnboardingStatus = "COLLECTING" | "PENDING_REVIEW" | "PENDING_CXC" | "READY_FOR_ERP" | "ERP_LINKED" | "REJECTED" | "COMPLETED" | "CANCELLED";

export interface CustomerOnboarding {
  id: string;
  status: CustomerOnboardingStatus;
  customerId: string;
  acceptedQuoteId: string | null;
  conversationId: string | null;
  taxDocumentAttachmentId: string | null;
  legalName: string | null;
  taxId: string | null;
  taxRegime: string | null;
  cfdiUse: string | null;
  billingStreet: string | null;
  billingExteriorNumber: string | null;
  billingInteriorNumber: string | null;
  billingNeighborhood: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  missingFields: string[];
  updatedAt: string;
  completedAt: string | null;
  erpCode: string | null;
  reviewNote: string | null;
  taxDocumentOriginalName: string | null;
  customer: { id: string; displayName: string; legalName: string | null; profileStatus: string };
  acceptedQuote: { id: string; quoteNumber: string; status: string } | null;
  seller: { id: string; name: string };
  branch: { id: string; name: string };
  taxDocumentAttachment: { id: string; originalName: string; mimeType: string; createdAt: string } | null;
}

export type CustomerOnboardingInput = Pick<CustomerOnboarding,
  "legalName" | "taxId" | "taxRegime" | "cfdiUse" | "billingStreet" | "billingExteriorNumber" |
  "billingInteriorNumber" | "billingNeighborhood" | "billingCity" | "billingState" |
  "billingPostalCode" | "billingCountry" | "contactName" | "contactEmail" | "contactPhone" | "contactWhatsapp"
>;

const headers = () => ({ Authorization: `Bearer ${getAuthToken() || ""}` });

const message = (error: unknown): string => {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") return error.response.data.error;
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
};

export class CustomerOnboardingsService {
  static async get(id: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.get<CustomerOnboarding>(
        `/api/customer-onboardings/${encodeURIComponent(id)}`,
        { headers: headers() },
      );
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async remove(id: string, confirmation: string): Promise<void> {
    try {
      await coreHttpClient.delete(`/api/customer-onboardings/${encodeURIComponent(id)}`, {
        headers: headers(), data: { confirmation },
      });
    } catch (error) { throw new Error(message(error)); }
  }

  static async forConversation(conversationId: string): Promise<CustomerOnboarding | null> {
    try {
      const { data } = await coreHttpClient.get<{ exists: boolean; onboarding?: CustomerOnboarding }>(
        `/api/customer-onboardings/conversation/${encodeURIComponent(conversationId)}`,
        { headers: headers() },
      );
      return data.exists ? data.onboarding ?? null : null;
    } catch (error) { throw new Error(message(error)); }
  }

  static async processConversationTaxDocument(conversationId: string, attachmentId: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.post<{ success: boolean; onboarding: CustomerOnboarding }>(
        `/api/customer-onboardings/conversation/${encodeURIComponent(conversationId)}/tax-document/${encodeURIComponent(attachmentId)}`,
        {},
        { headers: headers() },
      );
      return data.onboarding;
    } catch (error) { throw new Error(message(error)); }
  }

  static async create(customerId: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.post<CustomerOnboarding>("/api/customer-onboardings", { customerId }, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async list(status?: CustomerOnboardingStatus): Promise<CustomerOnboarding[]> {
    try {
      const { data } = await coreHttpClient.get<{ items: CustomerOnboarding[] }>("/api/customer-onboardings", {
        headers: headers(), params: { pageSize: 100, status },
      });
      return data.items;
    } catch (error) { throw new Error(message(error)); }
  }

  static async update(id: string, input: CustomerOnboardingInput): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.patch<CustomerOnboarding>(`/api/customer-onboardings/${id}`, input, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async uploadTaxDocument(id: string, file: File): Promise<CustomerOnboarding> {
    try {
      const form = new FormData(); form.set("file", file);
      const { data } = await coreHttpClient.post<CustomerOnboarding>(`/api/customer-onboardings/${id}/tax-document`, form, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async submitForCxc(id: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.post<CustomerOnboarding>(`/api/customer-onboardings/${id}/submit-for-cxc`, {}, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async approveForErp(id: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.post<CustomerOnboarding>(`/api/customer-onboardings/${id}/approve-for-erp`, {}, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async requestCorrection(id: string, reason: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.post<CustomerOnboarding>(`/api/customer-onboardings/${id}/request-correction`, { reason }, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async markErpLinked(id: string, erpCode: string): Promise<CustomerOnboarding> {
    try {
      const { data } = await coreHttpClient.post<CustomerOnboarding>(`/api/customer-onboardings/${id}/mark-erp-linked`, { erpCode }, { headers: headers() });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }

  static async taxDocumentBlob(id: string): Promise<Blob> {
    try {
      const { data } = await coreHttpClient.get<Blob>(`/api/customer-onboardings/${id}/tax-document`, { headers: headers(), responseType: "blob" });
      return data;
    } catch (error) { throw new Error(message(error)); }
  }
}
