import { CheckSquare2, Loader2, PackageSearch, Paperclip, PencilLine, Sparkles, Store, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuoteCatalogs } from "../../../queries/quote-catalogs/use-quote-catalogs";
import { useSuppliers } from "../../../queries/procurement/use-purchase-requisitions";
import { useDraftAttachments } from "../../../queries/attachments/use-attachments";
import type {
  ManualQuoteItem,
  ProcurementPrequoteUpdate,
  QuoteCurrency,
} from "../../../store/quote/manual-quote.store";
import { AttachmentsService, type FileAttachment } from "../../../modules/attachments/services/attachments.service";
import { AttachmentsPanel } from "../attachments/attachments-panel";
import { PdfAttachmentViewerModal } from "../attachments/pdf-attachment-viewer.modal";
import { notifier } from "../../notifications/notifier";
import { SelectOrCreateSupplierModal } from "./select-or-create-supplier.modal";
import {
  SupplierQuoteExtractionService,
  type ExtractedSupplierData,
  type SupplierQuoteExtractionResult,
} from "../../../modules/procurement/services/supplier-quote-extraction.service";
import type { SaveSupplierInput } from "../../../modules/procurement/services/purchase-requisitions.service";
import {
  SupplierQuoteBulkExtractionReviewModal,
  type SupplierQuoteBulkMapping,
} from "./supplier-quote-bulk-extraction-review.modal";
import { TechnicalDataService } from "../../../modules/procurement/services/technical-data.service";
import { technicalDataStatus } from "../procurement/technical-data-editor";
import {
  BulkProcurementItemEditorModal,
  type BulkProcurementItemForm,
} from "./bulk-procurement-item-editor.modal";
import { DetectedSupplierModal, findDetectedSupplierMatch } from "./detected-supplier.modal";

interface SellerProcurementBulkPrequoteModalProps {
  items: ManualQuoteItem[];
  clientDraftId: string;
  quoteExchangeRate: number;
  onClose: () => void;
  onSave: (updates: ProcurementPrequoteUpdate[]) => void;
}

const MANUAL_SUPPLIER = "__MANUAL__";
const optionValue = (option: { value: string | null; label: string }) => option.value || option.label;
const canonical = (value: string | null | undefined): string => (value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]/gi, "")
  .toUpperCase();

const hasCompleteData = (item: ManualQuoteItem): boolean => Boolean(
  item.sellerSupplierName.trim()
  && item.sellerQuotedUnitCost !== null
  && item.sellerQuotedUnitCost > 0
  && item.sellerDeliveryState.trim()
  && item.sellerSupplierDeliveryTime.trim()
);

const commonValue = (values: string[]): string => {
  if (values.length === 0) return "";
  return values.every((value) => value === values[0]) ? values[0] : "";
};

export const SellerProcurementBulkPrequoteModal = ({
  items,
  clientDraftId,
  quoteExchangeRate,
  onClose,
  onSave,
}: SellerProcurementBulkPrequoteModalProps) => {
  const suppliers = useSuppliers(true);
  const brands = useQuoteCatalogs("PURCHASE_BRAND");
  const restrictions = useQuoteCatalogs("ORIGIN_RESTRICTION");
  const deliveryStates = useQuoteCatalogs("DELIVERY_STATE");
  const deliveryTimes = useQuoteCatalogs("DELIVERY_TIME");
  const attachments = useDraftAttachments(clientDraftId);
  const initiallySelectedItems = useMemo(() => {
    const incomplete = items.filter((item) => !hasCompleteData(item));
    return incomplete.length > 0 ? incomplete : items;
  }, [items]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initiallySelectedItems.map((item) => item.id))
  );
  const initialSupplierIds = initiallySelectedItems.map((item) => item.sellerSupplierId || "");
  const commonSupplierId = commonValue(initialSupplierIds);
  const [supplierSelection, setSupplierSelection] = useState(commonSupplierId || MANUAL_SUPPLIER);
  const [supplierName, setSupplierName] = useState(
    commonValue(initiallySelectedItems.map((item) => item.sellerSupplierName))
  );
  const [deliveryState, setDeliveryState] = useState(
    commonValue(initiallySelectedItems.map((item) => item.sellerDeliveryState))
  );
  const [supplierDeliveryTime, setSupplierDeliveryTime] = useState(
    commonValue(initiallySelectedItems.map((item) => item.sellerSupplierDeliveryTime))
  );
  const [originRestrictions, setOriginRestrictions] = useState<string[]>(() => {
    if (initiallySelectedItems.length === 0) return [];
    const first = initiallySelectedItems[0].sellerOriginRestrictions;
    return initiallySelectedItems.every(
      (item) => JSON.stringify(item.sellerOriginRestrictions) === JSON.stringify(first)
    ) ? first : [];
  });
  const [itemForms, setItemForms] = useState<Record<string, BulkProcurementItemForm>>(() =>
    Object.fromEntries(items.map((item) => [item.id, {
      supplierDescription: item.sellerSupplierDescription || item.erpDescription || item.customerDescription || "",
      unitCost: item.sellerQuotedUnitCost === null ? "" : String(item.sellerQuotedUnitCost),
      currency: item.sellerQuotedCurrency || "MXN",
      exchangeRate: String(item.sellerQuotedExchangeRate || quoteExchangeRate),
      brand: item.sellerQuotedBrand || "",
      origin: item.sellerSupplierOrigin || "",
      deliveryTime: item.sellerSupplierDeliveryTime || "",
      validUntil: item.sellerSupplierQuoteValidUntil?.slice(0, 10) || "",
      externalReference: item.sellerSupplierQuoteReference || "",
      notes: item.sellerSupplierQuoteNotes || "",
      standard: item.purchaseStandard || "",
      diameter: item.purchaseDiameter || "",
      thickness: item.purchaseThickness || "",
      bore: item.purchaseBore || "",
      technicalFamily: item.technicalFamily || "OTHER",
      technicalAttributes: item.technicalAttributes || {},
      technicalRequiresReview: false,
    }]))
  );
  const [error, setError] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierInitialValues, setSupplierInitialValues] = useState<Partial<SaveSupplierInput> | undefined>();
  const [detectedSupplier, setDetectedSupplier] = useState<ExtractedSupplierData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionResult, setExtractionResult] = useState<SupplierQuoteExtractionResult | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [suggestingTechnicalBatch, setSuggestingTechnicalBatch] = useState(false);
  const supplierOptions = suppliers.data || [];
  const noRestrictionValue = useMemo(() => {
    const option = (restrictions.data || []).find((entry) => entry.code === "NO_RESTRICTION");
    return option ? optionValue(option) : "SIN RESTRICCIÓN";
  }, [restrictions.data]);
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const busy = saving || extracting || suggestingTechnicalBatch;
  const canExtractAttachment = Boolean(attachmentFile && /\.(pdf|xlsx?)$/i.test(attachmentFile.name));
  const itemIdSet = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const supplierQuoteFiles = useMemo(
    () => (attachments.data || []).filter(
      (file) => file.category === "SELLER_SUPPLIER_QUOTE"
        && file.clientItemIds.some((itemId) => itemIdSet.has(itemId)),
    ),
    [attachments.data, itemIdSet],
  );
  const itemLabels = useMemo(
    () => Object.fromEntries(items.map((item, index) => [item.id, `#${index + 1} ${item.erpCode || "LOCAL"}`])),
    [items],
  );
  const originOptions = (restrictions.data || []).filter((option) => option.code !== "NO_RESTRICTION");
  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) || null : null;

  const downloadAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.download(file);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo descargar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const deleteAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.delete(file.id);
      await attachments.refetch();
      notifier.success("Cotización del proveedor eliminada.");
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo eliminar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setError("");
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)));
    setError("");
  };

  const toggleRestriction = (value: string) => {
    setOriginRestrictions((current) => {
      if (current.includes(value)) return current.filter((entry) => entry !== value);
      if (value === noRestrictionValue) return [value];
      return [...current.filter((entry) => entry !== noRestrictionValue), value];
    });
  };

  const updateItemForm = (itemId: string, data: Partial<BulkProcurementItemForm>) => {
    setItemForms((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...data },
    }));
    setError("");
  };

  const suggestTechnicalBatch = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return setError("Selecciona al menos una partida.");
    if (selectedItems.length > 50) return setError("La IA puede analizar hasta 50 partidas por lote. Selecciona un grupo menor.");
    try {
      setSuggestingTechnicalBatch(true);
      setError("");
      const suggestions = await TechnicalDataService.suggestBatch(selectedItems.map((item) => ({
        itemId: item.id,
        requestedDescription: item.erpDescription || item.customerDescription,
        supplierDescription: itemForms[item.id].supplierDescription.trim() || undefined,
        existingAttributes: itemForms[item.id].technicalAttributes,
      })));
      const suggestionsById = new Map(suggestions.map((suggestion) => [suggestion.itemId, suggestion]));
      setItemForms((current) => Object.fromEntries(items.map((item) => {
        const form = current[item.id];
        const suggestion = suggestionsById.get(item.id);
        if (!suggestion) return [item.id, form];
        const attributes = Object.fromEntries(suggestion.attributes.map((attribute) => [attribute.key, attribute.value]));
        return [item.id, {
          ...form,
          technicalRequiresReview: suggestion.confidence < 0.75 || suggestion.attributes.some((attribute) => attribute.confidence < 0.65),
          technicalFamily: suggestion.family,
          technicalAttributes: { ...form.technicalAttributes, ...attributes },
          standard: attributes.STANDARD || form.standard,
          diameter: attributes.NOMINAL_DIAMETER || form.diameter,
          thickness: attributes.THICKNESS || attributes.SCHEDULE || form.thickness,
        }];
      })));
      const missing = selectedItems.length - suggestions.length;
      if (missing > 0) notifier.warning(`IA completó ${suggestions.length} partidas; ${missing} requieren captura manual.`);
      else notifier.success(`IA completó datos técnicos para ${suggestions.length} partida(s). Revisa cada resultado.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron sugerir los datos técnicos por lote.");
    } finally {
      setSuggestingTechnicalBatch(false);
    }
  };

  const extractSupplierQuote = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (!attachmentFile || !canExtractAttachment) return setError("Selecciona una cotización PDF, XLS o XLSX.");
    if (selectedItems.length === 0) return setError("Selecciona al menos una partida antes de extraer.");
    try {
      setExtracting(true);
      setExtractionProgress(0);
      setError("");
      const result = await SupplierQuoteExtractionService.extract(attachmentFile, setExtractionProgress);
      setExtractionResult(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo extraer la cotización del proveedor.");
    } finally {
      setExtracting(false);
    }
  };

  const applyExtractionMappings = (mappings: SupplierQuoteBulkMapping[]) => {
    if (!extractionResult) return;
    const mappedItems = Object.fromEntries(mappings.map((mapping) => [
      mapping.systemItemId,
      extractionResult.items[mapping.extractedItemIndex],
    ]));
    const mappedIds = new Set(mappings.map((mapping) => mapping.systemItemId));
    setSelectedIds(mappedIds);
    setItemForms((current) => Object.fromEntries(items.map((item) => {
      const extracted = mappedItems[item.id];
      if (!extracted) return [item.id, current[item.id]];
      return [item.id, {
        ...current[item.id],
        supplierDescription: extracted.description.toUpperCase(),
        unitCost: extracted.netUnitPrice === null ? current[item.id].unitCost : String(extracted.netUnitPrice),
        currency: extractionResult.header.currency || current[item.id].currency,
        exchangeRate: extractionResult.header.exchangeRate === null
          ? current[item.id].exchangeRate
          : String(extractionResult.header.exchangeRate),
        brand: extracted.brand || current[item.id].brand,
        origin: extracted.origin || current[item.id].origin,
        deliveryTime: extracted.deliveryTime || current[item.id].deliveryTime,
        validUntil: extractionResult.header.validUntil || current[item.id].validUntil,
        externalReference: extractionResult.header.reference || current[item.id].externalReference,
        notes: [
          extractionResult.header.paymentTerms ? `Pago: ${extractionResult.header.paymentTerms}` : "",
          extractionResult.header.deliveryTerms ? `Entrega: ${extractionResult.header.deliveryTerms}` : "",
        ].filter(Boolean).join(" | ") || current[item.id].notes,
      }];
    })));

    if (extractionResult.supplier.name || extractionResult.supplier.taxId) {
      setSupplierSelection(MANUAL_SUPPLIER);
      setSupplierName("");
      setDetectedSupplier(extractionResult.supplier);
    }

    const deliveryValues = mappings
      .map((mapping) => extractionResult.items[mapping.extractedItemIndex]?.deliveryTime)
      .filter((value): value is string => Boolean(value));
    const commonDelivery = deliveryValues.length > 0 && deliveryValues.every((value) => canonical(value) === canonical(deliveryValues[0]))
      ? deliveryValues[0]
      : "";
    if (commonDelivery) setSupplierDeliveryTime(commonDelivery);
    setExtractionResult(null);
    notifier.success(`IA aplicó datos a ${mappings.length} partida(s). Revisa costos y catálogos antes de guardar.`);
  };

  const submit = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    const normalizedSupplierName = supplierName.trim();
    if (selectedItems.length === 0) return setError("Selecciona al menos una partida.");
    if (!normalizedSupplierName) return setError("Selecciona o escribe el proveedor que cotizó las partidas.");
    if (supplierSelection === MANUAL_SUPPLIER) return setError("Selecciona un proveedor registrado o créalo antes de guardar el lote.");
    if (!deliveryState) return setError("Selecciona el estado donde se entregará el material.");

    const invalidCost = selectedItems.find((item) => {
      const cost = Number(itemForms[item.id]?.unitCost);
      return !Number.isFinite(cost) || cost <= 0;
    });
    if (invalidCost) {
      return setError(`Captura un costo mayor a cero para la partida ${invalidCost.erpCode || invalidCost.id}.`);
    }
    const missingDescription = selectedItems.find((item) => !itemForms[item.id].supplierDescription.trim());
    if (missingDescription) return setError(`Captura la descripción del proveedor para ${missingDescription.erpCode || "la partida local"}.`);
    const invalidExchangeRate = selectedItems.find((item) => {
      const form = itemForms[item.id];
      return form.currency === "USD" && (!Number.isFinite(Number(form.exchangeRate)) || Number(form.exchangeRate) <= 0);
    });
    if (invalidExchangeRate) return setError(`Captura un tipo de cambio válido para ${invalidExchangeRate.erpCode || "la partida local"}.`);
    const missingDelivery = selectedItems.find((item) => !(itemForms[item.id].deliveryTime || supplierDeliveryTime));
    if (missingDelivery) return setError(`Captura el tiempo de entrega para ${missingDelivery.erpCode || "la partida local"}.`);
    const pendingTechnicalReview = selectedItems.find((item) => itemForms[item.id].technicalRequiresReview);
    if (pendingTechnicalReview) return setError(`Revisa y confirma los datos técnicos sugeridos para ${pendingTechnicalReview.erpCode || "la partida local"}.`);

    const updates = selectedItems.map((item) => {
      const form = itemForms[item.id];
      return {
        itemId: item.id,
        data: {
          sellerSupplierId: supplierSelection === MANUAL_SUPPLIER ? null : supplierSelection,
          sellerSupplierName: normalizedSupplierName,
          sellerQuotedUnitCost: Number(form.unitCost),
          sellerQuotedCurrency: form.currency,
          sellerQuotedExchangeRate: form.currency === "USD"
            ? Number(form.exchangeRate)
            : null,
          sellerQuotedBrand: form.brand,
          sellerSupplierDescription: form.supplierDescription.trim().toUpperCase(),
          sellerSupplierOrigin: form.origin,
          sellerSupplierQuoteValidUntil: form.validUntil,
          sellerSupplierQuoteReference: form.externalReference.trim(),
          sellerSupplierQuoteNotes: form.notes.trim(),
          sellerOriginRestrictions: originRestrictions,
          sellerDeliveryState: deliveryState,
          sellerSupplierDeliveryTime: form.deliveryTime || supplierDeliveryTime,
          purchaseStandard: form.standard.trim(),
          purchaseDiameter: form.diameter.trim(),
          purchaseThickness: form.thickness.trim(),
          purchaseBore: form.bore.trim(),
          technicalFamily: form.technicalFamily,
          technicalAttributes: form.technicalAttributes,
        },
      };
    });
    try {
      setSaving(true);
      setError("");
      if (attachmentFile) {
        await AttachmentsService.uploadSellerQuote(clientDraftId, selectedItems.map((item) => item.id), attachmentFile);
        await attachments.refetch();
      }
      onSave(updates);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la cotización del proveedor.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
  const tableInputClass = "w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
  const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";
  const catalogsLoading = suppliers.isLoading
    || brands.isLoading
    || restrictions.isLoading
    || deliveryStates.isLoading
    || deliveryTimes.isLoading;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-procurement-prequote-title">
      <div className="absolute inset-0 bg-slate-950/55" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><CheckSquare2 className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Información para Compras</p>
              <h2 id="bulk-procurement-prequote-title" className="text-base font-semibold text-slate-900">Completar compra en lote</h2>
              <p className="mt-1 text-xs text-slate-500">Asigna un proveedor a una o varias partidas locales o sin stock.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="bulk-supplier" className={labelClass}>Proveedor *</label>
                  <button type="button" onClick={() => {
                    setSupplierInitialValues(undefined);
                    setSupplierModalOpen(true);
                  }} className="inline-flex items-center gap-1 text-xs font-semibold normal-case tracking-normal text-blue-700 hover:text-blue-600 hover:underline">
                    <Store className="h-3.5 w-3.5" />Nuevo proveedor
                  </button>
                </div>
                <select id="bulk-supplier" value={supplierSelection} onChange={(event) => {
                  const id = event.target.value;
                  setSupplierSelection(id);
                  const supplier = supplierOptions.find((entry) => entry.id === id);
                  setSupplierName(supplier?.name || "");
                }} className={inputClass}>
                  <option value={MANUAL_SUPPLIER}>Otro / no registrado</option>
                  {supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</option>)}
                </select>
              </div>
              <label className={labelClass}>Nombre del proveedor *
                <input value={supplierName} onChange={(event) => {
                  setSupplierName(event.target.value);
                  if (supplierSelection !== MANUAL_SUPPLIER) setSupplierSelection(MANUAL_SUPPLIER);
                }} className={inputClass} placeholder="Proveedor que cotizó" />
              </label>
              <label className={labelClass}>Estado de entrega *
                <select value={deliveryState} onChange={(event) => setDeliveryState(event.target.value)} className={inputClass}>
                  <option value="">Seleccionar estado</option>
                  {(deliveryStates.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>Tiempo ofrecido *
                <select value={supplierDeliveryTime} onChange={(event) => {
                  const value = event.target.value;
                  setSupplierDeliveryTime(value);
                  setItemForms((current) => Object.fromEntries(items.map((item) => [
                    item.id,
                    selectedIds.has(item.id) ? { ...current[item.id], deliveryTime: value } : current[item.id],
                  ])));
                }} className={inputClass}>
                  <option value="">Seleccionar tiempo</option>
                  {supplierDeliveryTime && !(deliveryTimes.data || []).some((option) => canonical(optionValue(option)) === canonical(supplierDeliveryTime)) && (
                    <option value={supplierDeliveryTime}>{supplierDeliveryTime} (detectado)</option>
                  )}
                  {(deliveryTimes.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          <label className="mt-4 block rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-amber-600" />Cotización del proveedor para las partidas seleccionadas (opcional)</span>
            <input type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={(event) => {
              setAttachmentFile(event.currentTarget.files?.[0] || null);
            }} className="mt-3 w-full text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-semibold file:text-slate-950" />
            {attachmentFile && <span className="mt-2 block font-normal normal-case tracking-normal text-slate-500">{attachmentFile.name}</span>}
            <button type="button" disabled={!canExtractAttachment || busy || selectedIds.size === 0} onClick={() => void extractSupplierQuote()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold normal-case tracking-normal text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {extracting ? `Extrayendo con IA (${extractionProgress}%)` : "Extraer y mapear partidas con IA"}
            </button>
          </label>

          <div className="mt-4">
            <AttachmentsPanel
              files={supplierQuoteFiles}
              loading={attachments.isLoading}
              title="Cotizaciones de proveedor ligadas a estas partidas"
              itemLabels={itemLabels}
              canDelete
              busyFileId={busyAttachmentId}
              onPreview={setPreviewFile}
              onDownload={(file) => { void downloadAttachment(file); }}
              onDelete={(file) => { void deleteAttachment(file); }}
            />
          </div>

          <fieldset className="mt-4 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Restricción de origen para las partidas seleccionadas</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(restrictions.data || []).map((option) => {
                const value = optionValue(option);
                const checked = originRestrictions.includes(value);
                return <label key={option.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${checked ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}><input type="checkbox" checked={checked} onChange={() => toggleRestriction(value)} className="sr-only" />{option.label}</label>;
              })}
            </div>
          </fieldset>

          <section className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Partidas para este proveedor</p>
                <p className="text-xs text-slate-500">{selectedIds.size} de {items.length} seleccionadas</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || selectedIds.size === 0} onClick={() => void suggestTechnicalBatch()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">{suggestingTechnicalBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Completar datos técnicos con IA</button>
                <button type="button" onClick={toggleAll} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  {allSelected ? "Quitar selección" : "Seleccionar todas"}
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center text-[11px] font-semibold uppercase text-slate-500">Sel.</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Partida</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Descripción</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Cantidad</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Costo unitario *</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Moneda *</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Marca</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Entrega / procedencia</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Datos técnicos</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase text-slate-500">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item) => {
                    const selected = selectedIds.has(item.id);
                    const form = itemForms[item.id];
                    return (
                      <tr key={item.id} className={selected ? "bg-amber-50/40" : "opacity-60"}>
                        <td className="px-3 py-3 text-center">
                          <input type="checkbox" checked={selected} onChange={() => toggleItem(item.id)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-700">
                          {item.erpCode || "LOCAL"}
                          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{item.erpCode ? "SIN STOCK" : "LOCAL"}</span>
                        </td>
                        <td className="max-w-xs px-3 py-3 text-xs text-slate-600">{item.erpDescription || item.customerDescription}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{item.qty} {item.unit}</td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={form.unitCost} disabled={!selected} onChange={(event) => updateItemForm(item.id, { unitCost: event.target.value })} className={tableInputClass} placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={form.currency} disabled={!selected} onChange={(event) => updateItemForm(item.id, { currency: event.target.value as QuoteCurrency })} className={tableInputClass}>
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={form.brand} disabled={!selected} onChange={(event) => updateItemForm(item.id, { brand: event.target.value })} className={tableInputClass}>
                            <option value="">Seleccionar</option>
                            {form.brand && !(brands.data || []).some((option) => canonical(optionValue(option)) === canonical(form.brand)) && <option value={form.brand}>{form.brand} (detectada)</option>}
                            {(brands.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="min-w-36 px-3 py-3 text-[11px] text-slate-600"><p className="font-semibold text-slate-700">{form.deliveryTime || "Sin tiempo"}</p><p className="mt-1">{form.origin || "Sin procedencia"}</p></td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${form.technicalRequiresReview ? "bg-blue-100 text-blue-700" : technicalDataStatus(form) === "COMPLETE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{form.technicalRequiresReview ? "Revisar IA" : technicalDataStatus(form) === "COMPLETE" ? `Completo · ${form.technicalFamily}` : "Pendiente"}</span></td>
                        <td className="px-3 py-2 text-center"><button type="button" disabled={!selected || busy} onClick={() => setEditingItemId(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-40"><PencilLine className="h-3.5 w-3.5" />Editar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          {catalogsLoading && <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando proveedores y catálogos...</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="inline-flex items-center gap-2 text-xs text-slate-500"><PackageSearch className="h-4 w-4" />El precio vendedor se actualizará con el costo cotizado de cada partida.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Aplicar a {selectedIds.size} partida(s)</button>
          </div>
        </div>
      </div>
      {previewFile && <PdfAttachmentViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {extractionResult && (
        <SupplierQuoteBulkExtractionReviewModal
          result={extractionResult}
          items={items.filter((item) => selectedIds.has(item.id))}
          onApply={applyExtractionMappings}
          onClose={() => setExtractionResult(null)}
        />
      )}
      {editingItem && (
        <BulkProcurementItemEditorModal
          item={editingItem}
          value={itemForms[editingItem.id]}
          brands={brands.data || []}
          origins={originOptions}
          deliveryTimes={deliveryTimes.data || []}
          onClose={() => setEditingItemId(null)}
          onSave={(value) => {
            setItemForms((current) => ({ ...current, [editingItem.id]: value }));
            setEditingItemId(null);
            setError("");
          }}
        />
      )}
      {detectedSupplier && (
        <DetectedSupplierModal
          detected={detectedSupplier}
          matchedSupplier={findDetectedSupplierMatch(detectedSupplier, supplierOptions)}
          onUseMatched={(supplier) => {
            setSupplierSelection(supplier.id);
            setSupplierName(supplier.name);
            setDetectedSupplier(null);
          }}
          onCreate={(initialValues) => {
            setDetectedSupplier(null);
            setSupplierInitialValues(initialValues);
            setSupplierModalOpen(true);
          }}
          onChooseOther={() => {
            setDetectedSupplier(null);
            setSupplierInitialValues(undefined);
            setSupplierModalOpen(true);
          }}
          onClose={() => setDetectedSupplier(null)}
        />
      )}
      {supplierModalOpen && (
        <SelectOrCreateSupplierModal
          initialValues={supplierInitialValues}
          initialMode={supplierInitialValues ? "LOCAL" : "ERP"}
          onClose={() => {
            setSupplierModalOpen(false);
            setSupplierInitialValues(undefined);
          }}
          onSelect={(supplier) => {
            setSupplierSelection(supplier.id);
            setSupplierName(supplier.name);
            setSupplierModalOpen(false);
            setSupplierInitialValues(undefined);
            setError("");
          }}
        />
      )}
    </div>
  );
};
