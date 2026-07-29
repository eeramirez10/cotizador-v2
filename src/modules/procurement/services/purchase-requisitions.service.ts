import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type Currency = "MXN" | "USD";
export type RequisitionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "PARTIALLY_QUOTED"
  | "COST_REVIEW"
  | "READY_FOR_ORDER"
  | "COMPLETED"
  | "CANCELLED";
export type RequisitionItemStatus =
  | "PENDING"
  | "QUOTING"
  | "OFFER_SELECTED"
  | "PENDING_ERP_CODE"
  | "READY"
  | "CANCELLED";

export interface ProcurementUser {
  id: string;
  fullName: string;
  role: string;
}

export interface Supplier {
  id: string;
  erpCode: string | null;
  name: string;
  source: "ERP" | "LOCAL";
  scope: "NATIONAL" | "INTERNATIONAL";
  taxId: string | null;
  state: string | null;
  creditTerms: string | null;
  currency: Currency | null;
  country: string | null;
  contactName: string | null;
  contactPosition: string | null;
  email: string | null;
  phone: string | null;
  phoneExtension: string | null;
  mobile: string | null;
  notes: string | null;
  erpSyncedAt: string | null;
  isActive: boolean;
}

export interface ErpSupplierContact {
  name: string;
  position: string;
  phone: string;
  extension: string;
  email: string;
  mobile: string;
  notes: string;
}

export interface ErpSupplier {
  code: string;
  name: string;
  taxId: string;
  state: string;
  creditTerms: string;
  currency: Currency;
  contacts: ErpSupplierContact[];
}

export interface SupplierOffer {
  id: string;
  supplierId: string;
  qty: number;
  unitCost: number;
  currency: Currency;
  exchangeRate: number | null;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  brand: string | null;
  origin: string | null;
  deliveryTime: string | null;
  validUntil: string | null;
  quoteDate: string;
  externalReference: string | null;
  notes: string | null;
  isSelected: boolean;
  supplier: Supplier;
  createdBy: ProcurementUser;
  createdAt: string;
}

export interface RequisitionItem {
  id: string;
  quoteItemId: string;
  quoteClientItemId: string | null;
  position: number;
  productId: string | null;
  source: "ERP_NO_STOCK" | "LOCAL_NEW";
  erpCode: string | null;
  erpEan: string | null;
  erpLinkedAt: string | null;
  erpLinkedByUserId: string | null;
  qty: number;
  unit: string;
  description: string;
  standard: string | null;
  diameter: string | null;
  thickness: string | null;
  bore: string | null;
  sellerUnitCost: number;
  sellerCurrency: Currency;
  sellerExchangeRate: number;
  sellerCostSource: "ERP_COST" | "SELLER_SUPPLIER_QUOTE" | "ESTIMATED";
  sellerSupplierId: string | null;
  sellerSupplierName: string | null;
  sellerBrand: string | null;
  originRestrictions: string[];
  sellerDeliveryTime: string | null;
  deliveryPlace: string | null;
  status: RequisitionItemStatus;
  selectedOfferId: string | null;
  offers: SupplierOffer[];
}

export interface PurchaseRequisition {
  id: string;
  requisitionNumber: string;
  quoteId: string;
  quoteNumber: string;
  quoteCurrency: Currency;
  branchId: string;
  branchName: string;
  customerName: string;
  requestedByUserId: string;
  requestedBy: ProcurementUser;
  assignedBuyerUserId: string | null;
  assignedBuyer: ProcurementUser | null;
  status: RequisitionStatus;
  deliveryState: string | null;
  deliveryPlace: string | null;
  notes: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  costApprovedAt: string | null;
  costApprovedBy: ProcurementUser | null;
  items: RequisitionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRequisitions {
  items: PurchaseRequisition[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UpdateRequisitionItemInput {
  standard?: string | null;
  diameter?: string | null;
  thickness?: string | null;
  bore?: string | null;
  sellerUnitCost?: number;
  sellerCurrency?: Currency;
  sellerCostSource?: "ERP_COST" | "SELLER_SUPPLIER_QUOTE" | "ESTIMATED";
  sellerBrand?: string | null;
  originRestrictions?: string[];
  sellerDeliveryTime?: string | null;
  deliveryPlace?: string | null;
}

export interface SaveSupplierInput {
  name: string;
  scope: "NATIONAL" | "INTERNATIONAL";
  taxId?: string | null;
  state?: string | null;
  country?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface SaveOfferInput {
  supplierId: string;
  qty: number;
  unitCost: number;
  currency: Currency;
  exchangeRate?: number | null;
  taxRate?: number;
  brand?: string | null;
  origin?: string | null;
  deliveryTime?: string | null;
  validUntil?: string | null;
  quoteDate?: string;
  externalReference?: string | null;
  notes?: string | null;
}

const headers = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const request = async <T>(operation: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    return (await operation()).data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error;
      if (typeof message === "string" && message.trim()) throw new Error(message);
    }
    throw new Error(fallback);
  }
};

export class PurchaseRequisitionsService {
  static list(params: { page: number; pageSize: number; search?: string; status?: RequisitionStatus | "ALL" }) {
    return request(
      () => coreHttpClient.get<PaginatedRequisitions>("/api/purchase-requisitions", {
        headers: headers(),
        params: {
          page: params.page,
          pageSize: params.pageSize,
          search: params.search?.trim() || undefined,
          status: params.status === "ALL" ? undefined : params.status,
        },
      }),
      "No se pudieron cargar las requisiciones.",
    );
  }

  static get(id: string) {
    return request(
      () => coreHttpClient.get<PurchaseRequisition>(`/api/purchase-requisitions/${encodeURIComponent(id)}`, { headers: headers() }),
      "No se pudo cargar la requisición.",
    );
  }

  static getByQuote(quoteId: string) {
    return request(
      () => coreHttpClient.get<PurchaseRequisition>(`/api/purchase-requisitions/quote/${encodeURIComponent(quoteId)}`, { headers: headers() }),
      "No se pudo cargar la requisición de la cotización.",
    );
  }

  static updateItem(id: string, itemId: string, input: UpdateRequisitionItemInput) {
    return request(
      () => coreHttpClient.patch<PurchaseRequisition>(
        `/api/purchase-requisitions/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
        input,
        { headers: headers() },
      ),
      "No se pudo actualizar la partida.",
    );
  }

  static linkItemToErp(id: string, itemId: string, input: { erpCode: string; erpEan: string }) {
    return request(
      () => coreHttpClient.post<PurchaseRequisition>(
        `/api/purchase-requisitions/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/link-erp`,
        input,
        { headers: headers() },
      ),
      "No se pudo vincular el producto ERP.",
    );
  }

  static submit(id: string) {
    return request(
      () => coreHttpClient.post<PurchaseRequisition>(`/api/purchase-requisitions/${encodeURIComponent(id)}/submit`, {}, { headers: headers() }),
      "No se pudo enviar la requisición.",
    );
  }

  static assign(id: string, buyerUserId: string) {
    return request(
      () => coreHttpClient.patch<PurchaseRequisition>(`/api/purchase-requisitions/${encodeURIComponent(id)}/assign`, { buyerUserId }, { headers: headers() }),
      "No se pudo asignar el comprador.",
    );
  }

  static createOffer(id: string, itemId: string, input: SaveOfferInput) {
    return request(
      () => coreHttpClient.post<PurchaseRequisition>(
        `/api/purchase-requisitions/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/offers`,
        input,
        { headers: headers() },
      ),
      "No se pudo registrar la propuesta.",
    );
  }

  static selectOffer(id: string, itemId: string, offerId: string) {
    return request(
      () => coreHttpClient.post<PurchaseRequisition>(
        `/api/purchase-requisitions/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/offers/${encodeURIComponent(offerId)}/select`,
        {},
        { headers: headers() },
      ),
      "No se pudo seleccionar la propuesta.",
    );
  }

  static approveCostVariance(id: string) {
    return request(
      () => coreHttpClient.post<PurchaseRequisition>(`/api/purchase-requisitions/${encodeURIComponent(id)}/approve-cost-variance`, {}, { headers: headers() }),
      "No se pudo aprobar la variación de costo.",
    );
  }

  static listSuppliers(search?: string) {
    return request(
      () => coreHttpClient.get<Supplier[]>("/api/purchase-requisitions/suppliers", {
        headers: headers(),
        params: { search: search?.trim() || undefined },
      }),
      "No se pudieron cargar los proveedores.",
    );
  }

  static createSupplier(input: SaveSupplierInput) {
    return request(
      () => coreHttpClient.post<Supplier>("/api/purchase-requisitions/suppliers", input, { headers: headers() }),
      "No se pudo crear el proveedor.",
    );
  }

  static searchErpSuppliers(term: string, signal?: AbortSignal) {
    return request(
      () => coreHttpClient.get<ErpSupplier[]>("/api/purchase-requisitions/suppliers/erp/search", {
        headers: headers(),
        params: { q: term.trim() },
        signal,
      }),
      "No se pudieron consultar los proveedores ERP.",
    );
  }

  static syncErpSupplier(erpCode: string) {
    return request(
      () => coreHttpClient.post<Supplier>(
        "/api/purchase-requisitions/suppliers/erp/sync",
        { erpCode },
        { headers: headers() },
      ),
      "No se pudo vincular el proveedor ERP.",
    );
  }
}
