import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type AttachmentCategory = "SOURCE_DOCUMENT" | "SELLER_SUPPLIER_QUOTE" | "PURCHASE_SUPPLIER_PROPOSAL";

export interface FileAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  category: AttachmentCategory;
  clientDraftId: string | null;
  quoteId: string | null;
  clientItemIds: string[];
  purchaseOfferIds: string[];
  uploadedByUserId: string;
  uploadedByName: string;
  createdAt: string;
}

const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const message = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    return new Error((error.response?.data as { error?: string } | undefined)?.error || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
};

const form = (file: File, field: string, ids: string[]) => {
  const data = new FormData();
  data.append("file", file);
  data.append(field, JSON.stringify(ids));
  return data;
};

export class AttachmentsService {
  static async uploadQuoteSource(clientDraftId: string, file: File): Promise<FileAttachment> {
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await coreHttpClient.post<FileAttachment>(
        `/api/attachments/quote-drafts/${encodeURIComponent(clientDraftId)}/source`,
        data,
        { headers: headers() },
      );
      return response.data;
    } catch (error) {
      throw message(error, "No se pudo guardar el archivo origen.");
    }
  }

  static async uploadSellerQuote(clientDraftId: string, clientItemIds: string[], file: File): Promise<FileAttachment> {
    try {
      const response = await coreHttpClient.post<FileAttachment>(
        `/api/attachments/quote-drafts/${encodeURIComponent(clientDraftId)}/seller-quotes`,
        form(file, "clientItemIds", clientItemIds),
        { headers: headers() },
      );
      return response.data;
    } catch (error) {
      throw message(error, "No se pudo guardar la cotización del proveedor.");
    }
  }

  static async uploadPurchaseOffer(requisitionId: string, offerIds: string[], file: File): Promise<FileAttachment> {
    try {
      const response = await coreHttpClient.post<FileAttachment>(
        `/api/attachments/purchase-requisitions/${encodeURIComponent(requisitionId)}/offers`,
        form(file, "purchaseOfferIds", offerIds),
        { headers: headers() },
      );
      return response.data;
    } catch (error) {
      throw message(error, "No se pudo guardar el archivo de la propuesta.");
    }
  }

  static async listQuoteDraft(clientDraftId: string): Promise<FileAttachment[]> {
    const response = await coreHttpClient.get<FileAttachment[]>(
      `/api/attachments/quote-drafts/${encodeURIComponent(clientDraftId)}`,
      { headers: headers() },
    );
    return response.data || [];
  }

  static async listQuote(quoteId: string): Promise<FileAttachment[]> {
    const response = await coreHttpClient.get<FileAttachment[]>(
      `/api/attachments/quotes/${encodeURIComponent(quoteId)}`,
      { headers: headers() },
    );
    return response.data || [];
  }

  static async listPurchaseRequisition(requisitionId: string): Promise<FileAttachment[]> {
    const response = await coreHttpClient.get<FileAttachment[]>(
      `/api/attachments/purchase-requisitions/${encodeURIComponent(requisitionId)}`,
      { headers: headers() },
    );
    return response.data || [];
  }

  static async download(file: FileAttachment): Promise<void> {
    try {
      const blob = await this.getBlob(file);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.originalName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      throw message(error, "No se pudo descargar el archivo.");
    }
  }

  static async getBlob(file: FileAttachment): Promise<Blob> {
    try {
      const response = await coreHttpClient.get<Blob>(`/api/attachments/${encodeURIComponent(file.id)}/download`, {
        headers: headers(),
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw message(error, "No se pudo abrir el archivo.");
    }
  }

  static async delete(fileId: string): Promise<void> {
    try {
      await coreHttpClient.delete(`/api/attachments/${encodeURIComponent(fileId)}`, { headers: headers() });
    } catch (error) {
      throw message(error, "No se pudo eliminar el archivo.");
    }
  }
}
