import { FileCheck2, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LocalProductsService } from "../../modules/products/services/local-products.service";
import { useNavigate, useSearchParams } from "react-router";
import { QuotesService } from "../../modules/quotes/services/quotes.service";
import { AddErpProductsModal } from "../../shared/components/modals/add-erp-products.modal";
import { SelectClientModal } from "../../shared/components/modals/select-client.modal";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";

type OriginFilter = "ALL" | "UNLINKED";

const PAYMENT_TERMS_OPTIONS: string[] = [
  "CONTADO",
  "30% DE ANTICIPO RESTO CONTRA ENTREGA",
  "40% DE ANTICIPO RESTO CONTRA ENTREGA",
  "50% DE ANTICIPO RESTO CONTRA ENTREGA",
  "60% DE ANTICIPO RESTO CONTRA ENTREGA",
  "70% DE ANTICIPO RESTO CONTRA ENTREGA",
  "80% DE ANTICIPO RESTO CONTRA ENTREGA",
  "90% DE ANTICIPO RESTO CONTRA ENTREGA",
  "CREDITO 7 DIAS",
  "CREDITO 10 DIAS",
  "CREDITO 15 DIAS",
  "CREDITO 20 DIAS",
  "CREDITO 30 DIAS",
  "CREDITO 45 DIAS",
  "CREDITO 60 DIAS",
  "CREDITO 90 DIAS",
];

const VALIDITY_DAYS_OPTIONS: number[] = [10, 15, 20, 30, 45, 60, 90];

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
  const safeRate = exchangeRate > 0 ? exchangeRate : 1;
  if (productCurrency === "USD") return cost / safeRate;
  if (quoteCurrency === "USD") return cost / safeRate;
  return cost;
};

const getDisplayCostCurrency = (
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD"
): "MXN" | "USD" => {
  if (productCurrency === "USD" || quoteCurrency === "USD") return "USD";
  return "MXN";
};

const getSellerPriceCostBase = (
  cost: number,
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD",
  exchangeRate: number
): number => {
  const safeRate = exchangeRate > 0 ? exchangeRate : 1;

  if (productCurrency === "USD") {
    const normalizedUsdCost = cost / safeRate;
    return quoteCurrency === "USD" ? normalizedUsdCost : normalizedUsdCost * safeRate;
  }

  return quoteCurrency === "USD" ? cost / safeRate : cost;
};

const getMarginVisual = (marginPct: number) => {
  if (marginPct < 0) {
    return {
      inputClass: "border-rose-400 bg-rose-50 text-rose-700",
      badgeClass: "bg-rose-100 text-rose-700",
      label: "Margen negativo",
    };
  }

  if (marginPct < 10) {
    return {
      inputClass: "border-amber-400 bg-amber-50 text-amber-700",
      badgeClass: "bg-amber-100 text-amber-700",
      label: "Margen bajo (<10%)",
    };
  }

  return {
    inputClass: "border-emerald-400 bg-emerald-50 text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-700",
    label: "Margen saludable",
  };
};

export const ManualQuotePage = () => {
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
  const [showCustomerOrderColumns, setShowCustomerOrderColumns] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteIdFromQuery = searchParams.get("quoteId");
  const sourceParam = searchParams.get("source");
  const fromExtractionSource = sourceParam === "file" || sourceParam === "text";

  const user = useAuthStore((state) => state.user);

  const draft = useManualQuoteStore((state) => state.draft);
  const initializeDraft = useManualQuoteStore((state) => state.initializeDraft);
  const setCurrency = useManualQuoteStore((state) => state.setCurrency);
  const setExchangeRate = useManualQuoteStore((state) => state.setExchangeRate);
  const setDeliveryPlace = useManualQuoteStore((state) => state.setDeliveryPlace);
  const setPaymentTerms = useManualQuoteStore((state) => state.setPaymentTerms);
  const setValidityDays = useManualQuoteStore((state) => state.setValidityDays);
  const addProductFromErp = useManualQuoteStore((state) => state.addProductFromErp);
  const assignErpProductToItem = useManualQuoteStore((state) => state.assignErpProductToItem);
  const assignLocalProductToItem = useManualQuoteStore((state) => state.assignLocalProductToItem);
  const removeItem = useManualQuoteStore((state) => state.removeItem);
  const setItemQty = useManualQuoteStore((state) => state.setItemQty);
  const setItemMargin = useManualQuoteStore((state) => state.setItemMargin);
  const setItemUnitPrice = useManualQuoteStore((state) => state.setItemUnitPrice);
  const setItemDeliveryTime = useManualQuoteStore((state) => state.setItemDeliveryTime);
  const setClient = useManualQuoteStore((state) => state.setClient);
  const hydrateDraftFromQuote = useManualQuoteStore((state) => state.hydrateDraftFromQuote);
  const clearDraft = useManualQuoteStore((state) => state.clearDraft);
  const subtotal = useManualQuoteStore((state) => state.subtotal);
  const tax = useManualQuoteStore((state) => state.tax);
  const total = useManualQuoteStore((state) => state.total);

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
            customerUnit: item.customerUnit || "",
            costCurrency: item.costCurrency || "USD",
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

    clearDraft();
    initializeDraft(user);
  }, [clearDraft, fromExtractionSource, hydrateDraftFromQuote, initializeDraft, navigate, quoteIdFromQuery, user]);

  const quoteCurrency = draft.currency;
  const paymentTermsOptions = useMemo(() => {
    const current = (draft.paymentTerms || "").trim();
    if (!current) return PAYMENT_TERMS_OPTIONS;
    if (PAYMENT_TERMS_OPTIONS.includes(current)) return PAYMENT_TERMS_OPTIONS;
    return [current, ...PAYMENT_TERMS_OPTIONS];
  }, [draft.paymentTerms]);
  const validityDaysOptions = useMemo(() => {
    if (VALIDITY_DAYS_OPTIONS.includes(draft.validityDays)) return VALIDITY_DAYS_OPTIONS;
    return [draft.validityDays, ...VALIDITY_DAYS_OPTIONS].sort((a, b) => a - b);
  }, [draft.validityDays]);

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

  const commitExchangeRateDraft = (rawValue: string, fallbackExchangeRate: number) => {
    const raw = rawValue.trim();
    const parsed = raw === "" ? fallbackExchangeRate : Number(raw);

    if (Number.isFinite(parsed) && parsed > 0) {
      setExchangeRate(parsed);
    }

    setExchangeRateDraft(null);
  };

  const handleCreateLocalProduct = async (itemId: string) => {
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
              currentItem.customerDescription.trim() ||
              currentItem.erpDescription.trim() ||
              `PRODUCTO TEMPORAL ${currentItem.id}`,
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

  const validateBeforeSave = (options?: { enforcePriceFloor?: boolean }) => {
    if (!draft.client) {
      notifier.warning("Selecciona un cliente antes de guardar la cotización.");
      return false;
    }

    if (draft.items.length === 0) {
      notifier.warning("Agrega al menos una partida para guardar la cotización.");
      return false;
    }

    if (options?.enforcePriceFloor) {
      const belowCostItems = draft.items.filter((item) => {
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
    }
  };

  const handleGenerateQuote = async () => {
    if (!validateBeforeSave({ enforcePriceFloor: true })) return;

    try {
      setSaving(true);
      const quoteId = await QuotesService.createFromDraft(draft, { status: "COTIZADA", origin: quoteOrigin });
      clearDraft();
      notifier.success(`Cotización ${quoteId} generada como COTIZADA.`);
      navigate("/quotes");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar la cotización.";
      notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{draft.savedQuoteId ? "Editar cotización" : "Cotización manual"}</h2>
          <p className="text-sm text-gray-500">
            Completa partidas, ajusta margen y precio con tipo de cambio. Costos ERP base en USD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void handleSaveDraft();
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>

          <button
            onClick={() => {
              void handleGenerateQuote();
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-700"
          >
            <FileCheck2 className="h-4 w-4" />
            {saving ? "Procesando..." : "Generar cotización"}
          </button>

          <button
            onClick={() => {
              setErpTargetItemId(null);
              setOpenModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Agregar productos
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-white p-4 lg:grid-cols-5">
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

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="currency">
            Moneda cotización
          </label>
          <select
            id="currency"
            value={draft.currency}
            onChange={(event) => setCurrency(event.target.value as "MXN" | "USD")}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
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
          <p className="mt-1 text-xs text-gray-500">Fecha TC: {draft.exchangeRateDate}</p>
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
            {validityDaysOptions.map((days) => (
              <option key={days} value={days}>
                {days} dias
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
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setOriginFilter("ALL")}
            className={`rounded-full px-3 py-1 font-semibold ${
              originFilter === "ALL"
                ? "bg-gray-800 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Todas ({draft.items.length})
          </button>
          <button
            onClick={() => setOriginFilter("UNLINKED")}
            className={`rounded-full px-3 py-1 font-semibold ${
              originFilter === "UNLINKED"
                ? "bg-amber-600 text-white"
                : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Sin vincular ({totalUnlinked})
          </button>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
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
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción ERP</th>
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
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">SIN VINCULAR</span>
                    )}
                  </td>
                  {shouldShowCustomerColumns && (
                    <td className="px-4 py-2 text-xs text-gray-700">{item.customerDescription || "-"}</td>
                  )}
                  {shouldShowCustomerColumns && <td className="px-4 py-2 text-xs text-gray-700">{item.customerUnit || "-"}</td>}
                  <td className="px-4 py-2 text-xs text-gray-700">{item.erpDescription || "-"}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">{item.unit || "-"}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{item.stock}</td>
                  <td className="px-4 py-2">
                    {item.stock > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        Inmediato
                      </span>
                    ) : (
                      <select
                        value={item.deliveryTime}
                        onChange={(event) => setItemDeliveryTime(item.id, event.target.value)}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                      >
                        <option value="1-2 dias">1-2 dias</option>
                        <option value="3-5 dias">3-5 dias</option>
                        <option value="1-2 semanas">1-2 semanas</option>
                        <option value="2-4 semanas">2-4 semanas</option>
                        <option value="4-6 semanas">4-6 semanas</option>
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
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${marginVisual.badgeClass}`}>
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
                          onClick={() => {
                            void handleCreateLocalProduct(item.id);
                          }}
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
    </section>
  );
};
