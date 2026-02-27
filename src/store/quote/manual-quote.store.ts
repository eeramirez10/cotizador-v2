import { create } from "zustand";
import type { User } from "../../interfaces/user.interface";
import type { Client } from "../../modules/clients/types/client.types";
import type { ErpProduct, ErpProductCurrency } from "../../modules/products/types/erp-product.types";

export type QuoteCurrency = "MXN" | "USD";
export type QuoteStatus = "BORRADOR" | "PENDIENTE" | "COTIZADA" | "CANCELADA";

export interface ManualQuoteItem {
  id: string;
  erpCode: string;
  ean: string;
  erpDescription: string;
  unit: string;
  qty: number;
  stock: number;
  deliveryTime: string;
  costUsd: number;
  costCurrency: ErpProductCurrency;
  marginPct: number;
  unitPrice: number;
  subtotal: number;
  requiresReview: boolean;
}

export interface ManualQuoteDraft {
  id: string;
  savedQuoteId: string | null;
  status: QuoteStatus;
  currency: QuoteCurrency;
  exchangeRate: number;
  exchangeRateDate: string;
  exchangeRateSource: "manual" | "api";
  taxRate: number;
  createdByUserId: string | null;
  createdByName: string;
  branchId: string | null;
  branchName: string;
  client: Client | null;
  items: ManualQuoteItem[];
}

interface StoredQuote {
  quoteId: string;
  quoteDraftId: string;
  status: QuoteStatus;
  erpProfile: "GENERIC_TXT";
  erpExportState: "PENDIENTE" | "EXPORTADO";
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  createdByName: string;
  branchId: string | null;
  branchName: string;
  currency: QuoteCurrency;
  exchangeRate: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  client: Client | null;
  items: ManualQuoteItem[];
}

interface ManualQuoteState {
  draft: ManualQuoteDraft;
  initializeDraft: (user?: User) => void;
  setCurrency: (currency: QuoteCurrency) => void;
  setExchangeRate: (exchangeRate: number) => void;
  addProductFromErp: (product: ErpProduct) => void;
  removeItem: (itemId: string) => void;
  setItemQty: (itemId: string, qty: number) => void;
  setItemMargin: (itemId: string, marginPct: number) => void;
  setItemUnitPrice: (itemId: string, unitPrice: number) => void;
  setItemDeliveryTime: (itemId: string, deliveryTime: string) => void;
  setClient: (client: Client | null) => void;
  loadQuoteForEdit: (quoteId: string) => boolean;
  subtotal: () => number;
  tax: () => number;
  total: () => number;
  saveQuoteLocal: (status: QuoteStatus) => string;
  clearDraft: () => void;
}

const STORAGE_QUOTES_KEY = "cotizador-v2-saved-quotes";

const nowIso = () => new Date().toISOString();
const nowDateOnly = () => new Date().toISOString().slice(0, 10);
const round = (value: number) => Number(value.toFixed(2));

const deliverySuggestion = (stock: number, costUsd: number): string => {
  if (stock > 0) return "Inmediato";
  if (costUsd >= 100) return "4-6 semanas";
  if (costUsd >= 40) return "2-4 semanas";
  return "1-2 semanas";
};

const newDraft = (): ManualQuoteDraft => ({
  id: `mq_${Math.random().toString(36).slice(2, 10)}`,
  savedQuoteId: null,
  status: "BORRADOR",
  currency: "MXN",
  exchangeRate: 17.25,
  exchangeRateDate: nowDateOnly(),
  exchangeRateSource: "manual",
  taxRate: 0.16,
  createdByUserId: null,
  createdByName: "",
  branchId: null,
  branchName: "",
  client: null,
  items: [],
});

const getCostInQuoteCurrency = (item: Pick<ManualQuoteItem, "costUsd" | "costCurrency">, currency: QuoteCurrency, exchangeRate: number): number => {
  const safeRate = exchangeRate > 0 ? exchangeRate : 1;
  const costInMxn = item.costCurrency === "USD" ? item.costUsd * safeRate : item.costUsd;
  return currency === "MXN" ? costInMxn : costInMxn / safeRate;
};

const computeItem = (
  item: Omit<ManualQuoteItem, "unitPrice" | "subtotal" | "requiresReview">,
  currency: QuoteCurrency,
  exchangeRate: number
): ManualQuoteItem => {
  const costInQuoteCurrency = getCostInQuoteCurrency(item, currency, exchangeRate);
  const unitPrice = round(costInQuoteCurrency * (1 + item.marginPct / 100));
  const subtotal = round(unitPrice * item.qty);
  const requiresReview = item.qty <= 0 || !item.unit.trim();

  return {
    ...item,
    unitPrice,
    subtotal,
    requiresReview,
  };
};

const recalcItems = (items: ManualQuoteItem[], currency: QuoteCurrency, exchangeRate: number): ManualQuoteItem[] => {
  return items.map((item) =>
    computeItem(
      {
        id: item.id,
        erpCode: item.erpCode,
        ean: item.ean,
        erpDescription: item.erpDescription,
        unit: item.unit,
        qty: item.qty,
        stock: item.stock,
        deliveryTime: item.stock > 0 ? "Inmediato" : item.deliveryTime,
        costUsd: item.costUsd,
        costCurrency: item.costCurrency,
        marginPct: item.marginPct,
      },
      currency,
      exchangeRate
    )
  );
};

const readStoredQuotes = (): StoredQuote[] => {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_QUOTES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredQuote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredQuotes = (quotes: StoredQuote[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_QUOTES_KEY, JSON.stringify(quotes));
};

export const useManualQuoteStore = create<ManualQuoteState>((set, get) => ({
  draft: newDraft(),

  initializeDraft: (user) =>
    set((state) => ({
      draft: {
        ...state.draft,
        createdByUserId: user?.id ?? null,
        createdByName: user ? `${user.name} ${user.lastname}` : "",
        branchId: user?.branchId ?? null,
        branchName: user?.branch?.name ?? "",
      },
    })),

  setCurrency: (currency) =>
    set((state) => ({
      draft: {
        ...state.draft,
        currency,
        items: recalcItems(state.draft.items, currency, state.draft.exchangeRate),
      },
    })),

  setExchangeRate: (exchangeRate) =>
    set((state) => ({
      draft: {
        ...state.draft,
        exchangeRate,
        exchangeRateDate: nowDateOnly(),
        exchangeRateSource: "manual",
        items: recalcItems(state.draft.items, state.draft.currency, exchangeRate),
      },
    })),

  addProductFromErp: (product) =>
    set((state) => {
      const base = {
        id: `itm_${Math.random().toString(36).slice(2, 10)}`,
        erpCode: product.code,
        ean: product.ean,
        erpDescription: product.description,
        unit: product.unit,
        qty: 1,
        stock: product.stock,
        deliveryTime: deliverySuggestion(product.stock, product.costUsd),
        costUsd: product.costUsd,
        costCurrency: product.costCurrency,
        marginPct: 15,
      };

      const nextItem = computeItem(base, state.draft.currency, state.draft.exchangeRate);

      return {
        draft: {
          ...state.draft,
          items: [...state.draft.items, nextItem],
        },
      };
    }),

  removeItem: (itemId) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.filter((item) => item.id !== itemId),
      },
    })),

  setItemQty: (itemId, qty) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: recalcItems(
          state.draft.items.map((item) => (item.id === itemId ? { ...item, qty } : item)),
          state.draft.currency,
          state.draft.exchangeRate
        ),
      },
      })),

  setItemMargin: (itemId, marginPct) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: recalcItems(
          state.draft.items.map((item) => (item.id === itemId ? { ...item, marginPct } : item)),
          state.draft.currency,
          state.draft.exchangeRate
        ),
      },
    })),

  setItemUnitPrice: (itemId, unitPrice) =>
    set((state) => {
      const safeUnitPrice = Math.max(0, unitPrice);

      const nextItems = state.draft.items.map((item) => {
        if (item.id !== itemId) return item;

        const costInQuoteCurrency = getCostInQuoteCurrency(item, state.draft.currency, state.draft.exchangeRate);

        if (costInQuoteCurrency <= 0) {
          return { ...item, marginPct: 0 };
        }

        const nextMargin = Number((((safeUnitPrice / costInQuoteCurrency) - 1) * 100).toFixed(6));
        return { ...item, marginPct: nextMargin };
      });

      return {
        draft: {
          ...state.draft,
          items: recalcItems(nextItems, state.draft.currency, state.draft.exchangeRate),
        },
      };
    }),

  setItemDeliveryTime: (itemId, deliveryTime) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.map((item) => {
          if (item.id !== itemId) return item;
          if (item.stock > 0) return { ...item, deliveryTime: "Inmediato" };
          return { ...item, deliveryTime };
        }),
      },
    })),

  setClient: (client) =>
    set((state) => ({
      draft: {
        ...state.draft,
        client,
      },
    })),

  loadQuoteForEdit: (quoteId) => {
    const stored = readStoredQuotes().find((quote) => quote.quoteId === quoteId);
    if (!stored) return false;

    const normalizedItems = stored.items.map((item) => ({
      ...item,
      ean: item.ean || item.erpCode,
      costCurrency: item.costCurrency || "USD",
    }));

    const loadedItems = recalcItems(normalizedItems, stored.currency, stored.exchangeRate);

    set((state) => ({
      draft: {
        ...state.draft,
        id: stored.quoteDraftId,
        savedQuoteId: stored.quoteId,
        status: stored.status,
        currency: stored.currency,
        exchangeRate: stored.exchangeRate,
        exchangeRateDate: nowDateOnly(),
        exchangeRateSource: "manual",
        taxRate: stored.taxRate,
        createdByUserId: stored.createdByUserId,
        createdByName: stored.createdByName,
        branchId: stored.branchId,
        branchName: stored.branchName,
        client: stored.client,
        items: loadedItems,
      },
    }));

    return true;
  },

  subtotal: () => round(get().draft.items.reduce((acc, item) => acc + item.subtotal, 0)),
  tax: () => round(get().subtotal() * get().draft.taxRate),
  total: () => round(get().subtotal() + get().tax()),

  saveQuoteLocal: (status) => {
    const state = get();
    const now = nowIso();

    const existing = readStoredQuotes();
    const existingQuote = state.draft.savedQuoteId
      ? existing.find((quote) => quote.quoteId === state.draft.savedQuoteId)
      : undefined;

    const quoteId = existingQuote?.quoteId ?? state.draft.savedQuoteId ?? `COT-${Date.now()}`;

    const nextQuote: StoredQuote = {
      quoteId,
      quoteDraftId: state.draft.id,
      status,
      erpProfile: "GENERIC_TXT",
      erpExportState: "PENDIENTE",
      createdAt: existingQuote?.createdAt ?? now,
      updatedAt: now,
      createdByUserId: state.draft.createdByUserId,
      createdByName: state.draft.createdByName,
      branchId: state.draft.branchId,
      branchName: state.draft.branchName,
      currency: state.draft.currency,
      exchangeRate: state.draft.exchangeRate,
      taxRate: state.draft.taxRate,
      subtotal: state.subtotal(),
      tax: state.tax(),
      total: state.total(),
      client: state.draft.client,
      items: state.draft.items,
    };

    const nextQuotes = existing.filter((quote) => quote.quoteId !== quoteId);
    writeStoredQuotes([nextQuote, ...nextQuotes]);

    return quoteId;
  },

  clearDraft: () =>
    set((state) => ({
      draft: {
        ...newDraft(),
        createdByUserId: state.draft.createdByUserId,
        createdByName: state.draft.createdByName,
        branchId: state.draft.branchId,
        branchName: state.draft.branchName,
      },
    })),
}));
