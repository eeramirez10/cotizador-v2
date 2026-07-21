import axios from "axios";
import type { Client } from "../../clients/types/client.types";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { PageResult, Quote } from "../types/quote.types";
import { getAuthToken } from "../../../store/auth/auth.store";
import type {
  ManualQuoteDraft,
  ManualQuoteItem,
  QuoteSourceChannel,
} from "../../../store/quote/manual-quote.store";

export type SavedQuoteStatus = "BORRADOR" | "PENDIENTE" | "PENDIENTE_APROBACION" | "CAMBIOS_SOLICITADOS" | "COTIZADA" | "APROBADA" | "RECHAZADA" | "CANCELADA" | "REEMPLAZADA";
export type QuoteDraftOrigin = "MANUAL" | "FILE_UPLOAD" | "TEXT_INPUT";
export type SavedDeliveryStatus = "NO_ENVIADA" | "ENVIADA";
export type SavedOrderStatus = "NO_GENERADO" | "GENERADO";
export type QuoteDeliveryChannel = "WHATSAPP" | "EMAIL";
export type QuoteRejectionReason = string;
export type QuoteCancellationReason = string;
export type QuoteApprovalReturnReason = string;
export type QuoteRevisionReason = string;

export interface QuoteBranchDetails {
  id: string;
  code: string;
  name: string;
  street: string | null;
  exteriorNumber: string | null;
  interiorNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  municipality: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  secondaryPhone: string | null;
}

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
  createdByEmail: string;
  createdByPhone: string | null;
  branchId: string | null;
  branchName: string;
  branch: QuoteBranchDetails;
  currency: "MXN" | "USD";
  exchangeRate: number;
  taxRate: number;
  deliveryPlace: string;
  paymentTerms: string;
  commercialConditions: string | null;
  validityDays: number;
  sourceChannel: QuoteSourceChannel;
  captureMethod: "SYSTEM" | "EXCEL_IMPORT";
  originalQuoteDate: string;
  rejectionReason: QuoteRejectionReason | null;
  rejectionComment: string | null;
  rejectedAt: string | null;
  rejectedByUser: { id: string; firstName: string; lastName: string } | null;
  cancellationReason: QuoteCancellationReason | null;
  cancellationComment: string | null;
  cancelledAt: string | null;
  cancelledByUser: { id: string; firstName: string; lastName: string } | null;
  approvalReturnReason: QuoteApprovalReturnReason | null;
  approvalReturnComment: string | null;
  rootQuoteId: string | null;
  previousVersionId: string | null;
  supersededByQuoteId: string | null;
  revisionNumber: number;
  revisionReason: QuoteRevisionReason | null;
  revisionComment: string | null;
  supersededAt: string | null;
  nextRevision: { id: string; quoteNumber: string; status: string; revisionNumber: number } | null;
  archivedAt: string | null;
  archivedByUser: { id: string; firstName: string; lastName: string } | null;
  archiveReason: string | null;
  authorizedByUser: { id: string; firstName: string; lastName: string } | null;
  authorizedAt: string | null;
  providedBy: { id: string; fullName: string; branchName: string; branchCode: string } | null;
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
    itemComment?: string;
    costUsd: number;
    costCurrency?: "MXN" | "USD";
    marginPct: number;
    unitPrice: number;
    subtotal: number;
    sourceRequiresReview?: boolean;
    importedFromExcel?: boolean;
    requiresReview: boolean;
  }>;
  relatedVersions: SavedQuoteRecord[];
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
  itemComment: string | null;
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
  clientDraftId: string | null;
  status: "DRAFT" | "PENDING" | "PENDING_APPROVAL" | "CHANGES_REQUESTED" | "QUOTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "SUPERSEDED";
  deliveryStatus: "NOT_SENT" | "SENT";
  firstSentAt: string | null;
  orderStatus: "NOT_GENERATED" | "GENERATED";
  orderGeneratedAt: string | null;
  orderReference: string | null;
  sourceChannel: QuoteSourceChannel;
  captureMethod: "SYSTEM" | "EXCEL_IMPORT";
  originalQuoteDate: string | null;
  rejectionReason: QuoteRejectionReason | null;
  rejectionComment: string | null;
  rejectedAt: string | null;
  rejectedByUser: { id: string; firstName: string; lastName: string } | null;
  cancellationReason: QuoteCancellationReason | null;
  cancellationComment: string | null;
  cancelledAt: string | null;
  cancelledByUser: { id: string; firstName: string; lastName: string } | null;
  approvalReturnReason: QuoteApprovalReturnReason | null;
  approvalReturnComment: string | null;
  rootQuoteId: string | null;
  previousVersionId: string | null;
  supersededByQuoteId: string | null;
  revisionNumber: number;
  revisionReason: QuoteRevisionReason | null;
  revisionComment: string | null;
  supersededAt: string | null;
  nextRevision: { id: string; quoteNumber: string; status: string; revisionNumber: number } | null;
  archivedAt: string | null;
  archivedByUser: { id: string; firstName: string; lastName: string } | null;
  archiveReason: string | null;
  providedByUserId: string | null;
  providedByNameSnapshot: string | null;
  providedByBranchNameSnapshot: string | null;
  currency: "MXN" | "USD";
  exchangeRate: number;
  taxRate: number;
  deliveryPlace: string | null;
  paymentTerms: string;
  commercialConditions: string | null;
  validityDays: number;
  validUntil: string;
  subtotal: number;
  tax: number;
  total: number;
  createdByUserId: string;
  branch: {
    id: string;
    code: string;
    name: string;
    street: string | null;
    exteriorNumber: string | null;
    interiorNumber: string | null;
    neighborhood: string | null;
    city: string | null;
    municipality: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    secondaryPhone: string | null;
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
    email: string;
    phone: string | null;
  };
  events: Array<{
    status: string;
    createdAt: string;
    actorUser: { id: string; firstName: string; lastName: string } | null;
  }>;
  items: ApiQuoteItem[];
  createdAt: string;
  updatedAt: string;
  relatedVersions?: ApiQuote[];
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
  if (status === "PENDING_APPROVAL") return "PENDIENTE_APROBACION";
  if (status === "CHANGES_REQUESTED") return "CAMBIOS_SOLICITADOS";
  if (status === "QUOTED") return "COTIZADA";
  if (status === "APPROVED") return "APROBADA";
  if (status === "REJECTED") return "RECHAZADA";
  if (status === "SUPERSEDED") return "REEMPLAZADA";
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
  const authorizationEvent = apiQuote.events.find(
    (event) => event.status === "QUOTED" && event.actorUser
  );

  return {
    quoteId: apiQuote.id,
    quoteNumber: apiQuote.quoteNumber,
    quoteDraftId: apiQuote.clientDraftId || apiQuote.id,
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
    createdByEmail: apiQuote.createdByUser.email || "",
    createdByPhone: apiQuote.createdByUser.phone || null,
    branchId: apiQuote.branch.id,
    branchName: apiQuote.branch.name,
    branch: apiQuote.branch,
    currency: apiQuote.currency,
    exchangeRate: apiQuote.exchangeRate,
    taxRate: apiQuote.taxRate,
    deliveryPlace: apiQuote.deliveryPlace || "L.A.B. OBRA",
    paymentTerms: apiQuote.paymentTerms || "CONTADO",
    commercialConditions: apiQuote.commercialConditions || null,
    validityDays: apiQuote.validityDays || 10,
    sourceChannel: apiQuote.sourceChannel || "UNSPECIFIED",
    captureMethod: apiQuote.captureMethod || "SYSTEM",
    originalQuoteDate: apiQuote.originalQuoteDate || "",
    rejectionReason: apiQuote.rejectionReason || null,
    rejectionComment: apiQuote.rejectionComment || null,
    rejectedAt: apiQuote.rejectedAt || null,
    rejectedByUser: apiQuote.rejectedByUser || null,
    cancellationReason: apiQuote.cancellationReason || null,
    cancellationComment: apiQuote.cancellationComment || null,
    cancelledAt: apiQuote.cancelledAt || null,
    cancelledByUser: apiQuote.cancelledByUser || null,
    approvalReturnReason: apiQuote.approvalReturnReason || null,
    approvalReturnComment: apiQuote.approvalReturnComment || null,
    rootQuoteId: apiQuote.rootQuoteId || null,
    previousVersionId: apiQuote.previousVersionId || null,
    supersededByQuoteId: apiQuote.supersededByQuoteId || null,
    revisionNumber: apiQuote.revisionNumber || 0,
    revisionReason: apiQuote.revisionReason || null,
    revisionComment: apiQuote.revisionComment || null,
    supersededAt: apiQuote.supersededAt || null,
    nextRevision: apiQuote.nextRevision || null,
    archivedAt: apiQuote.archivedAt || null,
    archivedByUser: apiQuote.archivedByUser || null,
    archiveReason: apiQuote.archiveReason || null,
    authorizedByUser: authorizationEvent?.actorUser || null,
    authorizedAt: authorizationEvent?.createdAt || null,
    providedBy: apiQuote.providedByUserId && apiQuote.providedByNameSnapshot
      ? {
          id: apiQuote.providedByUserId,
          fullName: apiQuote.providedByNameSnapshot,
          branchName: apiQuote.providedByBranchNameSnapshot || "Sin sucursal",
          branchCode: "",
        }
      : null,
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
      itemComment: item.itemComment || "",
      costUsd: item.cost,
      costCurrency: item.costCurrency,
      marginPct: item.marginPct,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      sourceRequiresReview: item.sourceRequiresReview,
      importedFromExcel: apiQuote.captureMethod === "EXCEL_IMPORT",
      requiresReview: item.requiresReview,
    })),
    relatedVersions: (apiQuote.relatedVersions ?? []).map((version) =>
      mapApiQuoteToSavedRecord({ ...version, relatedVersions: [] })
    ),
  };
};

const toQuote = (stored: SavedQuoteRecord): Quote => ({
  id: stored.quoteId,
  quoteNumber: stored.quoteNumber ?? stored.quoteId,
  status: stored.status,
  createdByName: stored.createdByName,
  providedByName: stored.providedBy?.fullName ?? null,
  captureMethod: stored.captureMethod,
  originalQuoteDate: stored.originalQuoteDate || undefined,
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
  revisionNumber: stored.revisionNumber,
  relatedVersions: stored.relatedVersions.map(toQuote),
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
    itemComment: item.itemComment?.trim() ? item.itemComment.trim() : null,
    cost: safeCost,
    costCurrency: item.costCurrency || "USD",
    marginPct: Number.isFinite(item.marginPct) ? item.marginPct : 0,
    unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : undefined,
    sourceRequiresReview: Boolean(item.sourceRequiresReview),
    requiresReview: Boolean(item.requiresReview),
  };
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

const advanceQuoteApproval = async (quoteId: string): Promise<boolean> => {
  const current = await getRawQuoteById(quoteId);
  if (!current) return false;
  if (current.status === "QUOTED" || current.status === "APPROVED") return true;
  if (current.status !== "PENDING_APPROVAL") return false;

  await coreHttpClient.patch(
    `/api/quotes/${quoteId}/status`,
    { status: "QUOTED", note: "Quote approved internally." },
    { headers: requireAuthHeaders() }
  );
  return true;
};

export class QuotesService {
  static async list(params: { page?: number; pageSize?: number; status?: ApiQuote["status"]; archived?: boolean }): Promise<PageResult<Quote>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const { data } = await coreHttpClient.get<ApiPaginatedResponse<ApiQuote>>("/api/quotes", {
      params: { page, pageSize, status: params.status, archived: params.archived || undefined },
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
    const { data } = await coreHttpClient.put<{
      id: string;
      quoteNumber: string;
      clientDraftId: string;
      status: ApiQuote["status"];
    }>(
      `/api/quotes/drafts/${encodeURIComponent(draft.id)}`,
      {
        quoteId: draft.savedQuoteId && isUuid(draft.savedQuoteId) ? draft.savedQuoteId : null,
        action: options.status === "COTIZADA" ? "SUBMIT_FOR_APPROVAL" : "SAVE_DRAFT",
        customerId,
        currency: draft.currency,
        exchangeRate: draft.exchangeRate,
        exchangeRateDate: draft.exchangeRateDate,
        taxRate: draft.taxRate,
        deliveryPlace: draft.deliveryPlace,
        paymentTerms: draft.paymentTerms,
        commercialConditions: draft.commercialConditions || null,
        validityDays: draft.validityDays,
        origin,
        sourceChannel: draft.sourceChannel,
        captureMethod: draft.captureMethod,
        originalQuoteDate: draft.captureMethod === "EXCEL_IMPORT" ? draft.originalQuoteDate : null,
        providedByUserId: draft.providedBy?.id ?? null,
        notes: null,
        items: draft.items.map(mapDraftItemToPayload),
      },
      { headers: requireAuthHeaders() }
    );

    return data.id;
  }

  static async createRevision(
    quoteId: string,
    reason: QuoteRevisionReason,
    comment?: string
  ): Promise<SavedQuoteRecord> {
    const { data } = await coreHttpClient.post<ApiQuote>(
      `/api/quotes/${quoteId}/revisions`,
      { reason, comment: comment?.trim() || null },
      { headers: requireAuthHeaders() }
    );
    return mapApiQuoteToSavedRecord(data);
  }

  static async archiveQuote(quoteId: string, reason: string): Promise<SavedQuoteRecord> {
    const { data } = await coreHttpClient.patch<ApiQuote>(
      `/api/quotes/${quoteId}/archive`,
      { reason: reason.trim() },
      { headers: requireAuthHeaders() }
    );
    return mapApiQuoteToSavedRecord(data);
  }

  static async restoreQuote(quoteId: string): Promise<SavedQuoteRecord> {
    const { data } = await coreHttpClient.patch<ApiQuote>(
      `/api/quotes/${quoteId}/restore`,
      {},
      { headers: requireAuthHeaders() }
    );
    return mapApiQuoteToSavedRecord(data);
  }

  static async deleteQuotePermanently(quoteId: string, confirmation: string, reason: string): Promise<void> {
    await coreHttpClient.delete(`/api/quotes/${quoteId}`, {
      headers: requireAuthHeaders(),
      data: { confirmation: confirmation.trim(), reason: reason.trim() },
    });
  }

  static async updateStatus(
    quoteId: string,
    status: SavedQuoteStatus,
    rejection?: { reason: QuoteRejectionReason; comment?: string },
    cancellation?: { reason: QuoteCancellationReason; comment?: string },
    approvalReturn?: { reason: QuoteApprovalReturnReason; comment?: string }
  ): Promise<boolean> {
    try {
      const current = await getRawQuoteById(quoteId);
      if (!current) return false;

      if (status === "COTIZADA") {
        return advanceQuoteApproval(quoteId);
      }

      if (status === "PENDIENTE_APROBACION") {
        if (current.status === "PENDING_APPROVAL") return true;
        if (!["DRAFT", "PENDING", "CHANGES_REQUESTED"].includes(current.status)) return false;
        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          { status: "PENDING_APPROVAL", note: "Quote submitted for internal approval." },
          { headers: requireAuthHeaders() }
        );
        return true;
      }

      if (status === "CAMBIOS_SOLICITADOS") {
        if (current.status === "CHANGES_REQUESTED") return true;
        if (current.status !== "PENDING_APPROVAL" || !approvalReturn?.reason) return false;
        if (approvalReturn.reason === "OTHER" && !approvalReturn.comment?.trim()) {
          throw new Error("Escribe el detalle del motivo de devolución.");
        }
        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          {
            status: "CHANGES_REQUESTED",
            approvalReturnReason: approvalReturn.reason,
            approvalReturnComment: approvalReturn.comment?.trim() || null,
          },
          { headers: requireAuthHeaders() }
        );
        return true;
      }

      if (status === "CANCELADA") {
        if (current.status === "CANCELLED") return true;
        if (!cancellation?.reason) throw new Error("Selecciona el motivo de cancelación.");
        if (cancellation.reason === "OTHER" && !cancellation.comment?.trim()) {
          throw new Error("Escribe el detalle del motivo de cancelación.");
        }

        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          {
            status: "CANCELLED",
            note: "Cancelled from frontend.",
            cancellationReason: cancellation.reason,
            cancellationComment: cancellation.comment?.trim() || null,
          },
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
        if (!rejection?.reason) throw new Error("Selecciona el motivo de rechazo.");
        if (rejection.reason === "OTHER" && !rejection.comment?.trim()) {
          throw new Error("Escribe el detalle del motivo de rechazo.");
        }

        await coreHttpClient.patch(
          `/api/quotes/${quoteId}/status`,
          {
            status: "REJECTED",
            note: "Rejected from frontend.",
            rejectionReason: rejection.reason,
            rejectionComment: rejection.comment?.trim() || null,
          },
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
