import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../../interfaces/user.interface";
import type { Client } from "../../modules/clients/types/client.types";
import type { ErpProduct, ErpProductCurrency } from "../../modules/products/types/erp-product.types";
import type {
  ExtractedQuoteItem,
  ExtractedQuotedExcelItem,
} from "../../modules/quote-extraction/types/quote-extraction-job.types";
import type { LocalProductBatchResultItem } from "../../modules/products/services/local-products.service";
import { convertQuoteAmount } from "../../modules/quotes/utils/quote-currency";

export type QuoteCurrency = "MXN" | "USD";
export type QuoteCaptureMethod = "SYSTEM" | "EXCEL_IMPORT";
export type QuoteStatus = "BORRADOR" | "PENDIENTE" | "PENDIENTE_APROBACION" | "CAMBIOS_SOLICITADOS" | "COTIZADA" | "APROBADA" | "RECHAZADA" | "CANCELADA" | "REEMPLAZADA";
export type QuoteSourceChannel =
  | "UNSPECIFIED"
  | "EMAIL"
  | "PHONE"
  | "WHATSAPP"
  | "AI_ASSISTANT"
  | "IN_PERSON"
  | "OTHER";

export interface QuoteProvider {
  id: string;
  fullName: string;
  branchName: string;
  branchCode: string;
}

export interface ManualQuoteItem {
  id: string;
  localProductId: string | null;
  erpCode: string;
  ean: string;
  customerDescription: string;
  customerUnit: string;
  erpDescription: string;
  unit: string;
  qty: number;
  stock: number;
  deliveryTime: string;
  itemComment: string;
  sellerSupplierId: string | null;
  sellerSupplierName: string;
  sellerQuotedUnitCost: number | null;
  sellerQuotedCurrency: QuoteCurrency;
  sellerQuotedBrand: string;
  sellerOriginRestrictions: string[];
  sellerDeliveryState: string;
  sellerSupplierDeliveryTime: string;
  purchaseStandard: string;
  purchaseDiameter: string;
  purchaseThickness: string;
  purchaseBore: string;
  costUsd: number;
  costCurrency: ErpProductCurrency;
  marginPct: number;
  manualUnitPrice?: number;
  sourceCurrency?: QuoteCurrency;
  sourceUnitPrice?: number;
  sourceSubtotal?: number;
  unitPrice: number;
  subtotal: number;
  sourceRequiresReview: boolean;
  importedFromExcel?: boolean;
  requiresReview: boolean;
}

export type ProcurementPrequoteData = Pick<
  ManualQuoteItem,
  | "sellerSupplierId"
  | "sellerSupplierName"
  | "sellerQuotedUnitCost"
  | "sellerQuotedCurrency"
  | "sellerQuotedBrand"
  | "sellerOriginRestrictions"
  | "sellerDeliveryState"
  | "sellerSupplierDeliveryTime"
  | "purchaseStandard"
  | "purchaseDiameter"
  | "purchaseThickness"
  | "purchaseBore"
>;

export interface ProcurementPrequoteUpdate {
  itemId: string;
  data: ProcurementPrequoteData;
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
  deliveryPlace: string;
  paymentTerms: string;
  commercialConditions: string;
  validityDays: number;
  sourceChannel: QuoteSourceChannel;
  captureMethod: QuoteCaptureMethod;
  originalQuoteDate: string;
  providedBy: QuoteProvider | null;
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
  deliveryPlace: string;
  paymentTerms: string;
  commercialConditions: string;
  validityDays: number;
  sourceChannel: QuoteSourceChannel;
  captureMethod: QuoteCaptureMethod;
  originalQuoteDate: string;
  providedBy: QuoteProvider | null;
  subtotal: number;
  tax: number;
  total: number;
  client: Client | null;
  items: ManualQuoteItem[];
}

interface HydrateQuoteClient {
  id: string;
  name: string;
  lastname: string;
  whatsappPhone: string;
  email: string;
  rfc: string;
  companyName: string;
  phone?: string;
}

interface HydrateQuoteInput {
  quoteId: string;
  quoteDraftId: string;
  status: QuoteStatus;
  createdByUserId: string | null;
  createdByName: string;
  branchId: string | null;
  branchName: string;
  currency: QuoteCurrency;
  exchangeRate: number;
  taxRate: number;
  deliveryPlace: string;
  paymentTerms: string;
  commercialConditions: string | null;
  validityDays: number;
  sourceChannel: QuoteSourceChannel;
  captureMethod: QuoteCaptureMethod;
  originalQuoteDate: string;
  providedBy?: QuoteProvider | null;
  client: HydrateQuoteClient | null;
  items: ManualQuoteItem[];
}

interface ManualQuoteState {
  draft: ManualQuoteDraft;
  initializeDraft: (user?: User) => void;
  setCurrency: (currency: QuoteCurrency) => void;
  setExchangeRate: (exchangeRate: number) => void;
  setDeliveryPlace: (deliveryPlace: string) => void;
  setPaymentTerms: (paymentTerms: string) => void;
  setCommercialConditions: (commercialConditions: string) => void;
  setValidityDays: (validityDays: number) => void;
  setSourceChannel: (sourceChannel: QuoteSourceChannel) => void;
  setOriginalQuoteDate: (originalQuoteDate: string) => void;
  setProvidedBy: (providedBy: QuoteProvider | null) => void;
  addProductFromErp: (product: ErpProduct) => void;
  assignErpProductToItem: (itemId: string, product: ErpProduct) => void;
  assignLocalProductToItem: (
    itemId: string,
    localProduct: LocalProductBatchResultItem["product"]
  ) => void;
  setItemsFromExtraction: (items: ExtractedQuoteItem[]) => void;
  addItemsFromExtraction: (items: ExtractedQuoteItem[]) => void;
  setItemsFromQuotedExcel: (items: ExtractedQuotedExcelItem[], currency: QuoteCurrency) => void;
  addItemsFromQuotedExcel: (items: ExtractedQuotedExcelItem[], currency: QuoteCurrency) => void;
  removeItem: (itemId: string) => void;
  setItemQty: (itemId: string, qty: number) => void;
  setItemMargin: (itemId: string, marginPct: number) => void;
  setItemUnitPrice: (itemId: string, unitPrice: number) => void;
  setItemDeliveryTime: (itemId: string, deliveryTime: string) => void;
  setItemComment: (itemId: string, itemComment: string) => void;
  setItemProcurementPrequote: (itemId: string, data: ProcurementPrequoteData) => void;
  setItemsProcurementPrequote: (updates: ProcurementPrequoteUpdate[]) => void;
  setClient: (client: Client | null) => void;
  hydrateDraftFromQuote: (quote: HydrateQuoteInput) => void;
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
const roundMargin = (value: number) => Number(value.toFixed(1));

const emptyProcurementPrequote = (): ProcurementPrequoteData => ({
  sellerSupplierId: null,
  sellerSupplierName: "",
  sellerQuotedUnitCost: null,
  sellerQuotedCurrency: "MXN",
  sellerQuotedBrand: "",
  sellerOriginRestrictions: [],
  sellerDeliveryState: "",
  sellerSupplierDeliveryTime: "",
  purchaseStandard: "",
  purchaseDiameter: "",
  purchaseThickness: "",
  purchaseBore: "",
});

const deliverySuggestion = (stock: number, costUsd: number): string => {
  if (stock > 0) return "Inmediato";
  if (costUsd >= 100) return "4-6 semanas";
  if (costUsd >= 40) return "2-4 semanas";
  return "1-2 semanas";
};

const createClientDraftId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `mq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const newDraft = (): ManualQuoteDraft => ({
  id: createClientDraftId(),
  savedQuoteId: null,
  status: "BORRADOR",
  currency: "MXN",
  exchangeRate: 17.25,
  exchangeRateDate: nowDateOnly(),
  exchangeRateSource: "manual",
  taxRate: 0.16,
  deliveryPlace: "L.A.B. OBRA",
  paymentTerms: "CONTADO",
  commercialConditions: "",
  validityDays: 10,
  sourceChannel: "UNSPECIFIED",
  captureMethod: "SYSTEM",
  originalQuoteDate: "",
  providedBy: null,
  createdByUserId: null,
  createdByName: "",
  branchId: null,
  branchName: "",
  client: null,
  items: [],
});

const normalizeImportedItemsToQuoteCurrency = (
  items: ManualQuoteItem[],
  currency: QuoteCurrency
): ManualQuoteItem[] => items.map((item) => (
  item.importedFromExcel
    ? {
        ...item,
        sourceCurrency: currency,
        sourceUnitPrice: item.unitPrice,
        sourceSubtotal: item.subtotal,
      }
    : item
));

const getCostInQuoteCurrency = (
  item: Pick<ManualQuoteItem, "costUsd" | "costCurrency">,
  currency: QuoteCurrency,
  exchangeRate: number
): number => {
  return convertQuoteAmount(item.costUsd, item.costCurrency, currency, exchangeRate);
};

const getSellerPriceCostBase = (
  item: Pick<ManualQuoteItem, "costUsd" | "costCurrency">,
  currency: QuoteCurrency,
  exchangeRate: number
): number => {
  return getCostInQuoteCurrency(item, currency, exchangeRate);
};

const calculateMarginPct = (unitPrice: number, sellerPriceCostBase: number): number => {
  if (sellerPriceCostBase <= 0) return 0;
  const rawMargin = ((unitPrice / sellerPriceCostBase) - 1) * 100;
  return Math.abs(rawMargin) < 0.005 ? 0 : roundMargin(rawMargin);
};

const computeItem = (
  item: Omit<ManualQuoteItem, "unitPrice" | "subtotal" | "requiresReview">,
  currency: QuoteCurrency,
  exchangeRate: number
): ManualQuoteItem => {
  const sellerPriceCostBase = getSellerPriceCostBase(item, currency, exchangeRate);
  const normalizedMarginPct = roundMargin(item.marginPct);
  const hasExcelSourcePrice = item.importedFromExcel
    && Number.isFinite(item.sourceUnitPrice)
    && (item.sourceUnitPrice ?? 0) >= 0;
  const hasManualPrice = Number.isFinite(item.manualUnitPrice) && (item.manualUnitPrice ?? 0) >= 0;
  const unitPrice = hasExcelSourcePrice
    ? round(item.sourceUnitPrice ?? 0)
    : hasManualPrice
    ? round(Math.max(0, item.manualUnitPrice ?? 0))
    : sellerPriceCostBase > 0
      ? round(sellerPriceCostBase * (1 + normalizedMarginPct / 100))
      : round(0);
  const marginPct = hasManualPrice ? calculateMarginPct(unitPrice, sellerPriceCostBase) : normalizedMarginPct;
  const sourceSubtotal = hasExcelSourcePrice
    ? round((item.sourceUnitPrice ?? 0) * item.qty)
    : item.sourceSubtotal;
  const subtotal = round(unitPrice * item.qty);
  const hasCurrentProduct = Boolean(item.localProductId?.trim() || item.erpCode.trim() || item.ean.trim());
  const hasCurrentDescription = Boolean(item.erpDescription.trim());
  const requiresReview = item.importedFromExcel
    ? !item.customerDescription.trim() || item.qty <= 0 || !item.unit.trim() || unitPrice <= 0 || !item.deliveryTime.trim()
    : !hasCurrentProduct || !hasCurrentDescription || item.qty <= 0 || !item.unit.trim();

  return {
    ...item,
    marginPct,
    unitPrice,
    subtotal,
    sourceSubtotal,
    requiresReview,
  };
};

const recalcItems = (items: ManualQuoteItem[], currency: QuoteCurrency, exchangeRate: number): ManualQuoteItem[] => {
  return items.map((item) =>
    computeItem(
      {
        id: item.id,
        localProductId: item.localProductId,
        erpCode: item.erpCode,
        ean: item.ean,
        customerDescription: item.customerDescription,
        customerUnit: item.customerUnit,
        erpDescription: item.erpDescription,
        unit: item.unit,
        qty: item.qty,
        stock: item.stock,
        deliveryTime: item.stock > 0 && !item.importedFromExcel ? "Inmediato" : item.deliveryTime,
        itemComment: item.itemComment,
        sellerSupplierId: item.sellerSupplierId,
        sellerSupplierName: item.sellerSupplierName,
        sellerQuotedUnitCost: item.sellerQuotedUnitCost,
        sellerQuotedCurrency: item.sellerQuotedCurrency,
        sellerQuotedBrand: item.sellerQuotedBrand,
        sellerOriginRestrictions: item.sellerOriginRestrictions,
        sellerDeliveryState: item.sellerDeliveryState,
        sellerSupplierDeliveryTime: item.sellerSupplierDeliveryTime,
        purchaseStandard: item.purchaseStandard,
        purchaseDiameter: item.purchaseDiameter,
        purchaseThickness: item.purchaseThickness,
        purchaseBore: item.purchaseBore,
        costUsd: item.costUsd,
        costCurrency: item.costCurrency,
        marginPct: item.marginPct,
        manualUnitPrice: item.manualUnitPrice,
        sourceCurrency: item.sourceCurrency,
        sourceUnitPrice: item.sourceUnitPrice,
        sourceSubtotal: item.sourceSubtotal,
        sourceRequiresReview: item.sourceRequiresReview,
        importedFromExcel: item.importedFromExcel,
      },
      currency,
      exchangeRate
    )
  );
};

const createItemsFromExtraction = (
  items: ExtractedQuoteItem[],
  currency: QuoteCurrency,
  exchangeRate: number
): ManualQuoteItem[] =>
  items.map((item) =>
    computeItem(
      {
        id: `itm_${Math.random().toString(36).slice(2, 10)}`,
        localProductId: null,
        erpCode: "",
        ean: "",
        customerDescription: (item.description_normalizada || item.description_original || "").toString().trim().toUpperCase(),
        customerUnit: (item.unidad_original || item.unidad_normalizada || "").toString().trim(),
        erpDescription: "",
        unit: (item.unidad_original || item.unidad_normalizada || "").toString().trim(),
        qty: item.cantidad ?? 0,
        stock: 0,
        deliveryTime: "Por definir",
        itemComment: "",
        ...emptyProcurementPrequote(),
        costUsd: 0,
        costCurrency: "USD",
        marginPct: 0,
        manualUnitPrice: undefined,
        sourceRequiresReview: item.requiere_revision,
      },
      currency,
      exchangeRate
    )
  );

const createItemsFromQuotedExcel = (
  items: ExtractedQuotedExcelItem[],
  currency: QuoteCurrency,
  exchangeRate: number
): ManualQuoteItem[] =>
  items.map((item) =>
    computeItem(
      {
        id: `itm_${Math.random().toString(36).slice(2, 10)}`,
        localProductId: null,
        erpCode: "",
        ean: "",
        customerDescription: (item.description_normalizada || item.description_original || "").trim().toUpperCase(),
        customerUnit: (item.unidad || "").trim(),
        erpDescription: "",
        unit: (item.unidad || "").trim(),
        qty: item.cantidad ?? 0,
        stock: 0,
        deliveryTime: (item.tiempo_entrega || "").trim(),
        itemComment: "",
        ...emptyProcurementPrequote(),
        costUsd: 0,
        costCurrency: currency,
        marginPct: 0,
        manualUnitPrice: undefined,
        sourceCurrency: currency,
        sourceUnitPrice: item.precio_vendedor ?? undefined,
        sourceSubtotal: item.subtotal ?? undefined,
        sourceRequiresReview: item.requiere_revision,
        importedFromExcel: true,
      },
      currency,
      exchangeRate
    )
  );

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

export const useManualQuoteStore = create<ManualQuoteState>()(persist((set, get) => ({
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
    set((state) => {
      if (currency === state.draft.currency || state.draft.captureMethod === "EXCEL_IMPORT") return state;
      const convertedItems = state.draft.items.map((item) => ({
        ...item,
        manualUnitPrice: Number.isFinite(item.manualUnitPrice)
          ? round(convertQuoteAmount(item.manualUnitPrice ?? 0, state.draft.currency, currency, state.draft.exchangeRate))
          : undefined,
      }));
      return {
        draft: {
          ...state.draft,
          currency,
          items: recalcItems(convertedItems, currency, state.draft.exchangeRate),
        },
      };
    }),

  setExchangeRate: (exchangeRate) =>
    set((state) => ({
      draft: {
        ...state.draft,
        exchangeRate,
        exchangeRateDate: nowDateOnly(),
        exchangeRateSource: "manual",
        items: state.draft.captureMethod === "EXCEL_IMPORT"
          ? state.draft.items
          : recalcItems(state.draft.items, state.draft.currency, exchangeRate),
      },
    })),

  setDeliveryPlace: (deliveryPlace) =>
    set((state) => ({
      draft: {
        ...state.draft,
        deliveryPlace,
      },
    })),

  setPaymentTerms: (paymentTerms) =>
    set((state) => ({
      draft: {
        ...state.draft,
        paymentTerms,
      },
    })),

  setCommercialConditions: (commercialConditions) =>
    set((state) => ({ draft: { ...state.draft, commercialConditions } })),

  setValidityDays: (validityDays) =>
    set((state) => ({
      draft: {
        ...state.draft,
        validityDays,
      },
    })),

  setSourceChannel: (sourceChannel) =>
    set((state) => ({
      draft: {
        ...state.draft,
        sourceChannel,
      },
    })),

  setOriginalQuoteDate: (originalQuoteDate) =>
    set((state) => ({
      draft: { ...state.draft, originalQuoteDate },
    })),

  setProvidedBy: (providedBy) =>
    set((state) => ({
      draft: {
        ...state.draft,
        providedBy,
      },
    })),

  addProductFromErp: (product) =>
    set((state) => {
      const base = {
        id: `itm_${Math.random().toString(36).slice(2, 10)}`,
        localProductId: null,
        erpCode: product.code,
        ean: product.ean,
        customerDescription: "",
        customerUnit: "",
        erpDescription: product.description,
        unit: product.unit,
        qty: 1,
        stock: product.stock,
        deliveryTime: deliverySuggestion(product.stock, product.costUsd),
        itemComment: "",
        ...emptyProcurementPrequote(),
        costUsd: product.costUsd,
        costCurrency: product.costCurrency,
        marginPct: 15,
        sourceRequiresReview: false,
      };

      const nextItem = computeItem(base, state.draft.currency, state.draft.exchangeRate);

      return {
        draft: {
          ...state.draft,
          items: [...state.draft.items, nextItem],
        },
      };
    }),

  assignErpProductToItem: (itemId, product) =>
    set((state) => {
      const nextItems = state.draft.items.map((item) => {
        if (item.id !== itemId) return item;

        return {
          ...item,
          ...emptyProcurementPrequote(),
          localProductId: null,
          erpCode: product.code,
          ean: product.ean,
          erpDescription: product.description,
          unit: product.unit,
          stock: product.stock,
          deliveryTime: item.importedFromExcel
            ? item.deliveryTime
            : deliverySuggestion(product.stock, product.costUsd),
          costUsd: product.costUsd,
          costCurrency: product.costCurrency,
          marginPct: item.marginPct > 0 ? item.marginPct : 15,
          sourceRequiresReview: false,
          manualUnitPrice: item.importedFromExcel ? item.manualUnitPrice : undefined,
        };
      });

      return {
        draft: {
          ...state.draft,
          items: recalcItems(nextItems, state.draft.currency, state.draft.exchangeRate),
        },
      };
    }),

  assignLocalProductToItem: (itemId, localProduct) =>
    set((state) => {
      const nextItems = state.draft.items.map((item) => {
        if (item.id !== itemId) return item;

        return {
          ...item,
          localProductId: localProduct.id,
          erpCode: "",
          ean: localProduct.ean || item.ean,
          erpDescription: item.erpDescription.trim() || localProduct.description,
          marginPct: item.marginPct > 0 ? item.marginPct : 15,
          sourceRequiresReview: false,
          manualUnitPrice: item.importedFromExcel ? item.manualUnitPrice : undefined,
        };
      });

      return {
        draft: {
          ...state.draft,
          items: recalcItems(nextItems, state.draft.currency, state.draft.exchangeRate),
        },
      };
    }),

  setItemsFromExtraction: (items) =>
    set((state) => {
      const nextItems = createItemsFromExtraction(items, state.draft.currency, state.draft.exchangeRate);

      return {
        draft: {
          ...state.draft,
          status: "BORRADOR",
          items: nextItems,
        },
      };
    }),

  addItemsFromExtraction: (items) =>
    set((state) => ({
      draft: {
        ...state.draft,
        status: "BORRADOR",
        items: [...state.draft.items, ...createItemsFromExtraction(items, state.draft.currency, state.draft.exchangeRate)],
      },
    })),

  setItemsFromQuotedExcel: (items, currency) =>
    set((state) => ({
      draft: {
        ...state.draft,
        status: "BORRADOR",
        currency,
        captureMethod: "EXCEL_IMPORT",
        originalQuoteDate: state.draft.originalQuoteDate || nowDateOnly(),
        items: createItemsFromQuotedExcel(items, currency, state.draft.exchangeRate),
      },
    })),

  addItemsFromQuotedExcel: (items, currency) =>
    set((state) => {
      const existingItems = currency === state.draft.currency
        ? state.draft.items
        : recalcItems(
            state.draft.items.map((item) => ({
              ...item,
              manualUnitPrice: Number.isFinite(item.manualUnitPrice)
                ? round(convertQuoteAmount(item.manualUnitPrice ?? 0, state.draft.currency, currency, state.draft.exchangeRate))
                : undefined,
            })),
            currency,
            state.draft.exchangeRate
          );

      return {
        draft: {
          ...state.draft,
          status: "BORRADOR",
          currency,
          captureMethod: "EXCEL_IMPORT",
          originalQuoteDate: state.draft.originalQuoteDate || nowDateOnly(),
          items: [
            ...existingItems,
            ...createItemsFromQuotedExcel(items, currency, state.draft.exchangeRate),
          ],
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
          state.draft.items.map((item) =>
            item.id === itemId ? { ...item, marginPct: roundMargin(marginPct), manualUnitPrice: undefined } : item
          ),
          state.draft.currency,
          state.draft.exchangeRate
        ),
      },
    })),

  setItemUnitPrice: (itemId, unitPrice) =>
    set((state) => {
      const safeUnitPrice = round(Math.max(0, unitPrice));

      const nextItems = state.draft.items.map((item) => {
        if (item.id !== itemId) return item;
        if (item.importedFromExcel) {
          return {
            ...item,
            sourceUnitPrice: safeUnitPrice,
            sourceSubtotal: round(safeUnitPrice * item.qty),
            manualUnitPrice: undefined,
          };
        }
        if (Math.abs(safeUnitPrice - item.unitPrice) < 0.000001) {
          return item;
        }

        const sellerPriceCostBase = getSellerPriceCostBase(item, state.draft.currency, state.draft.exchangeRate);

        return {
          ...item,
          manualUnitPrice: safeUnitPrice,
          marginPct: calculateMarginPct(safeUnitPrice, sellerPriceCostBase),
        };
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
        items: recalcItems(
          state.draft.items.map((item) => {
            if (item.id !== itemId) return item;
            if (item.stock > 0) return { ...item, deliveryTime: "Inmediato" };
            return { ...item, deliveryTime };
          }),
          state.draft.currency,
          state.draft.exchangeRate
        ),
      },
    })),

  setItemComment: (itemId, itemComment) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.map((item) => (item.id === itemId ? { ...item, itemComment } : item)),
      },
    })),

  setItemProcurementPrequote: (itemId, data) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.map((item) => (item.id === itemId ? { ...item, ...data } : item)),
      },
    })),

  setItemsProcurementPrequote: (updates) =>
    set((state) => {
      const updatesByItemId = new Map(updates.map((update) => [update.itemId, update.data]));
      const items = state.draft.items.map((item) => {
        const data = updatesByItemId.get(item.id);
        if (!data) return item;

        const quotedCost = data.sellerQuotedUnitCost;
        if (quotedCost === null || !Number.isFinite(quotedCost)) {
          return { ...item, ...data };
        }

        const unitPrice = round(convertQuoteAmount(
          quotedCost,
          data.sellerQuotedCurrency,
          state.draft.currency,
          state.draft.exchangeRate
        ));
        const sellerPriceCostBase = getSellerPriceCostBase(
          item,
          state.draft.currency,
          state.draft.exchangeRate
        );

        return {
          ...item,
          ...data,
          manualUnitPrice: unitPrice,
          marginPct: calculateMarginPct(unitPrice, sellerPriceCostBase),
        };
      });

      return {
        draft: {
          ...state.draft,
          items: recalcItems(items, state.draft.currency, state.draft.exchangeRate),
        },
      };
    }),

  setClient: (client) =>
    set((state) => ({
      draft: {
        ...state.draft,
        client,
      },
    })),

  hydrateDraftFromQuote: (quote) =>
    set((state) => {
      const normalizedItems = quote.items.map((item) => ({
        ...item,
        localProductId: item.localProductId || null,
        ean: item.ean || item.erpCode,
        customerDescription: item.customerDescription || (!item.erpCode ? item.erpDescription || "" : ""),
        customerUnit: item.customerUnit || (!item.erpCode ? item.unit || "" : ""),
        itemComment: item.itemComment || "",
        sellerSupplierId: item.sellerSupplierId || null,
        sellerSupplierName: item.sellerSupplierName || "",
        sellerQuotedUnitCost: Number.isFinite(item.sellerQuotedUnitCost) ? item.sellerQuotedUnitCost : null,
        sellerQuotedCurrency: item.sellerQuotedCurrency || "MXN",
        sellerQuotedBrand: item.sellerQuotedBrand || "",
        sellerOriginRestrictions: Array.isArray(item.sellerOriginRestrictions) ? item.sellerOriginRestrictions : [],
        sellerDeliveryState: item.sellerDeliveryState || "",
        sellerSupplierDeliveryTime: item.sellerSupplierDeliveryTime || "",
        purchaseStandard: item.purchaseStandard || "",
        purchaseDiameter: item.purchaseDiameter || "",
        purchaseThickness: item.purchaseThickness || "",
        purchaseBore: item.purchaseBore || "",
        erpDescription: item.erpCode ? item.erpDescription : "",
        costCurrency: item.costCurrency || "USD",
        sourceRequiresReview: item.sourceRequiresReview || false,
        sourceCurrency: item.importedFromExcel ? quote.currency : item.sourceCurrency,
        sourceUnitPrice: item.importedFromExcel ? item.unitPrice : item.sourceUnitPrice,
        sourceSubtotal: item.importedFromExcel ? item.subtotal : item.sourceSubtotal,
        manualUnitPrice: item.importedFromExcel ? undefined : item.costUsd <= 0 && item.unitPrice > 0 ? item.unitPrice : undefined,
      }));

      const loadedItems = recalcItems(normalizedItems, quote.currency, quote.exchangeRate);
      const hydratedClient = quote.client
        ? {
            ...quote.client,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            createdByUserId: quote.createdByUserId,
            createdByName: quote.createdByName,
            updatedByUserId: quote.createdByUserId,
            updatedByName: quote.createdByName,
          }
        : null;

      return {
        draft: {
          ...state.draft,
          id: quote.quoteDraftId,
          savedQuoteId: quote.quoteId,
          status: quote.status,
          currency: quote.currency,
          exchangeRate: quote.exchangeRate,
          exchangeRateDate: nowDateOnly(),
          exchangeRateSource: "manual",
          taxRate: quote.taxRate,
          deliveryPlace: quote.deliveryPlace,
          paymentTerms: quote.paymentTerms,
          commercialConditions: quote.commercialConditions || "",
          validityDays: quote.validityDays,
          sourceChannel: quote.sourceChannel || "UNSPECIFIED",
          captureMethod: quote.captureMethod || "SYSTEM",
          originalQuoteDate: quote.originalQuoteDate || "",
          providedBy: quote.providedBy || null,
          createdByUserId: quote.createdByUserId,
          createdByName: quote.createdByName,
          branchId: quote.branchId,
          branchName: quote.branchName,
          client: hydratedClient,
          items: loadedItems,
        },
      };
    }),

  loadQuoteForEdit: (quoteId) => {
    const stored = readStoredQuotes().find((quote) => quote.quoteId === quoteId);
    if (!stored) return false;

    const normalizedItems = stored.items.map((item) => ({
      ...item,
      localProductId: item.localProductId || null,
      ean: item.ean || item.erpCode,
      customerDescription: item.customerDescription || (!item.erpCode ? item.erpDescription || "" : ""),
      customerUnit: item.customerUnit || (!item.erpCode ? item.unit || "" : ""),
      itemComment: item.itemComment || "",
      sellerSupplierId: item.sellerSupplierId || null,
      sellerSupplierName: item.sellerSupplierName || "",
      sellerQuotedUnitCost: Number.isFinite(item.sellerQuotedUnitCost) ? item.sellerQuotedUnitCost : null,
      sellerQuotedCurrency: item.sellerQuotedCurrency || "MXN",
      sellerQuotedBrand: item.sellerQuotedBrand || "",
      sellerOriginRestrictions: Array.isArray(item.sellerOriginRestrictions) ? item.sellerOriginRestrictions : [],
      sellerDeliveryState: item.sellerDeliveryState || "",
      sellerSupplierDeliveryTime: item.sellerSupplierDeliveryTime || "",
      purchaseStandard: item.purchaseStandard || "",
      purchaseDiameter: item.purchaseDiameter || "",
      purchaseThickness: item.purchaseThickness || "",
      purchaseBore: item.purchaseBore || "",
      erpDescription: item.erpCode ? item.erpDescription : "",
      costCurrency: item.costCurrency || "USD",
      sourceRequiresReview: item.sourceRequiresReview || false,
      sourceCurrency: item.importedFromExcel ? stored.currency : item.sourceCurrency,
      sourceUnitPrice: item.importedFromExcel ? item.unitPrice : item.sourceUnitPrice,
      sourceSubtotal: item.importedFromExcel ? item.subtotal : item.sourceSubtotal,
      manualUnitPrice: item.importedFromExcel ? undefined : item.costUsd <= 0 && item.unitPrice > 0 ? item.unitPrice : undefined,
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
        deliveryPlace: stored.deliveryPlace || "L.A.B. OBRA",
        paymentTerms: stored.paymentTerms || "CONTADO",
        commercialConditions: stored.commercialConditions || "",
        validityDays: Number.isFinite(stored.validityDays) && stored.validityDays > 0 ? stored.validityDays : 10,
        sourceChannel: stored.sourceChannel || "UNSPECIFIED",
        captureMethod: stored.captureMethod || "SYSTEM",
        originalQuoteDate: stored.originalQuoteDate || "",
        providedBy: stored.providedBy || null,
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
      deliveryPlace: state.draft.deliveryPlace,
      paymentTerms: state.draft.paymentTerms,
      commercialConditions: state.draft.commercialConditions,
      validityDays: state.draft.validityDays,
      sourceChannel: state.draft.sourceChannel,
      captureMethod: state.draft.captureMethod,
      originalQuoteDate: state.draft.originalQuoteDate,
      providedBy: state.draft.providedBy,
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
}), {
  name: "cotizador-v2-manual-quote-draft",
  partialize: (state) => ({ draft: state.draft }),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<ManualQuoteState>;
    if (!persisted.draft) return currentState;

    const draft = persisted.draft.captureMethod === "EXCEL_IMPORT"
      ? {
          ...persisted.draft,
          items: normalizeImportedItemsToQuoteCurrency(
            persisted.draft.items,
            persisted.draft.currency
          ),
        }
      : persisted.draft;

    return {
      ...currentState,
      ...persisted,
      draft,
    };
  },
}));
