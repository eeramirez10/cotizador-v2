import { FileCheck2, FileSpreadsheet, FileText, FileUp, Loader2, MessageSquare, MessageSquareText, Paperclip, Pencil, Plus, RotateCcw, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LocalProductsService } from "../../modules/products/services/local-products.service";
import { useNavigate, useSearchParams } from "react-router";
import { QuotesService } from "../../modules/quotes/services/quotes.service";
import { AddErpProductsModal } from "../../shared/components/modals/add-erp-products.modal";
import { SelectClientModal } from "../../shared/components/modals/select-client.modal";
import { QuoteExtractionModal } from "../../shared/components/modals/quote-extraction.modal";
import { QuotedExcelImportModal } from "../../shared/components/modals/quoted-excel-import.modal";
import { SelectQuoteProviderModal } from "../../shared/components/modals/select-quote-provider.modal";
import { LocalProductDedupModal } from "../../shared/components/modals/local-product-dedup.modal";
import { SellerProcurementBulkPrequoteModal } from "../../shared/components/modals/seller-procurement-bulk-prequote.modal";
import { SellerProcurementPrequoteModal } from "../../shared/components/modals/seller-procurement-prequote.modal";
import { ExcelImportedQuoteItemsTable } from "../../shared/components/tables/excel-imported-quote-items.table";
import { notifier } from "../../shared/notifications/notifier";
import { useQuoteCatalogs } from "../../queries/quote-catalogs/use-quote-catalogs";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";
import { useDraftAttachments } from "../../queries/attachments/use-attachments";
import { useAuthStore } from "../../store/auth/auth.store";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";
import type { ManualQuoteItem, QuoteSourceChannel } from "../../store/quote/manual-quote.store";
import { convertQuoteAmount, getErpCostDisplayAmount, getErpCostDisplayCurrency } from "../../modules/quotes/utils/quote-currency";
import { AttachmentsModal } from "../../shared/components/attachments/attachments.modal";
import { AttachmentsService, type FileAttachment } from "../../modules/attachments/services/attachments.service";

type OriginFilter = "ALL" | "UNLINKED";

const LOCAL_PRODUCT_UNITS = new Set(["PZA", "M", "FT", "KG", "TR", "SE", "MPZ", "LB", "CM", "MM", "IN", "GAL", "L"]);
const getLocalProductUnit = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  return LOCAL_PRODUCT_UNITS.has(normalized) ? normalized : "PZA";
};

const SOURCE_CHANNEL_OPTIONS: Array<{ value: QuoteSourceChannel; label: string }> = [
  { value: "UNSPECIFIED", label: "Seleccionar origen" },
  { value: "EMAIL", label: "Correo" },
  { value: "PHONE", label: "Teléfono" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "AI_ASSISTANT", label: "Asistente IA" },
  { value: "IN_PERSON", label: "Presencial" },
  { value: "OTHER", label: "Otro" },
];

const formatCurrency = (value: number, currency: "MXN" | "USD") => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

const getDisplayCost = (
  cost: number,
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD",
  exchangeRate: number
): number => {
  return getErpCostDisplayAmount(cost, productCurrency, quoteCurrency, exchangeRate);
};

const getDisplayCostCurrency = (
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD"
): "MXN" | "USD" => {
  return getErpCostDisplayCurrency(productCurrency, quoteCurrency);
};

const getSellerPriceCostBase = (
  cost: number,
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD",
  exchangeRate: number
): number => {
  return convertQuoteAmount(cost, productCurrency, quoteCurrency, exchangeRate);
};

const getMarginVisual = (marginPct: number) => {
  if (marginPct < 0) {
    return {
      inputClass: "border-rose-400 bg-rose-50 text-rose-700",
      badgeClass: " text-rose-700",
      label: "Margen negativo",
    };
  }

  if (marginPct < 10) {
    return {
      inputClass: "border-amber-400 bg-amber-50 text-amber-700",
      badgeClass: "text-amber-700",
      label: "Margen bajo",
    };
  }

  return {
    inputClass: "border-emerald-400 bg-emerald-50 text-emerald-700",
    badgeClass: "text-emerald-700",
    label: "Margen saludable",
  };
};

const isErpWithoutEnoughStock = (item: ManualQuoteItem): boolean => {
  const hasErpCode = Boolean(item.erpCode.trim());
  return hasErpCode && Math.max(0, item.stock) < item.qty;
};

const requiresProcurementPrequote = (item: ManualQuoteItem): boolean => {
  const hasErpCode = Boolean(item.erpCode.trim());
  const isLocalProduct = !hasErpCode && Boolean(item.localProductId?.trim());
  return isLocalProduct || isErpWithoutEnoughStock(item);
};

const hasCompleteProcurementPrequote = (item: ManualQuoteItem): boolean => {
  return Boolean(
    item.sellerSupplierId
    && item.sellerSupplierName.trim()
    && item.sellerQuotedUnitCost !== null
    && item.sellerQuotedUnitCost > 0
    && item.sellerDeliveryState.trim()
    && item.sellerSupplierDeliveryTime.trim()
  );
};

export const ManualQuotePage = ({ entryMode = "SYSTEM" }: { entryMode?: "SYSTEM" | "EXCEL_IMPORT" }) => {
  const [openModal, setOpenModal] = useState(false);
  const [openClientModal, setOpenClientModal] = useState(false);
  const [erpTargetItemId, setErpTargetItemId] = useState<string | null>(null);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [marginDrafts, setMarginDrafts] = useState<Record<string, string>>({});
  const [exchangeRateDraft, setExchangeRateDraft] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<OriginFilter>("ALL");
  const [creatingLocalItems, setCreatingLocalItems] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "quote" | null>(null);
  const [showCustomerOrderColumns, setShowCustomerOrderColumns] = useState(false);
  const [commentItemId, setCommentItemId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [descriptionItemId, setDescriptionItemId] = useState<string | null>(null);
  const [customerDescriptionDraft, setCustomerDescriptionDraft] = useState("");
  const [extractionModal, setExtractionModal] = useState<"file" | "text" | null>(null);
  const [openQuotedExcelImport, setOpenQuotedExcelImport] = useState(false);
  const [showCancelEditConfirmation, setShowCancelEditConfirmation] = useState(false);
  const [showClearExcelConfirmation, setShowClearExcelConfirmation] = useState(false);
  const [clearingExcelDraft, setClearingExcelDraft] = useState(false);
  const [localProductConfirmationItemId, setLocalProductConfirmationItemId] = useState<string | null>(null);
  const [openQuoteProviderModal, setOpenQuoteProviderModal] = useState(false);
  const [showCommercialConditionsModal, setShowCommercialConditionsModal] = useState(false);
  const [procurementItemId, setProcurementItemId] = useState<string | null>(null);
  const [showBulkProcurement, setShowBulkProcurement] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteIdFromQuery = searchParams.get("quoteId");
  const sourceParam = searchParams.get("source");
  const openExtractionParam = searchParams.get("open");
  const fromExtractionSource = sourceParam === "file" || sourceParam === "text";

  const user = useAuthStore((state) => state.user);
  const capabilities = useSystemCapabilities();
  const quoteInternalApprovalEnabled = capabilities.data?.quoteInternalApprovalEnabled ?? true;

  useEffect(() => {
    if (openExtractionParam !== "file" && openExtractionParam !== "text") return;
    setExtractionModal(openExtractionParam);
    navigate("/cotizador/sistema", { replace: true });
  }, [navigate, openExtractionParam]);

  const draft = useManualQuoteStore((state) => state.draft);
  const draftAttachments = useDraftAttachments(draft.id);
  const initializeDraft = useManualQuoteStore((state) => state.initializeDraft);
  const setCurrency = useManualQuoteStore((state) => state.setCurrency);
  const setExchangeRate = useManualQuoteStore((state) => state.setExchangeRate);
  const setDeliveryPlace = useManualQuoteStore((state) => state.setDeliveryPlace);
  const setPaymentTerms = useManualQuoteStore((state) => state.setPaymentTerms);
  const setCommercialConditions = useManualQuoteStore((state) => state.setCommercialConditions);
  const setValidityDays = useManualQuoteStore((state) => state.setValidityDays);
  const setSourceChannel = useManualQuoteStore((state) => state.setSourceChannel);
  const setOriginalQuoteDate = useManualQuoteStore((state) => state.setOriginalQuoteDate);
  const setProvidedBy = useManualQuoteStore((state) => state.setProvidedBy);
  const addProductFromErp = useManualQuoteStore((state) => state.addProductFromErp);
  const assignErpProductToItem = useManualQuoteStore((state) => state.assignErpProductToItem);
  const assignLocalProductToItem = useManualQuoteStore((state) => state.assignLocalProductToItem);
  const removeItem = useManualQuoteStore((state) => state.removeItem);
  const setItemQty = useManualQuoteStore((state) => state.setItemQty);
  const setItemMargin = useManualQuoteStore((state) => state.setItemMargin);
  const setItemUnitPrice = useManualQuoteStore((state) => state.setItemUnitPrice);
  const setItemDeliveryTime = useManualQuoteStore((state) => state.setItemDeliveryTime);
  const setItemCustomerDescription = useManualQuoteStore((state) => state.setItemCustomerDescription);
  const setItemComment = useManualQuoteStore((state) => state.setItemComment);
  const setItemProcurementPrequote = useManualQuoteStore((state) => state.setItemProcurementPrequote);
  const setItemsProcurementPrequote = useManualQuoteStore((state) => state.setItemsProcurementPrequote);
  const setClient = useManualQuoteStore((state) => state.setClient);
  const hydrateDraftFromQuote = useManualQuoteStore((state) => state.hydrateDraftFromQuote);
  const clearDraft = useManualQuoteStore((state) => state.clearDraft);
  const subtotal = useManualQuoteStore((state) => state.subtotal);
  const tax = useManualQuoteStore((state) => state.tax);
  const total = useManualQuoteStore((state) => state.total);
  const validityCatalog = useQuoteCatalogs("VALIDITY_DAYS");
  const paymentCatalog = useQuoteCatalogs("PAYMENT_TERMS");
  const commercialCatalog = useQuoteCatalogs("COMMERCIAL_CONDITIONS");
  const deliveryCatalog = useQuoteCatalogs("DELIVERY_TIME");
  const hasActiveDraft = draft.items.length > 0 || draft.client !== null || draft.savedQuoteId !== null;
  useEffect(() => {
    if (quoteIdFromQuery) return;
    if (hasActiveDraft && draft.captureMethod !== entryMode) {
      const target = draft.captureMethod === "EXCEL_IMPORT" ? "/cotizador/importar-excel" : "/cotizador/sistema";
      notifier.info("Tienes una cotización en proceso. Termínala o cancélala antes de cambiar de modalidad.");
      navigate(target, { replace: true });
      return;
    }
    if (entryMode === "EXCEL_IMPORT" && !hasActiveDraft) setOpenQuotedExcelImport(true);
  }, [draft.captureMethod, entryMode, hasActiveDraft, navigate, quoteIdFromQuery]);
  const isProviderAttributionLocked = ["PENDIENTE_APROBACION", "COTIZADA", "APROBADA", "RECHAZADA", "CANCELADA", "REEMPLAZADA"].includes(draft.status);
  const attachmentItemLabels = useMemo(
    () => Object.fromEntries(draft.items.map((item, index) => [item.id, `#${index + 1} ${item.erpCode || "LOCAL"}`])),
    [draft.items],
  );

  const downloadAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.download(file);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const deleteAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.delete(file.id);
      await draftAttachments.refetch();
      notifier.success("Archivo eliminado.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo eliminar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  useEffect(() => {
    if (quoteIdFromQuery) {
      let cancelled = false;

      const run = async () => {
        const remoteQuote = await QuotesService.getById(quoteIdFromQuery);

        if (cancelled) return;

        if (!remoteQuote) {
          notifier.warning("No se encontró la cotización para editar.");
          navigate("/quotes");
          return;
        }

        hydrateDraftFromQuote({
          ...remoteQuote,
          items: remoteQuote.items.map((item) => ({
            ...item,
            ean: item.ean || "",
            customerDescription: item.customerDescription || "",
            customerDescriptionOriginal: item.customerDescriptionOriginal || item.customerDescription || "",
            customerUnit: item.customerUnit || "",
            itemComment: item.itemComment || "",
            sellerSupplierId: item.sellerSupplierId || null,
            sellerSupplierName: item.sellerSupplierName || "",
            sellerQuotedUnitCost: Number.isFinite(item.sellerQuotedUnitCost) ? item.sellerQuotedUnitCost ?? null : null,
            sellerQuotedCurrency: item.sellerQuotedCurrency || "MXN",
            sellerQuotedExchangeRate: Number.isFinite(item.sellerQuotedExchangeRate) ? item.sellerQuotedExchangeRate ?? null : null,
            sellerQuotedBrand: item.sellerQuotedBrand || "",
            sellerSupplierDescription: item.sellerSupplierDescription || "",
            sellerSupplierOrigin: item.sellerSupplierOrigin || "",
            sellerSupplierQuoteValidUntil: item.sellerSupplierQuoteValidUntil || "",
            sellerSupplierQuoteReference: item.sellerSupplierQuoteReference || "",
            sellerSupplierQuoteNotes: item.sellerSupplierQuoteNotes || "",
            sellerOriginRestrictions: item.sellerOriginRestrictions || [],
            sellerDeliveryState: item.sellerDeliveryState || "",
            sellerSupplierDeliveryTime: item.sellerSupplierDeliveryTime || "",
            purchaseStandard: item.purchaseStandard || "",
            purchaseDiameter: item.purchaseDiameter || "",
            purchaseThickness: item.purchaseThickness || "",
            purchaseBore: item.purchaseBore || "",
            technicalFamily: item.technicalFamily || "",
            technicalAttributes: item.technicalAttributes || {},
            costCurrency: item.costCurrency || "USD",
            sourceCurrency: item.sourceCurrency ?? undefined,
            sourceUnitPrice: item.sourceUnitPrice ?? undefined,
            sourceSubtotal: item.sourceSubtotal ?? undefined,
            sourceRequiresReview: Boolean(item.sourceRequiresReview),
          })),
        });
      };

      void run();
      return () => {
        cancelled = true;
      };
    }

    if (fromExtractionSource) {
      return;
    }

    // Preserve an in-progress quote when the seller leaves and returns to this view.
    if (hasActiveDraft) {
      return;
    }

    initializeDraft(user);
  }, [fromExtractionSource, hasActiveDraft, hydrateDraftFromQuote, initializeDraft, navigate, quoteIdFromQuery, user]);

  const quoteCurrency = draft.currency;
  const isExcelImportedQuote = draft.captureMethod === "EXCEL_IMPORT";
  const isExcelFlow = entryMode === "EXCEL_IMPORT" || isExcelImportedQuote;
  useEffect(() => {
    if (!isExcelImportedQuote) return;
    setExtractionModal(null);
    setOpenModal(false);
    setOpenQuotedExcelImport(false);
    setErpTargetItemId(null);
  }, [isExcelImportedQuote]);
  const paymentTermsOptions = useMemo(() => {
    const current = (draft.paymentTerms || "").trim();
    const options = paymentCatalog.data || [];
    if (!current || options.some((option) => option.value === current)) return options;
    return [{ id: "current-payment", label: current, value: current } as (typeof options)[number], ...options];
  }, [draft.paymentTerms, paymentCatalog.data]);
  const validityDaysOptions = useMemo(() => {
    const options = validityCatalog.data || [];
    if (options.some((option) => option.numericValue === draft.validityDays)) return options;
    return [{ id: "current-validity", label: `${draft.validityDays} días`, numericValue: draft.validityDays } as (typeof options)[number], ...options];
  }, [draft.validityDays, validityCatalog.data]);
  const commercialConditionsOptions = useMemo(() => {
    const current = (draft.commercialConditions || "").trim();
    const options = commercialCatalog.data || [];
    if (!current || options.some((option) => option.value === current)) return options;
    return [{ id: "current-commercial-conditions", label: "Condiciones guardadas", value: current } as (typeof options)[number], ...options];
  }, [commercialCatalog.data, draft.commercialConditions]);
  const deliveryTimeOptions = deliveryCatalog.data || [];

  const totalRequiresReview = useMemo(() => {
    return draft.items.filter((item) => item.requiresReview).length;
  }, [draft.items]);
  const totalUnlinked = useMemo(() => {
    return draft.items.filter((item) => !item.erpCode.trim() && !(item.localProductId || "").trim()).length;
  }, [draft.items]);
  const visibleItems = useMemo(() => {
    if (originFilter === "UNLINKED") {
      return draft.items.filter((item) => !item.erpCode.trim() && !(item.localProductId || "").trim());
    }

    return draft.items;
  }, [draft.items, originFilter]);
  const erpTargetItem = useMemo(() => {
    if (!erpTargetItemId) return null;
    return draft.items.find((item) => item.id === erpTargetItemId) ?? null;
  }, [draft.items, erpTargetItemId]);
  const localProductConfirmationItem = useMemo(() => {
    if (!localProductConfirmationItemId) return null;
    return draft.items.find((item) => item.id === localProductConfirmationItemId) ?? null;
  }, [draft.items, localProductConfirmationItemId]);
  const descriptionItem = useMemo(() => {
    if (!descriptionItemId) return null;
    return draft.items.find((item) => item.id === descriptionItemId) ?? null;
  }, [descriptionItemId, draft.items]);
  const procurementItem = useMemo(() => {
    if (!procurementItemId) return null;
    return draft.items.find((item) => item.id === procurementItemId) ?? null;
  }, [draft.items, procurementItemId]);
  const procurementItems = useMemo(
    () => draft.items.filter(requiresProcurementPrequote),
    [draft.items]
  );
  const showCustomerExtractionColumns = useMemo(() => {
    return draft.items.some((item) => item.customerDescription.trim().length > 0 || item.customerUnit.trim().length > 0);
  }, [draft.items]);
  const shouldShowCustomerColumns = showCustomerExtractionColumns && showCustomerOrderColumns;
  const tableColSpan = shouldShowCustomerColumns ? 16 : 14;

  const quoteOrigin = useMemo<"MANUAL" | "FILE_UPLOAD" | "TEXT_INPUT">(() => {
    if (sourceParam === "file") return "FILE_UPLOAD";
    if (sourceParam === "text") return "TEXT_INPUT";
    return "MANUAL";
  }, [sourceParam]);

  const commitQtyDraft = (itemId: string, rawValue: string, fallbackQty: number) => {
    const raw = (rawValue || `${fallbackQty}`).trim();
    const parsed = raw === "" ? 0 : Number(raw);

    if (Number.isFinite(parsed)) {
      const safeQty = Math.max(0, parsed);
      setItemQty(itemId, safeQty);
    }

    setQtyDrafts((state) => {
      const next = { ...state };
      delete next[itemId];
      return next;
    });
  };

  const commitPriceDraft = (itemId: string, rawValue: string, fallbackPrice: number) => {
    const raw = (rawValue || `${fallbackPrice}`).trim();
    const parsed = raw === "" ? 0 : Number(raw);

    if (Number.isFinite(parsed)) {
      const safePrice = Math.max(0, parsed);
      setItemUnitPrice(itemId, safePrice);
    }

    setPriceDrafts((state) => {
      const next = { ...state };
      delete next[itemId];
      return next;
    });
  };

  const commitMarginDraft = (itemId: string, rawValue: string, fallbackMargin: number) => {
    const raw = rawValue.trim();
    const parsed = raw === "" ? fallbackMargin : Number(raw);

    if (Number.isFinite(parsed)) {
      setItemMargin(itemId, parsed);
    }

    setMarginDrafts((state) => {
      const next = { ...state };
      delete next[itemId];
      return next;
    });
  };

  const openCommentModal = (itemId: string) => {
    const target = draft.items.find((item) => item.id === itemId);
    setCommentItemId(itemId);
    setCommentDraft(target?.itemComment || "");
  };

  const closeCommentModal = () => {
    setCommentItemId(null);
    setCommentDraft("");
  };

  const saveCommentModal = () => {
    if (!commentItemId) return;
    setItemComment(commentItemId, commentDraft.trim());
    closeCommentModal();
  };

  const openCustomerDescriptionModal = (itemId: string) => {
    if (draft.captureMethod !== "SYSTEM") return;
    const target = draft.items.find((item) => item.id === itemId);
    if (!target?.customerDescriptionOriginal?.trim()) return;
    setDescriptionItemId(itemId);
    setCustomerDescriptionDraft(target.customerDescription || target.customerDescriptionOriginal);
  };

  const closeCustomerDescriptionModal = () => {
    setDescriptionItemId(null);
    setCustomerDescriptionDraft("");
  };

  const saveCustomerDescriptionModal = () => {
    if (!descriptionItemId) return;
    const normalizedDescription = customerDescriptionDraft.trim().toUpperCase();
    if (!normalizedDescription) {
      notifier.warning("La descripción para el cliente no puede quedar vacía.");
      return;
    }
    setItemCustomerDescription(descriptionItemId, normalizedDescription);
    closeCustomerDescriptionModal();
  };

  const commitExchangeRateDraft = (rawValue: string, fallbackExchangeRate: number) => {
    const raw = rawValue.trim();
    const parsed = raw === "" ? fallbackExchangeRate : Number(raw);

    if (Number.isFinite(parsed) && parsed > 0) {
      setExchangeRate(parsed);
    }

    setExchangeRateDraft(null);
  };

  const handleCreateLocalProduct = async (itemId: string, descriptionOverride?: string) => {
    const currentItem = draft.items.find((item) => item.id === itemId);
    if (!currentItem) return;
    if (currentItem.erpCode.trim() || (currentItem.localProductId || "").trim()) return;

    try {
      setCreatingLocalItems((state) => ({ ...state, [itemId]: true }));

      const response = await LocalProductsService.createBatchFromItems(
        [
          {
            itemId: currentItem.id,
            description:
              descriptionOverride?.trim() ||
              currentItem.customerDescription.trim() ||
              currentItem.erpDescription.trim() ||
              `PRODUCTO TEMPORAL ${currentItem.id}`,
            unit: getLocalProductUnit(currentItem.customerUnit),
          },
        ]
      );

      const linked = response.find((row) => row.itemId === itemId);
      if (!linked) {
        throw new Error("No se pudo crear/vincular el producto local para esta partida.");
      }

      assignLocalProductToItem(itemId, linked.product);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el producto local.";
      notifier.error(message);
    } finally {
      setCreatingLocalItems((state) => {
        const next = { ...state };
        delete next[itemId];
        return next;
      });
    }
  };

  const validateBeforeSave = (options?: {
    enforcePriceFloor?: boolean;
    requireSourceChannel?: boolean;
    requireCompletedItems?: boolean;
    requireCommercialConditions?: boolean;
  }) => {
    if (!draft.client) {
      notifier.warning("Selecciona un cliente antes de guardar la cotización.");
      return false;
    }

    if (draft.items.length === 0) {
      notifier.warning("Agrega al menos una partida para guardar la cotización.");
      return false;
    }

    if (options?.requireSourceChannel && draft.sourceChannel === "UNSPECIFIED") {
      notifier.warning("Selecciona el origen de la cotización antes de generarla.");
      return false;
    }

    if (options?.requireCommercialConditions && !draft.commercialConditions.trim()) {
      notifier.warning("Selecciona las condiciones comerciales antes de generar la cotización.");
      return false;
    }

    if (draft.captureMethod === "EXCEL_IMPORT" && !draft.originalQuoteDate) {
      notifier.warning("Indica la fecha original de la cotización importada.");
      return false;
    }

    if (options?.requireCompletedItems) {
      const unlinkedItems = draft.items.filter((item) => !item.erpCode.trim() && !(item.localProductId || "").trim());
      if (draft.captureMethod !== "EXCEL_IMPORT" && unlinkedItems.length > 0) {
        notifier.error(
          `No puedes generar la cotización. Hay ${unlinkedItems.length} partida(s) pendiente(s) de vincular a ERP o producto local.`
        );
        return false;
      }

      const reviewItems = draft.items.filter((item) => item.requiresReview);
      if (reviewItems.length > 0) {
        notifier.error(
          `No puedes generar la cotización. Hay ${reviewItems.length} partida(s) pendiente(s) de revisión.`
        );
        return false;
      }

      const missingPriceItems = draft.items.filter((item) => !Number.isFinite(item.unitPrice) || item.unitPrice <= 0);
      if (missingPriceItems.length > 0) {
        notifier.error(
          `No puedes generar la cotización. Hay ${missingPriceItems.length} partida(s) sin precio vendedor.`
        );
        return false;
      }

      if (draft.captureMethod !== "EXCEL_IMPORT") {
        const missingProcurementData = draft.items.filter(
          (item) => requiresProcurementPrequote(item) && !hasCompleteProcurementPrequote(item)
        );
        if (missingProcurementData.length > 0) {
          notifier.error(
            `No puedes generar la cotización. Completa los datos de compra en ${missingProcurementData.length} partida(s) local(es) o sin stock.`
          );
          return false;
        }
      }
    }

    if (options?.enforcePriceFloor) {
      const belowCostItems = draft.items.filter((item) => {
        if (isErpWithoutEnoughStock(item)) return false;

        const baseCost = Number(
          getSellerPriceCostBase(item.costUsd, item.costCurrency, draft.currency, draft.exchangeRate).toFixed(2)
        );
        return item.unitPrice + 0.000001 < baseCost;
      });

      if (belowCostItems.length > 0) {
        notifier.error(
          `No puedes generar la cotización. Hay ${belowCostItems.length} partida(s) con precio vendedor menor al costo ERP.`
        );
        return false;
      }
    }

    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateBeforeSave()) return;

    try {
      setSavingAction("draft");
      setSaving(true);
      const quoteId = await QuotesService.createFromDraft(draft, { status: "BORRADOR", origin: quoteOrigin });
      clearDraft();
      notifier.success(`Cotización ${quoteId} guardada como BORRADOR.`);
      navigate("/quotes");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la cotización.";
      notifier.error(message);
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  const handleClearExcelDraft = async () => {
    if (clearingExcelDraft || draft.savedQuoteId) return;

    try {
      setClearingExcelDraft(true);
      const attachmentsResult = await draftAttachments.refetch();
      const attachments = attachmentsResult.data ?? draftAttachments.data ?? [];
      await Promise.all(attachments.map((attachment) => AttachmentsService.delete(attachment.id)));

      clearDraft();
      setExchangeRateDraft(null);
      setQtyDrafts({});
      setPriceDrafts({});
      setMarginDrafts({});
      setShowClearExcelConfirmation(false);
      setOpenQuotedExcelImport(true);
      navigate("/cotizador/importar-excel", { replace: true });
      notifier.success("Cotización limpiada. Ya puedes seleccionar otro archivo Excel.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo limpiar la cotización importada.");
    } finally {
      setClearingExcelDraft(false);
    }
  };

  const handleGenerateQuote = async () => {
    if (!validateBeforeSave({
      enforcePriceFloor: true,
      requireSourceChannel: true,
      requireCompletedItems: true,
      requireCommercialConditions: true,
    })) return;

    try {
      setSavingAction("quote");
      setSaving(true);
      const quoteId = await QuotesService.createFromDraft(draft, { status: "COTIZADA", origin: quoteOrigin });
      clearDraft();
      notifier.success(
        quoteInternalApprovalEnabled
          ? `Cotización ${quoteId} enviada a aprobación.`
          : `Cotización ${quoteId} generada correctamente.`
      );
      navigate("/quotes");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar la cotización.";
      notifier.error(message);
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  return (
    <section aria-busy={saving}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{draft.savedQuoteId ? "Editar cotización" : isExcelFlow ? "Importar cotización del vendedor" : "Cotización en sistema"}</h2>
          <p className="text-sm text-gray-500">
            {isExcelFlow
              ? "Registra una cotización elaborada externamente. Sus partidas permanecerán bloqueadas y no se vincularán al ERP."
              : "Completa partidas, ajusta margen y precio con tipo de cambio. Costos ERP base en USD."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {draft.savedQuoteId && (
            <button
              onClick={() => setShowCancelEditConfirmation(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Cancelar edición
            </button>
          )}

          {entryMode === "EXCEL_IMPORT" && (
            <button
              onClick={() => setOpenQuotedExcelImport(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {draft.items.length > 0 ? "Importar otro Excel" : "Seleccionar archivo Excel"}
            </button>
          )}

          {entryMode === "EXCEL_IMPORT" && !draft.savedQuoteId && hasActiveDraft && (
            <button
              type="button"
              onClick={() => setShowClearExcelConfirmation(true)}
              disabled={saving || clearingExcelDraft}
              className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {clearingExcelDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {clearingExcelDraft ? "Limpiando..." : "Limpiar cotización"}
            </button>
          )}

          {entryMode === "SYSTEM" && !isExcelImportedQuote && (
            <>
              <button
                onClick={() => setExtractionModal("file")}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileUp className="h-4 w-4" />
                Subir archivo
              </button>

              <button
                onClick={() => setExtractionModal("text")}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageSquareText className="h-4 w-4" />
                Pegar texto
              </button>
            </>
          )}

          <button
            onClick={() => setShowAttachmentsModal(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Paperclip className="h-4 w-4" />
            Archivos adjuntos ({draftAttachments.data?.length || 0})
          </button>

          <button
            onClick={() => {
              void handleSaveDraft();
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            {savingAction === "draft" ? "Guardando..." : "Guardar borrador"}
          </button>

          <button
            onClick={() => {
              void handleGenerateQuote();
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white hover:from-emerald-600 hover:to-teal-700"
          >
            <FileCheck2 className="h-4 w-4" />
            {savingAction === "quote" ? "Procesando..." : "Generar cotización"}
          </button>

          {entryMode === "SYSTEM" && !isExcelImportedQuote && (
            <button
              onClick={() => {
                setErpTargetItemId(null);
                setOpenModal(true);
              }}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Agregar productos
            </button>
          )}
        </div>
      </div>

      {isExcelFlow && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-800">Cotización Excel para seguimiento</p>
            <p className="mt-1 text-xs text-teal-700">Las partidas son de solo lectura y no se vinculan con ERP. Esta cotización no genera requisición de compra ni pedido ERP.</p>
          </div>
          <label className="text-xs font-semibold uppercase text-teal-800" htmlFor="originalQuoteDate">
            Fecha original *
            <input
              id="originalQuoteDate"
              type="date"
              value={draft.originalQuoteDate}
              onChange={(event) => setOriginalQuoteDate(event.target.value)}
              className="mt-1 block rounded-md border border-teal-300 bg-white px-2 py-1.5 text-sm font-normal text-gray-700"
            />
          </label>
        </div>
      )}

      <div className="mb-4 grid gap-3 rounded-md border shadow-sm border-gray-200 bg-white p-4 lg:grid-cols-6">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Vendedor</p>
          <p className="text-sm text-gray-700">{draft.createdByName || `${user?.name ?? ""} ${user?.lastname ?? ""}`.trim()}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Sucursal</p>
          <p className="text-sm text-gray-700">{draft.branchName || user?.branch?.name || "-"}</p>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-gray-500">
              Cliente
            </label>
            <button
              onClick={() => setOpenClientModal(true)}
              className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Buscar / Crear cliente
            </button>
          </div>

          <div className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700">
            {draft.client ? (
              <p>
                {draft.client.name} {draft.client.lastname} - {draft.client.companyName || "Sin empresa"}
              </p>
            ) : (
              <p className="text-gray-500">Sin cliente seleccionado.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-gray-500">Proporcionada por</label>
            {!isProviderAttributionLocked && (
              <button
                onClick={() => setOpenQuoteProviderModal(true)}
                className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Buscar usuario
              </button>
            )}
          </div>
          <div className="mt-1 flex min-h-10 items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700">
            {draft.providedBy ? (
              <span>{draft.providedBy.fullName} · {draft.providedBy.branchName}</span>
            ) : (
              <span className="text-gray-500">Cotización directa, sin usuario asignado.</span>
            )}
            {draft.providedBy && !isProviderAttributionLocked && (
              <button
                onClick={() => setProvidedBy(null)}
                className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Quitar
              </button>
            )}
          </div>
          {isProviderAttributionLocked && <p className="mt-1 text-xs text-gray-500">Atribución bloqueada al quedar cotizada.</p>}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="currency">
            Moneda cotización
          </label>
          <select
            id="currency"
            value={draft.currency}
            disabled={isExcelImportedQuote}
            onChange={(event) => setCurrency(event.target.value as "MXN" | "USD")}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
          {isExcelImportedQuote && (
            <p className="mt-1 text-xs text-gray-500">Definida al importar la cotización Excel.</p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="sourceChannel">
            Origen de la cotización
          </label>
          <select
            id="sourceChannel"
            value={draft.sourceChannel}
            onChange={(event) => setSourceChannel(event.target.value as QuoteSourceChannel)}
            className={`mt-1 w-full rounded-md border px-2 py-1.5 text-sm text-gray-700 ${
              draft.sourceChannel === "UNSPECIFIED"
                ? "border-amber-300 bg-amber-50"
                : "border-gray-300 bg-white"
            }`}
          >
            {SOURCE_CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="exchangeRate">
            Tipo de cambio ({draft.exchangeRateSource})
          </label>
          <input
            id="exchangeRate"
            type="number"
            step="0.0001"
            min="0"
            value={exchangeRateDraft ?? `${draft.exchangeRate}`}
            onChange={(event) => {
              const raw = event.target.value;
              setExchangeRateDraft(raw);

              if (raw.trim() === "") return;
              const parsed = Number(raw);
              if (Number.isFinite(parsed) && parsed > 0) {
                setExchangeRate(parsed);
              }
            }}
            onBlur={(event) => commitExchangeRateDraft(event.currentTarget.value, draft.exchangeRate)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">
            Fecha TC: {draft.exchangeRateDate}
            {isExcelImportedQuote ? " · Convierte las partidas cuya moneda sea diferente a la moneda final." : ""}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="validityDays">
            Vigencia
          </label>
          <select
            id="validityDays"
            value={draft.validityDays}
            onChange={(event) => setValidityDays(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            {validityDaysOptions.map((option) => (
              <option key={option.id} value={option.numericValue || 0}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="paymentTerms">
            Condiciones de pago
          </label>
          <select
            id="paymentTerms"
            value={draft.paymentTerms}
            onChange={(event) => setPaymentTerms(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            {paymentTermsOptions.map((option) => (
              <option key={option.id} value={option.value || option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="commercialConditions">
              Condiciones comerciales *
            </label>
            {(draft.commercialConditions || "").trim() && (
              <button
                type="button"
                onClick={() => setShowCommercialConditionsModal(true)}
                className="text-xs font-semibold text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
              >
                Ver condiciones generales
              </button>
            )}
          </div>
          <select id="commercialConditions" value={draft.commercialConditions} onChange={(event) => setCommercialConditions(event.target.value)} required className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700">
            <option value="">Selecciona condiciones...</option>
            {commercialConditionsOptions.map((option) => <option key={option.id} value={option.value || ""}>{option.label}</option>)}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="deliveryPlace">
            Lugar de entrega
          </label>
          <input
            id="deliveryPlace"
            type="text"
            value={draft.deliveryPlace}
            onChange={(event) => setDeliveryPlace(event.target.value)}
            placeholder="Ej. L.A.B. OBRA / CEDIS MONTERREY"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          />
        </div>
      </div>

      {draft.client && (
        <div className="mb-4 rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p className="text-xs font-semibold uppercase text-gray-500">Datos del cliente</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="font-semibold">Nombre:</span> {draft.client.name} {draft.client.lastname}
            </p>
            <p>
              <span className="font-semibold">Empresa:</span> {draft.client.companyName}
            </p>
            <p>
              <span className="font-semibold">WhatsApp:</span> {draft.client.whatsappPhone}
            </p>
            <p>
              <span className="font-semibold">Correo:</span> {draft.client.email}
            </p>
            <p>
              <span className="font-semibold">RFC:</span> {draft.client.rfc}
            </p>
            <p>
              <span className="font-semibold">Teléfono:</span> {draft.client.phone || "-"}
            </p>
          </div>
        </div>
      )}

      {isExcelFlow ? (
        <ExcelImportedQuoteItemsTable
          items={draft.items}
          quoteCurrency={quoteCurrency}
        />
      ) : (
        <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setOriginFilter("ALL")}
            className={`rounded-full px-3 py-1 font-semibold ${originFilter === "ALL"
              ? "bg-gray-800 text-white"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              }`}
          >
            Todas ({draft.items.length})
          </button>
          <button
            onClick={() => setOriginFilter("UNLINKED")}
            className={`rounded-full px-3 py-1 font-semibold ${originFilter === "UNLINKED"
              ? "bg-amber-600 text-white"
              : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
          >
            Sin vincular ({totalUnlinked})
          </button>
	        </div>
	        <div className="flex items-center gap-2">
	          {procurementItems.length > 0 && (
	            <button
	              type="button"
	              onClick={() => setShowBulkProcurement(true)}
	              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
	            >
	              <ShoppingCart className="h-3.5 w-3.5" />
	              Completar compra en lote ({procurementItems.length})
	            </button>
	          )}
	          {showCustomerExtractionColumns && (
            <button
              type="button"
              onClick={() => setShowCustomerOrderColumns((prev) => !prev)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {showCustomerOrderColumns ? "Ocultar pedido cliente" : "Mostrar pedido cliente"}
            </button>
          )}
          <p className="text-xs text-gray-500">
            {originFilter === "UNLINKED"
              ? "Mostrando partidas pendientes de vincular a ERP o LOCAL_TEMP."
              : "Mostrando todas las partidas."}
          </p>
        </div>
      </div>

      <div className="overflow-auto max-h-100 rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código ERP</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Origen</th>
              {shouldShowCustomerColumns && (
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción cliente</th>
              )}
              {shouldShowCustomerColumns && (
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM cliente</th>
              )}
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                Descripción ERP
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stock</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Tiempo entrega</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Cantidad</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Costo ERP</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Margen %</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Precio vendedor {quoteCurrency}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Subtotal {quoteCurrency}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Revisión</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {draft.items.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={tableColSpan}>
                  No hay partidas. Usa "Agregar productos" para comenzar la cotización manual.
                </td>
              </tr>
            )}
            {draft.items.length > 0 && visibleItems.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={tableColSpan}>
                  No hay partidas sin vincular. Puedes volver a "Todas".
                </td>
              </tr>
            )}

            {visibleItems.map((item) => {
              const marginVisual = getMarginVisual(item.marginPct);

              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{item.erpCode || "-"}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">{item.ean || "-"}</td>
                  <td className="px-4 py-2">
                    {item.erpCode ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold text-sky-700">ERP</span>
                    ) : item.localProductId ? (
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700">LOCAL_TEMP</span>
                    ) : item.importedFromExcel ? (
                      <span className="rounded-full bg-teal-100 px-2 py-1 text-[9px] font-semibold text-teal-700">EXCEL · SIN VINCULAR</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-semibold text-amber-700">EXTRACCIÓN · VINCULAR</span>
                    )}
                  </td>
                  {shouldShowCustomerColumns && (
                    <td className="px-4 py-2 text-xs text-gray-700">{item.customerDescription || "-"}</td>
                  )}
                  {shouldShowCustomerColumns && <td className="px-4 py-2 text-xs text-gray-700">{item.customerUnit || "-"}</td>}
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {item.erpDescription || (item.importedFromExcel ? item.customerDescription : "-")}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">{item.unit || "-"}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{item.stock}</td>
                  <td className="px-4 py-2">
                    {item.importedFromExcel ? (
                      <input
                        value={item.deliveryTime}
                        onChange={(event) => setItemDeliveryTime(item.id, event.target.value)}
                        placeholder="Ej. 3-5 días"
                        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                      />
                    ) : item.stock > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        Inmediato
                      </span>
                    ) : (
                      <select
                        value={item.deliveryTime}
                        onChange={(event) => setItemDeliveryTime(item.id, event.target.value)}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                      >
                        {!deliveryTimeOptions.some((option) => (option.value || option.label) === item.deliveryTime) && <option value={item.deliveryTime}>{item.deliveryTime}</option>}
                        {deliveryTimeOptions.map((option) => <option key={option.id} value={option.value || option.label}>{option.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={qtyDrafts[item.id] ?? `${item.qty}`}
                      onChange={(event) =>
                        setQtyDrafts((state) => ({
                          ...state,
                          [item.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) => commitQtyDraft(item.id, event.currentTarget.value, item.qty)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {formatCurrency(
                      getDisplayCost(item.costUsd, item.costCurrency, draft.currency, draft.exchangeRate),
                      getDisplayCostCurrency(item.costCurrency, draft.currency)
                    )}
                  </td>
                  <td className="px-4 py-2">


                    <input
                      type="number"
                      min="-100"
                      step="0.01"
                      value={marginDrafts[item.id] ?? `${item.marginPct}`}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setMarginDrafts((state) => ({
                          ...state,
                          [item.id]: raw,
                        }));

                        if (raw.trim() === "") return;
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed)) {
                          setItemMargin(item.id, parsed);
                        }
                      }}
                      onBlur={(event) => commitMarginDraft(item.id, event.currentTarget.value, item.marginPct)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className={`w-24 rounded-md border px-2 py-1 text-xs font-semibold ${marginVisual.inputClass}`}
                    />
                    <span className={` inline-block  text-[9px] font-semibold ${marginVisual.badgeClass}`}>
                      {marginVisual.label}
                    </span>


                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceDrafts[item.id] ?? `${item.unitPrice}`}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setPriceDrafts((state) => ({
                          ...state,
                          [item.id]: raw,
                        }));

                        if (raw.trim() === "") return;
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed)) {
                          setItemUnitPrice(item.id, parsed);
                        }
                      }}
                      onBlur={(event) => commitPriceDraft(item.id, event.currentTarget.value, item.unitPrice)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs font-semibold text-emerald-700">{formatCurrency(item.subtotal, quoteCurrency)}</td>
                  <td className="px-4 py-2">
                    {item.requiresReview ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Revisar</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {requiresProcurementPrequote(item) && (
                        <button
                          type="button"
                          onClick={() => setProcurementItemId(item.id)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${hasCompleteProcurementPrequote(item) ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
                          title="Capturar proveedor, costo y datos para la requisición"
                        >
                          <span className="inline-flex items-center gap-1">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {hasCompleteProcurementPrequote(item) ? "Datos compra" : "Completar compra"}
                          </span>
                        </button>
                      )}
                      {draft.captureMethod === "SYSTEM" && Boolean(item.customerDescriptionOriginal?.trim()) && (
                        <button
                          type="button"
                          onClick={() => openCustomerDescriptionModal(item.id)}
                          className="rounded-md border border-cyan-300 px-2 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50"
                          title="Editar la descripción que verá el cliente"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Pencil className="h-3.5 w-3.5" />
                            Descripción cliente
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => openCommentModal(item.id)}
                        className="rounded-md border border-indigo-300 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                        title={item.itemComment?.trim() ? "Editar comentario" : "Agregar comentario"}
                      >
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {item.itemComment?.trim() ? "Comentario" : "Comentar"}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setErpTargetItemId(item.id);
                          setOpenModal(true);
                        }}
                        className="rounded-md border border-blue-300 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        {item.erpCode ? "Cambiar ERP" : "Buscar ERP"}
                      </button>
                      {!item.erpCode.trim() && !(item.localProductId || "").trim() && (
                        <button
                          onClick={() => setLocalProductConfirmationItemId(item.id)}
                          disabled={Boolean(creatingLocalItems[item.id])}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {creatingLocalItems[item.id] ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Creando...
                            </span>
                          ) : (
                            "Agregar local"
                          )}
                        </button>
                      )}
                      {!item.erpCode.trim() && (item.localProductId || "").trim() && (
                        <span className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                          Local agregado
                        </span>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="rounded-md border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Eliminar partida"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs text-gray-500">Partidas con revisión requerida: {totalRequiresReview}</p>

          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal(), quoteCurrency)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-sm text-gray-700">
            <span>IVA ({(draft.taxRate * 100).toFixed(0)}%)</span>
            <span>{formatCurrency(tax(), quoteCurrency)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(total(), quoteCurrency)}</span>
          </div>
        </div>
      </div>

      {showAttachmentsModal && (
        <AttachmentsModal
          title="Archivos de la cotización en edición"
          files={draftAttachments.data || []}
          loading={draftAttachments.isLoading}
          itemLabels={attachmentItemLabels}
          canDelete
          busyFileId={busyAttachmentId}
          onClose={() => setShowAttachmentsModal(false)}
          onDownload={(file) => { void downloadAttachment(file); }}
          onDelete={(file) => { void deleteAttachment(file); }}
        />
      )}

      {commentItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeCommentModal} />
          <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">Comentario por partida</h3>
              <button
                onClick={closeCommentModal}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Cerrar modal de comentario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={5}
                maxLength={500}
                placeholder="Escribe un comentario para esta partida..."
                className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-right text-[11px] text-gray-500">{commentDraft.length}/500</p>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={closeCommentModal}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveCommentModal}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Guardar comentario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {descriptionItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="customer-description-title">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Partida del cliente</p>
                <h3 id="customer-description-title" className="mt-0.5 text-base font-semibold text-gray-800">
                  Editar descripción para el cliente
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCustomerDescriptionModal}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Cerrar edición de descripción"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Descripción original extraída</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-gray-700">
                  {descriptionItem.customerDescriptionOriginal}
                </p>
              </div>

              <div>
                <label htmlFor="customer-description" className="text-xs font-semibold text-gray-700">
                  Descripción que verá el cliente
                </label>
                <textarea
                  id="customer-description"
                  value={customerDescriptionDraft}
                  onChange={(event) => setCustomerDescriptionDraft(event.target.value.toUpperCase())}
                  rows={5}
                  maxLength={500}
                  autoFocus
                  className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                />
                <div className="mt-1 flex items-start justify-between gap-4">
                  <p className="text-[11px] leading-4 text-gray-500">
                    Mientras la partida no esté vinculada, este texto se usará en la búsqueda semántica y como propuesta para el producto local.
                  </p>
                  <span className="shrink-0 text-[11px] text-gray-500">{customerDescriptionDraft.length}/500</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setCustomerDescriptionDraft(descriptionItem.customerDescriptionOriginal.toUpperCase())}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar original
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeCustomerDescriptionModal}
                  className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveCustomerDescriptionModal}
                  disabled={!customerDescriptionDraft.trim()}
                  className="rounded-md bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar descripción
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {procurementItem && (
        <SellerProcurementPrequoteModal
          key={procurementItem.id}
          item={procurementItem}
          clientDraftId={draft.id}
          quoteExchangeRate={draft.exchangeRate}
          onClose={() => setProcurementItemId(null)}
          onSave={(data) => {
            if (!procurementItemId) return;
            setItemProcurementPrequote(procurementItemId, data);
            if (data.sellerQuotedUnitCost !== null) {
              const sellerPrice = convertQuoteAmount(
                data.sellerQuotedUnitCost,
                data.sellerQuotedCurrency,
                draft.currency,
                data.sellerQuotedExchangeRate || draft.exchangeRate
              );
              setItemUnitPrice(procurementItemId, sellerPrice);
            }
            setProcurementItemId(null);
            void draftAttachments.refetch();
            notifier.success("Datos de compra guardados y precio vendedor actualizado.");
          }}
        />
      )}

      {showBulkProcurement && procurementItems.length > 0 && (
        <SellerProcurementBulkPrequoteModal
          items={procurementItems}
          clientDraftId={draft.id}
          quoteExchangeRate={draft.exchangeRate}
          onClose={() => setShowBulkProcurement(false)}
          onSave={(updates) => {
            setItemsProcurementPrequote(updates);
            setShowBulkProcurement(false);
            void draftAttachments.refetch();
            notifier.success(`Datos de compra aplicados a ${updates.length} partida(s).`);
          }}
        />
      )}

      {showCommercialConditionsModal && (draft.commercialConditions || "").trim() && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="commercial-conditions-title">
          <div className="absolute inset-0 bg-slate-950/45" onClick={() => setShowCommercialConditionsModal(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Cotización</p>
                <h3 id="commercial-conditions-title" className="mt-0.5 text-base font-semibold text-gray-800">
                  Condiciones generales
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCommercialConditionsModal(false)}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar condiciones generales"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {draft.commercialConditions}
              </p>
            </div>
            <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowCommercialConditionsModal(false)}
                className="rounded-md bg-gray-800 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <AddErpProductsModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setErpTargetItemId(null);
        }}
        title={erpTargetItemId ? "Vincular partida con producto ERP" : "Agregar productos desde ERP"}
        subtitle={
          erpTargetItemId
            ? "Busca por ERP directo o IA semántica y selecciona el producto correcto para esta partida."
            : "Busca por ERP directo (EAN/código) o IA semántica (descripción) y agrega partidas."
        }
        actionLabel={erpTargetItemId ? "Seleccionar" : "Agregar"}
        customerDescription={erpTargetItem?.customerDescription}
        customerUnit={erpTargetItem?.customerUnit}
        aiSearchOnEnter={!erpTargetItemId}
        onSelect={(product) => {
          if (erpTargetItemId) {
            assignErpProductToItem(erpTargetItemId, product);
          } else {
            addProductFromErp(product);
          }
          setOpenModal(false);
          setErpTargetItemId(null);
        }}
      />
      <SelectClientModal
        open={openClientModal}
        onClose={() => setOpenClientModal(false)}
        onSelect={(client) => {
          setClient(client);
          setOpenClientModal(false);
        }}
      />
      {extractionModal && entryMode === "SYSTEM" && !isExcelImportedQuote && (
        <QuoteExtractionModal
          mode={extractionModal}
          open
          onClose={() => setExtractionModal(null)}
          onCompleted={(source) => {
            setExtractionModal(null);
            void draftAttachments.refetch();
            navigate(`/cotizador/sistema?source=${source}`, { replace: true });
          }}
        />
      )}
      <QuotedExcelImportModal
        open={openQuotedExcelImport}
        onClose={() => setOpenQuotedExcelImport(false)}
        onCompleted={(itemsCount) => {
          setOpenQuotedExcelImport(false);
          void draftAttachments.refetch();
          notifier.success(`${itemsCount} partida(s) importada(s) desde Excel.`);
        }}
      />
      <SelectQuoteProviderModal
        open={openQuoteProviderModal}
        onClose={() => setOpenQuoteProviderModal(false)}
        onSelect={(selectedUser) => {
          setProvidedBy({
            id: selectedUser.id,
            fullName: selectedUser.fullName,
            branchName: selectedUser.branch.name,
            branchCode: selectedUser.branch.code,
          });
          setOpenQuoteProviderModal(false);
        }}
      />
      {localProductConfirmationItem && (
        <LocalProductDedupModal
          open
          description={(
            localProductConfirmationItem.customerDescription.trim() ||
            localProductConfirmationItem.erpDescription.trim() ||
            `PRODUCTO TEMPORAL ${localProductConfirmationItem.id}`
          ).toUpperCase()}
          originalDescription={
            localProductConfirmationItem.customerDescriptionOriginal || localProductConfirmationItem.customerDescription
          }
          unit={getLocalProductUnit(localProductConfirmationItem.customerUnit)}
          onClose={() => setLocalProductConfirmationItemId(null)}
          onReuse={(candidate) => {
            assignLocalProductToItem(localProductConfirmationItem.id, candidate.product);
            setLocalProductConfirmationItemId(null);
            notifier.success("Producto local existente vinculado a la partida.");
          }}
          onCreateNew={(localDescription) => {
            const itemId = localProductConfirmationItem.id;
            setLocalProductConfirmationItemId(null);
            void handleCreateLocalProduct(itemId, localDescription);
          }}
        />
      )}
      {showCancelEditConfirmation && draft.savedQuoteId && (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-800">Cancelar edición</h3>
            <p className="mt-2 text-sm text-gray-600">
              Se descartarán todos los cambios que no hayas guardado en esta cotización.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelEditConfirmation(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Continuar editando
              </button>
              <button
                onClick={() => {
                  const quoteId = draft.savedQuoteId;
                  setShowCancelEditConfirmation(false);
                  clearDraft();
                  navigate(`/quotes/${quoteId}`);
                }}
                className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}
      {showClearExcelConfirmation && entryMode === "EXCEL_IMPORT" && !draft.savedQuoteId && (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-excel-title">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 id="clear-excel-title" className="text-base font-semibold text-gray-800">Limpiar cotización importada</h3>
            <p className="mt-2 text-sm text-gray-600">
              Se eliminarán las partidas, los datos capturados y los archivos adjuntos de este borrador. Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearExcelConfirmation(false)}
                disabled={clearingExcelDraft}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Conservar cotización
              </button>
              <button
                type="button"
                onClick={() => void handleClearExcelDraft()}
                disabled={clearingExcelDraft}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearingExcelDraft && <Loader2 className="h-4 w-4 animate-spin" />}
                {clearingExcelDraft ? "Limpiando..." : "Sí, limpiar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {saving && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 shadow-2xl">
          <div className="rounded-xl bg-white px-6 py-5 shadow-2xl ring-1 ring-black/10">
            <div className="inline-flex items-center gap-3 text-sm font-semibold text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <span>
                {savingAction === "draft"
                  ? "Guardando borrador..."
                  : savingAction === "quote"
                    ? "Generando cotización..."
                    : "Procesando cotización..."}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">Espera un momento, por favor.</p>
          </div>
        </div>
      )}
    </section>
  );
};
