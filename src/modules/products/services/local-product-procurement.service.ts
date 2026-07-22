import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type ProductProcurementStatus =
  | "PENDING_REVIEW"
  | "QUOTING"
  | "COSTED"
  | "PENDING_ERP"
  | "ERP_LINKED"
  | "REJECTED";

export interface ProcurementOffer {
  id: string;
  productId: string;
  supplierName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  unitCost: number;
  currency: "MXN" | "USD";
  minimumQty: number | null;
  deliveryTime: string | null;
  validUntil: string | null;
  notes: string | null;
  isSelected: boolean;
  isActive: boolean;
  createdBy: { id: string; fullName: string };
  updatedBy: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementProduct {
  id: string;
  description: string;
  unit: string;
  currency: "MXN" | "USD";
  averageCost: number | null;
  lastCost: number | null;
  branch: { id: string; code: string; name: string } | null;
  createdBy: { id: string; fullName: string } | null;
  procurementStatus: ProductProcurementStatus;
  procurementNotes: string | null;
  procurementUpdatedAt: string | null;
  procurementUpdatedBy: { id: string; fullName: string } | null;
  selectedProcurementOfferId: string | null;
  offers: ProcurementOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementOfferInput {
  supplierName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  unitCost: number;
  currency: "MXN" | "USD";
  minimumQty?: number | null;
  deliveryTime?: string | null;
  validUntil?: string | null;
  notes?: string | null;
}

export interface PaginatedProcurementProducts {
  items: ProcurementProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const apiError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error(fallback);
};

export class LocalProductProcurementService {
  static async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: ProductProcurementStatus | "ALL";
  }): Promise<PaginatedProcurementProducts> {
    try {
      const { data } = await coreHttpClient.get<PaginatedProcurementProducts>(
        "/api/local-product-procurement",
        {
          headers: headers(),
          params: {
            page: params.page,
            pageSize: params.pageSize,
            search: params.search?.trim() || undefined,
            status: params.status && params.status !== "ALL" ? params.status : undefined,
          },
        },
      );
      return data;
    } catch (error) {
      throw apiError(error, "No se pudieron cargar los productos pendientes de Compras.");
    }
  }

  static async get(productId: string): Promise<ProcurementProduct> {
    try {
      const { data } = await coreHttpClient.get<ProcurementProduct>(
        `/api/local-product-procurement/${encodeURIComponent(productId)}`,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw apiError(error, "No se pudo cargar el producto.");
    }
  }

  static async createOffer(productId: string, input: ProcurementOfferInput): Promise<ProcurementProduct> {
    try {
      const { data } = await coreHttpClient.post<ProcurementProduct>(
        `/api/local-product-procurement/${encodeURIComponent(productId)}/offers`,
        input,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw apiError(error, "No se pudo guardar la propuesta.");
    }
  }

  static async updateOffer(
    productId: string,
    offerId: string,
    input: ProcurementOfferInput,
  ): Promise<ProcurementProduct> {
    try {
      const { data } = await coreHttpClient.patch<ProcurementProduct>(
        `/api/local-product-procurement/${encodeURIComponent(productId)}/offers/${encodeURIComponent(offerId)}`,
        input,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw apiError(error, "No se pudo actualizar la propuesta.");
    }
  }

  static async deactivateOffer(offerId: string): Promise<void> {
    try {
      await coreHttpClient.delete(
        `/api/local-product-procurement/offers/${encodeURIComponent(offerId)}`,
        { headers: headers() },
      );
    } catch (error) {
      throw apiError(error, "No se pudo retirar la propuesta.");
    }
  }

  static async selectOffer(productId: string, offerId: string): Promise<ProcurementProduct> {
    try {
      const { data } = await coreHttpClient.post<ProcurementProduct>(
        `/api/local-product-procurement/${encodeURIComponent(productId)}/offers/${encodeURIComponent(offerId)}/select`,
        {},
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw apiError(error, "No se pudo seleccionar la propuesta.");
    }
  }

  static async changeStatus(
    productId: string,
    status: ProductProcurementStatus,
    comment?: string | null,
  ): Promise<ProcurementProduct> {
    try {
      const { data } = await coreHttpClient.patch<ProcurementProduct>(
        `/api/local-product-procurement/${encodeURIComponent(productId)}/status`,
        { status, comment: comment?.trim() || null },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw apiError(error, "No se pudo actualizar el estado de Compras.");
    }
  }
}
