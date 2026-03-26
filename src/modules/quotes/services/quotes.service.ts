import axios from "axios";
import type { Client } from "../../clients/types/client.types";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { PageResult, Quote } from "../types/quote.types";
import { getAuthToken } from "../../../store/auth/auth.store";
import type { ManualQuoteDraft, ManualQuoteItem } from "../../../store/quote/manual-quote.store";

export type SavedQuoteStatus = "BORRADOR" | "PENDIENTE" | "COTIZADA" | "APROBADA" | "RECHAZADA" | "CANCELADA";
export type QuoteDraftOrigin = "MANUAL" | "FILE_UPLOAD" | "TEXT_INPUT";
export type SavedDeliveryStatus = "NO_ENVIADA" | "ENVIADA";
export type SavedOrderStatus = "NO_GENERADO" | "GENERADO";
export type QuoteDeliveryChannel = "WHATSAPP" | "EMAIL";

export interface SavedQuoteRecord {
  quoteId: string;
  quoteNumber?: string;
  quoteDraftId: string;
  status: SavedQuoteStatus;
  deliveryStatus: SavedDeliveryStatus;
  firstSentAt: string | null;
  orderStatus: SavedOrderStatus;
  orderGeneratedAt: string | null;
  orderReference: string | null;
  erpProfile?: "GENERIC_TXT";
  erpExportState?: "PENDIENTE" | "EXPORTADO";
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  createdByName: string;
  branchId: string | null;
  branchName: string;
  currency: "MXN" | "USD";
  exchangeRate: number;
  taxRate: number;
  deliveryPlace: string;
  paymentTerms: string;
  validityDays: number;
  validUntil: string;
  subtotal: number;
  tax: number;
  total: number;
  client: {
    id: string;
    name: string;
    lastname: string;
    whatsappPhone: string;
    email: string;
    rfc: string;
    companyName: string;
    phone?: string;
  } | null;
  items: Array<{
    id: string;
    localProductId: string | null;
    erpCode: string;
    ean?: string;
    customerDescription?: string;
    customerUnit?: string;
    erpDescription: string;
    unit: string;
    qty: number;
    stock: number;
    deliveryTime: string;
    costUsd: number;
    costCurrency?: "MXN" | "USD";
    marginPct: number;
    unitPrice: number;
    subtotal: number;
    sourceRequiresReview?: boolean;
    requiresReview: boolean;
  }>;
}

interface ApiQuoteItem {
  id: string;
  productId: string | null;
  externalProductCode: string | null;
  ean: string | null;
  customerDescription: string | null;
  customerUnit: string | null;
  erpDescription: string | null;
  unit: string;
  qty: number;
  stock: number | null;
  deliveryTime: string | null;
  cost: number;
  costCurrency: "MXN" | "USD";
  marginPct: number;
  unitPrice: number;
  subtotal: number;
  sourceRequiresReview: boolean;
  requiresReview: boolean;
  product?: {
    id: string;
    code: string | null;
    ean: string | null;
    description: string;
    unit: string;
    currency: "MXN" | "USD";
  } | null;
}

interface ApiQuote {
  id: string;
  quoteNumber: string;
  status: "DRAFT" | "PENDING" | "QUOTED" | "APPROVED" | "REJECTED" | "CANCELLED";
  deliveryStatus: "NOT_SENT" | "SENT";
  firstSentAt: string | null;
  orderStatus: "NOT_GENERATED" | "GENERATED";
  orderGeneratedAt: string | null;
  orderReference: string | null;
  currency: "MXN" | "USD";
  exchangeRate: number;
  taxRate: number;
  deliveryPlace: string | null;
  paymentTerms: string;
  validityDays: number;
  validUntil: string;
  subtotal: number;
  tax: number;
  total: number;
  createdByUserId: string;
  branch: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    displayName: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string;
  };
  createdByUser: {
    firstName: string;
    lastName: string;
  };
  items: ApiQuoteItem[];
  createdAt: string;
  updatedAt: string;
}

interface ApiPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const STORAGE_CUSTOMER_MAP_KEY = "cotizador-v2-customer-id-map";

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const readCustomerMap = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_CUSTOMER_MAP_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeCustomerMap = (value: Record<string, string>): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_CUSTOMER_MAP_KEY, JSON.stringify(value));
};

const requireAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const mapApiStatusToSaved = (status: ApiQuote["status"]): SavedQuoteStatus => {
  if (status === "DRAFT") return "BORRADOR";
  if (status === "PENDING") return "PENDIENTE";
  if (status === "QUOTED") return "COTIZADA";
  if (status === "APPROVED") return "APROBADA";
  if (status === "REJECTED") return "RECHAZADA";
  return "CANCELADA";
};

const mapApiDeliveryStatusToSaved = (status: ApiQuote["deliveryStatus"]): SavedDeliveryStatus => {
  return status === "SENT" ? "ENVIADA" : "NO_ENVIADA";
};

const mapApiOrderStatusToSaved = (status: ApiQuote["orderStatus"]): SavedOrderStatus => {
  return status === "GENERATED" ? "GENERADO" : "NO_GENERADO";
};

const mapAxiosErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error;
    if (typeof apiMessage === "string" && apiMessage.trim()) return apiMessage.trim();
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const splitName = (displayName: string): { name: string; lastname: string } => {
  const safe = displayName.trim();
  if (!safe) return { name: "", lastname: "" };

  const [first, ...rest] = safe.split(" ");
  return { name: first, lastname: rest.join(" ") };
};

const mapApiQuoteToSavedRecord = (apiQuote: ApiQuote): SavedQuoteRecord => {
  const legalName = (apiQuote.customer.legalName || "").trim();
  const person = splitName(apiQuote.customer.displayName);
  const customerName = legalName || person.name || apiQuote.customer.displayName;
  const customerLastName = legalName ? "" : person.lastname;
  const companyName = legalName || apiQuote.customer.displayName;

  return {
    quoteId: apiQuote.id,
    quoteNumber: apiQuote.quoteNumber,
    quoteDraftId: apiQuote.id,
    status: mapApiStatusToSaved(apiQuote.status),
    deliveryStatus: mapApiDeliveryStatusToSaved(apiQuote.deliveryStatus),
    firstSentAt: apiQuote.firstSentAt,
    orderStatus: mapApiOrderStatusToSaved(apiQuote.orderStatus),
    orderGeneratedAt: apiQuote.orderGeneratedAt,
    orderReference: apiQuote.orderReference,
    erpProfile: "GENERIC_TXT",
    erpExportState: apiQuote.orderStatus === "GENERATED" ? "EXPORTADO" : "PENDIENTE",
    createdAt: apiQuote.createdAt,
    updatedAt: apiQuote.updatedAt,
    createdByUserId: apiQuote.createdByUserId,
    createdByName: `${apiQuote.createdByUser.firstName} ${apiQuote.createdByUser.lastName}`.trim(),
    branchId: apiQuote.branch.id,
    branchName: apiQuote.branch.name,
    currency: apiQuote.currency,
    exchangeRate: apiQuote.exchangeRate,
    taxRate: apiQuote.taxRate,
    deliveryPlace: apiQuote.deliveryPlace || "L.A.B. OBRA",
    paymentTerms: apiQuote.paymentTerms || "CONTADO",
    validityDays: apiQuote.validityDays || 10,
    validUntil: apiQuote.validUntil,
    subtotal: apiQuote.subtotal,
    tax: apiQuote.tax,
    total: apiQuote.total,
    client: {
      id: apiQuote.customer.id,
      name: customerName,
      lastname: customerLastName,
      whatsappPhone: apiQuote.customer.whatsapp || "",
      email: apiQuote.customer.email || "",
      rfc: "",
      companyName,
      phone: apiQuote.customer.phone || "",
    },
    items: apiQuote.items.map((item) => ({
      id: item.id,
      localProductId: item.productId || item.product?.id || null,
      erpCode: item.externalProductCode || item.product?.code || "",
      ean: item.ean || item.product?.ean || "",
      customerDescription: item.customerDescription || "",
      customerUnit: item.customerUnit || "",
      erpDescription: item.erpDescription || item.product?.description || "",
      unit: item.unit || item.product?.unit || "",
      qty: item.qty,
      stock: item.stock ?? 0,
      deliveryTime: item.deliveryTime || "Por definir",
      costUsd: item.cost,
      costCurrency: item.costCurrency,
      marginPct: item.marginPct,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      sourceRequiresReview: item.sourceRequiresReview,
      requiresReview: item.requiresReview,
    })),
  };
};

const toQuote = (stored: SavedQuoteRecord): Quote => ({
  id: stored.quoteId,
  quoteNumber: stored.quoteNumber ?? stored.quoteId,
  status: stored.status,
  createdByName: stored.createdByName,
  branch: stored.branchName ?? "Monterrey",
  currency: stored.currency,
  taxRate: stored.taxRate ?? 0.16,
  summary:
    `Entrega: ${stored.deliveryPlace || "Por definir"} · ` +
    `Pago: ${stored.paymentTerms || "CONTADO"} · ` +
    `Vigencia: ${stored.validityDays || 10} días`,
  customer: stored.client
    ? {
        id: stored.client.id,
        name: stored.client.name,
        lastname: stored.client.lastname,
        phone: stored.client.whatsappPhone,
        email: stored.client.email,
        company: stored.client.companyName,
      }
    : undefined,
  items: stored.items.map((item) => ({
    id: item.id,
    description: item.erpDescription || item.customerDescription || "",
    ean: item.ean || item.erpCode,
    um: item.unit,
    qty: item.qty,
    cost: item.costUsd,
    currency: item.costCurrency || "USD",
    price: item.unitPrice,
    margin: item.marginPct,
  })),
  createdAt: formatDate(stored.createdAt),
  updatedAt: stored.updatedAt,
  fileKey: null,
  chatThreadId: undefined,
  version: "",
  statusVersion: stored.status,
  quoteMeta: {
    pdfSentAt: stored.firstSentAt,
    quoteCreatedAt: stored.createdAt,
    versionCreatedAt: null,
    createdByUser: null,
  },
});

const mapDraftItemToPayload = (item: ManualQuoteItem) => {
  const safeQty = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1;
  const safeCost = Number.isFinite(item.costUsd) && item.costUsd >= 0 ? item.costUsd : 0;
  const erpCode = item.erpCode?.trim() ? item.erpCode.trim() : null;
  const localProductId =
    !erpCode && item.localProductId?.trim() ? item.localProductId.trim() : null;
  const hasLinkedProduct = Boolean(erpCode || localProductId);
  const normalizedErpDescription = item.erpDescription?.trim() || null;
  const erpDescriptionForPayload = hasLinkedProduct ? normalizedErpDescription : null;

  return {
    productId: localProductId,
    externalProductCode: erpCode,
    ean: item.ean?.trim() ? item.ean.trim() : null,
    customerDescription: item.customerDescription?.trim() ? item.customerDescription.trim() : null,
    customerUnit: item.customerUnit?.trim() ? item.customerUnit.trim() : null,
    erpDescription: erpDescriptionForPayload,
    unit: item.unit?.trim() ? item.unit.trim() : "PZA",
    qty: safeQty,
    stock: Number.isFinite(item.stock) ? item.stock : null,
    deliveryTime: item.deliveryTime?.trim() ? item.deliveryTime.trim() : null,
    cost: safeCost,
    costCurrency: item.costCurrency || "USD",
    marginPct: Number.isFinite(item.marginPct) ? item.marginPct : 0,
    unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : undefined,
    sourceRequiresReview: Boolean(item.sourceRequiresReview),
    requiresReview: Boolean(item.requiresReview),
  };
};

const mapDraftItemToExtractionPayload = (item: ManualQuoteItem) => {
  const description = item.customerDescription?.trim() || item.erpDescription?.trim() || "Descripcion pendiente";
  const customerUnit = item.customerUnit?.trim() || null;
  const normalizedUnit = item.unit?.trim() || customerUnit;
  const quantity = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : null;
  const requiresReview =
    Boolean(item.sourceRequiresReview) || Boolean(item.requiresReview) || quantity === null || !normalizedUnit;

  return {
    descriptionOriginal: description,
    descriptionNormalized: description,
    quantity,
    unitOriginal: customerUnit,
    unitNormalized: normalizedUnit,
    requiresReview,
  };
};

const replaceQuoteItems = async (quoteId: string, items: ManualQuoteItem[]): Promise<void> => {
  const current = await getRawQuoteById(quoteId);
  if (!current) {
    throw new Error("No se encontró la cotización para sincronizar partidas.");
  }

  for (const currentItem of current.items) {
    await coreHttpClient.delete(`/api/quotes/${quoteId}/items/${currentItem.id}`, {
      headers: requireAuthHeaders(),
    });
  }

  for (const item of items) {
    await coreHttpClient.post(`/api/quotes/${quoteId}/items`, mapDraftItemToPayload(item), {
      headers: requireAuthHeaders(),
    });
  }
};

const ensureRemoteCustomerId = async (client: Client): Promise<string> => {
  if (isUuid(client.id)) return client.id;

  const mapped = readCustomerMap();
  if (mapped[client.id]) return mapped[client.id];

  const source = client.source === "ERP" ? "ERP" : "LOCAL";
  const externalId = client.externalId?.trim() || null;
  const externalSystem = source === "ERP" ? client.externalSystem?.trim() || "ERP" : client.externalSystem?.trim() || null;

  const payload = {
    source,
    externalId,
    externalSystem,
    code: client.code?.trim() || null,
    firstName: client.name,
    lastName: client.lastname,
    displayName: `${client.name} ${client.lastname}`.trim(),
    legalName: client.companyName || null,
    email: client.email || null,
    phone: client.phone || null,
    whatsapp: client.whatsappPhone,
    taxId: client.rfc || null,
    profileStatus:
      client.rfc?.trim() && client.companyName?.trim() ? "FISCAL_COMPLETED" : "PROSPECT",
  };

  const { data } = await coreHttpClient.post<ApiQuote["customer"] & { id: string }>(
    "/api/customers",
    payload,
    {
      headers: requireAuthHeaders(),
    }
  );

  mapped[client.id] = data.id;
  writeCustomerMap(mapped);
  return data.id;
};

const getRawQuoteById = async (quoteId: string): Promise<ApiQuote | null> => {
  try {
    const { data } = await coreHttpClient.get<ApiQuote>(`/api/quotes/${quoteId}`, {
      headers: requireAuthHeaders(),
    });
    return data;
  } catch {
    return null;
  }
};

const ensureQuotedStatus = async (quoteId: string): Promise<boolean> => {
  const current = await getRawQuoteById(quoteId);
  if (!current) return false;

  if (current.status === "QUOTED" || current.status === "APPROVED") {
    return true;
  }

  if (current.status === "DRAFT") {
    await coreHttpClient.patch(
      `/api/quotes/${quoteId}/status`,
      { status: "PENDING", note: "Moved to pending from frontend workflow." },
      { headers: requireAuthHeaders() }
    );
  }

  const refreshed = await getRawQuoteById(quoteId);
  if (!refreshed) return false;
  if (refreshed.status === "QUOTED" || refreshed.status === "APPROVED") return true;
  if (refreshed.status !== "PENDING") return false;

  await coreHttpClient.patch(
    `/api/quotes/${quoteId}/status`,
    { status: "QUOTED", note: "Marked as quoted from frontend workflow." },
    { headers: requireAuthHeaders() }
  );

  return true;
};

export class QuotesService {
  static async list(params: { page?: number; pageSize?: number }): Promise<PageResult<Quote>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const { data } = await coreHttpClient.get<ApiPaginatedResponse<ApiQuote>>("/api/quotes", {
      params: { page, pageSize },
      headers: requireAuthHeaders(),
    });

    return {
      items: data.items.map((item) => toQuote(mapApiQuoteToSavedRecord(item))),
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    };
  }

  static async getById(quoteId: string): Promise<SavedQuoteRecord | null> {
    const raw = await getRawQuoteById(quoteId);
    if (!raw) return null;
    return mapApiQuoteToSavedRecord(raw);
  }

  static async createFromDraft(
    draft: ManualQuoteDraft,
    options: { status: SavedQuoteStatus; origin?: QuoteDraftOrigin }
  ): Promise<string> {
    if (!draft.client) {
      throw new Error("Selecciona un cliente antes de guardar la cotización.");
    }

    const customerId = await ensureRemoteCustomerId(draft.client);
    const origin = options.origin ?? "MANUAL";
    const draftItemsWithLocalProducts = draft.items;

    let quoteId = draft.savedQuoteId && isUuid(draft.savedQuoteId) ? draft.savedQuoteId : null;

    if (quoteId) {
      await coreHttpClient.patch(
        `/api/quotes/${quoteId}`,
        {
          customerId,
          currency: draft.currency,
          exchangeRate: draft.exchangeRate,
          exchangeRateDate: draft.exchangeRateDate,
          taxRate: draft.taxRate,
          deliveryPlace: draft.deliveryPlace,
          paymentTerms: draft.paymentTerms,
          validityDays: draft.validityDays,
          notes: null,
        },
        { headers: requireAuthHeaders() }
      );

      const current = await getRawQuoteById(quoteId);
      if (!current) throw new Error("No se encontró la cotización para actualizar.");

      for (const item of current.items) {
        await coreHttpClient.delete(`/api/quotes/${quoteId}/items/${item.id}`, {
          headers: requireAuthHeaders(),
        });
      }
    } else if (origin !== "MANUAL") {
      const extractionItems = draft.items.map(mapDraftItemToExtractionPayload);

      const { data } = await coreHttpClient.post<ApiQuote>(
        "/api/quotes/from-extraction",
        {
          customerId,
          currency: draft.currency,
          exchangeRate: draft.exchangeRate,
          exchangeRateDate: draft.exchangeRateDate,
          taxRate: draft.taxRate,
          deliveryPlace: draft.deliveryPlace,
          paymentTerms: draft.paymentTerms,
          validityDays: draft.validityDays,
          origin,
          notes: null,
          items: extractionItems,
        },
        { headers: requireAuthHeaders() }
      );

      quoteId = data.id;
      await replaceQuoteItems(quoteId, draftItemsWithLocalProducts);
    } else {
      const { data } = await coreHttpClient.post<ApiQuote>(
        "/api/quotes",
        {
          customerId,
          currency: draft.currency,
          exchangeRate: draft.exchangeRate,
          exchangeRateDate: draft.exchangeRateDate,
          taxRate: draft.taxRate,
          deliveryPlace: draft.deliveryPlace,
          paymentTerms: draft.paymentTerms,
          validityDays: draft.validityDays,
          origin,
          notes: null,
        },
        { headers: requireAuthHeaders() }
      );
      quoteId = data.id;
    }

    if (origin === "MANUAL" || draft.savedQuoteId) {
      for (const item of draftItemsWithLocalProducts) {
        await coreHttpClient.post(`/api/quotes/${quoteId}/items`, mapDraftItemToPayload(item), {
          headers: requireAuthHeaders(),
        });
      }
    }

    if (options.status === "COTIZADA") {
      const success = await ensureQuotedStatus(quoteId);
      if (!success) throw new Error("No se pudo mover la cotización a COTIZADA.");
    }

    return quoteId;
  }

  static async updateStatus(quoteId: string, status: SavedQuoteStatus): Promise<boolean> {
    try {
      const current = await getRawQuoteById(quoteId);
      if (!current) return false;

      if (status === "COTIZADA") {
        return ensureQuotedStatus(quoteId);
      }

      if (status === "CANCELADA") {
        if (current.status === "CANCELLED") return true;

        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          { status: "CANCELLED", note: "Cancelled from frontend." },
          { headers: requireAuthHeaders() }
        );
        return true;
      }

      if (status === "APROBADA") {
        if (current.status === "APPROVED") return true;
        if (current.status !== "QUOTED") return false;

        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          { status: "APPROVED", note: "Approved from frontend." },
          { headers: requireAuthHeaders() }
        );
        return true;
      }

      if (status === "RECHAZADA") {
        if (current.status === "REJECTED") return true;
        if (current.status !== "QUOTED") return false;

        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          { status: "REJECTED", note: "Rejected from frontend." },
          { headers: requireAuthHeaders() }
        );
        return true;
      }

      if (status === "PENDIENTE") {
        if (current.status === "PENDING") return true;
        if (current.status !== "DRAFT") return false;

        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          { status: "PENDING", note: "Pending status set from frontend." },
          { headers: requireAuthHeaders() }
        );
        return true;
      }

      return true;
    } catch {
      return false;
    }
  }

  static async generateOrder(quoteId: string): Promise<{ ok: boolean; message: string }> {
    try {
      const { data } = await coreHttpClient.post<{ message?: string }>(
        `/api/quotes/${quoteId}/generate-order`,
        {},
        { headers: requireAuthHeaders() }
      );
      return { ok: true, message: data.message || "Pedido generado correctamente." };
    } catch (error) {
      const message = mapAxiosErrorMessage(error, "No se pudo generar el pedido desde el backend.");
      return { ok: false, message };
    }
  }

  static async downloadOrderFile(quoteId: string): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await coreHttpClient.get(`/api/quotes/${quoteId}/order-file`, {
        headers: requireAuthHeaders(),
        responseType: "blob",
      });

      const disposition = (response.headers["content-disposition"] as string | undefined) || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = filenameMatch?.[1] || `pedido-${quoteId}.txt`;
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: "text/plain" });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { ok: true, message: "Pedido descargado correctamente." };
    } catch (error) {
      const message = mapAxiosErrorMessage(error, "No se pudo descargar el archivo del pedido.");
      return { ok: false, message };
    }
  }

  static async registerDeliveryAttempt(
    quoteId: string,
    payload: {
      channel: QuoteDeliveryChannel;
      recipient: string;
      status?: "SENT" | "FAILED";
      providerMessageId?: string;
      errorMessage?: string;
      note?: string;
    }
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const { data } = await coreHttpClient.post<{ id?: string }>(
        `/api/quotes/${quoteId}/delivery-attempts`,
        {
          channel: payload.channel,
          recipient: payload.recipient,
          status: payload.status ?? "SENT",
          providerMessageId: payload.providerMessageId || null,
          errorMessage: payload.errorMessage || null,
          note: payload.note || null,
        },
        { headers: requireAuthHeaders() }
      );
      if (!data) {
        return { ok: false, message: "No se pudo registrar el envío de la cotización." };
      }
      return { ok: true, message: "Envío de cotización registrado." };
    } catch (error) {
      const message = mapAxiosErrorMessage(error, "No se pudo registrar el envío de la cotización.");
      return { ok: false, message };
    }
  }
}
