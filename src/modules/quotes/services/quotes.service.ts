import type { PageResult, Quote } from "../types/quote.types";

export type SavedQuoteStatus = "BORRADOR" | "PENDIENTE" | "COTIZADA" | "CANCELADA";

export interface SavedQuoteRecord {
  quoteId: string;
  quoteDraftId: string;
  status: SavedQuoteStatus;
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

const STORAGE_QUOTES_KEY = "cotizador-v2-saved-quotes";
const STORAGE_ERP_ORDERS_KEY = "cotizador-v2-erp-order-queue";

const readStoredQuotes = (): SavedQuoteRecord[] => {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_QUOTES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SavedQuoteRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredQuotes = (quotes: SavedQuoteRecord[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_QUOTES_KEY, JSON.stringify(quotes));
};

const pushErpOrderQueue = (payload: { quoteId: string; requestedAt: string }): void => {
  if (typeof window === "undefined") return;

  const raw = window.localStorage.getItem(STORAGE_ERP_ORDERS_KEY);

  let existing: Array<{ quoteId: string; requestedAt: string }> = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{ quoteId: string; requestedAt: string }>;
      existing = Array.isArray(parsed) ? parsed : [];
    } catch {
      existing = [];
    }
  }

  window.localStorage.setItem(STORAGE_ERP_ORDERS_KEY, JSON.stringify([payload, ...existing]));
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

const toQuote = (stored: SavedQuoteRecord): Quote => ({
  id: stored.quoteId,
  quoteNumber: stored.quoteId.replace("COT-", ""),
  status: stored.status,
  branch: stored.branchName ?? "Monterrey",
  currency: stored.currency,
  taxRate: stored.taxRate ?? 0.16,
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
  summary: undefined,
  chatThreadId: undefined,
  version: "",
  statusVersion: stored.status,
  quoteMeta: {
    pdfSentAt: null,
    quoteCreatedAt: stored.createdAt,
    versionCreatedAt: null,
    createdByUser: null,
  },
});

export class QuotesService {
  static async list(params: { page?: number; pageSize?: number }): Promise<PageResult<Quote>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    await new Promise((resolve) => setTimeout(resolve, 120));

    const quotes = readStoredQuotes().map(toQuote);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: quotes.slice(start, end),
      total: quotes.length,
      page,
      pageSize,
    };
  }

  static async getById(quoteId: string): Promise<SavedQuoteRecord | null> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    const quote = readStoredQuotes().find((item) => item.quoteId === quoteId);
    return quote ?? null;
  }

  static async updateStatus(quoteId: string, status: SavedQuoteStatus): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    const quotes = readStoredQuotes();
    const exists = quotes.some((quote) => quote.quoteId === quoteId);

    if (!exists) return false;

    const updated = quotes.map((quote) => {
      if (quote.quoteId !== quoteId) return quote;

      return {
        ...quote,
        status,
        updatedAt: new Date().toISOString(),
      };
    });

    writeStoredQuotes(updated);
    return true;
  }

  static async generateOrder(quoteId: string): Promise<{ ok: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 120));

    const quotes = readStoredQuotes();
    const target = quotes.find((quote) => quote.quoteId === quoteId);

    if (!target) {
      return { ok: false, message: "No se encontró la cotización." };
    }

    if (target.status !== "COTIZADA") {
      return { ok: false, message: "Solo se puede generar pedido para cotizaciones cotizadas." };
    }

    const updated = quotes.map((quote) => {
      if (quote.quoteId !== quoteId) return quote;

      return {
        ...quote,
        erpExportState: "EXPORTADO" as const,
        updatedAt: new Date().toISOString(),
      };
    });

    writeStoredQuotes(updated);

    // Cola temporal local hasta conectar envío real desde backend.
    pushErpOrderQueue({ quoteId, requestedAt: new Date().toISOString() });

    return { ok: true, message: "Pedido generado correctamente." };
  }
}
