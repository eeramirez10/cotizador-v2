import { AutoAwesomeOutlined, FolderOpenOutlined } from "@mui/icons-material";
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { CheckSquare2, Loader2, PackageSearch, Paperclip, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import type { BulkProcurementItemForm } from "./bulk-procurement-item.types";
import { DetectedSupplierModal, findDetectedSupplierMatch } from "./detected-supplier.modal";
import { getQuoteItemFulfillment } from "../../../modules/quotes/utils/quote-fulfillment";
import { SellerSupplierBulkReferenceTable } from "./seller-supplier-bulk-reference-table";
import { SupplierRestrictionSelect } from "./supplier-offer-line-controls";
import { compactFieldSx } from "./supplier-offer-line-styles";

interface SellerProcurementBulkPrequoteModalProps {
  items: ManualQuoteItem[];
  clientDraftId: string;
  quoteExchangeRate: number;
  onClose: () => void;
  onSave: (updates: ProcurementPrequoteUpdate[]) => void | Promise<void>;
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
  const [itemForms, setItemForms] = useState<Record<string, BulkProcurementItemForm>>(() =>
    Object.fromEntries(items.map((item) => [item.id, {
      supplierProductCode: item.sellerSupplierProductCode || "",
      supplierDescription: item.sellerSupplierDescription || "",
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
      originRestrictions: item.sellerOriginRestrictions || [],
    }]))
  );
  const [bulkRestrictions, setBulkRestrictions] = useState<string[]>([]);
  const [bulkCurrency, setBulkCurrency] = useState<QuoteCurrency | "">("");
  const [stage, setStage] = useState<"SELECT" | "CAPTURE">("SELECT");
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
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [suggestingTechnicalBatch, setSuggestingTechnicalBatch] = useState(false);
  const [suggestingTechnicalItemId, setSuggestingTechnicalItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supplierOptions = suppliers.data || [];
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const busy = saving || extracting || suggestingTechnicalBatch || suggestingTechnicalItemId !== null;
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
  const selectedItems = items.filter((item) => selectedIds.has(item.id));

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
    setAttachmentFile(null);
    setExtractionResult(null);
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)));
    setAttachmentFile(null);
    setExtractionResult(null);
  };

  const continueToCapture = () => {
    const chosen = items.filter((item) => selectedIds.has(item.id));
    if (chosen.length === 0) return notifier.error("Selecciona al menos una partida.");
    const selectedSupplierId = commonValue(chosen.map((item) => item.sellerSupplierId || ""));
    const supplier = supplierOptions.find((entry) => entry.id === selectedSupplierId);
    setSupplierSelection(supplier ? supplier.id : MANUAL_SUPPLIER);
    setSupplierName(supplier?.name || "");
    setDeliveryState(commonValue(chosen.map((item) => item.sellerDeliveryState)));
    setSupplierDeliveryTime(commonValue(chosen.map((item) => item.sellerSupplierDeliveryTime)));
    setStage("CAPTURE");
  };

  const updateItemForm = (itemId: string, data: Partial<BulkProcurementItemForm>) => {
    setItemForms((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...data },
    }));
  };

  const applyBulkRestrictions = () => {
    setItemForms((current) => {
      const next = { ...current };
      for (const item of selectedItems) {
        next[item.id] = { ...current[item.id], originRestrictions: [...bulkRestrictions] };
      }
      return next;
    });
    notifier.success(`Restricciones aplicadas a ${selectedItems.length} partida(s).`);
  };

  const applyBulkCurrency = () => {
    if (!bulkCurrency) return notifier.error("Selecciona una moneda para aplicar a las partidas.");
    setItemForms((current) => {
      const next = { ...current };
      for (const item of selectedItems) {
        next[item.id] = { ...current[item.id], currency: bulkCurrency };
      }
      return next;
    });
    notifier.success(`Moneda ${bulkCurrency} aplicada a ${selectedItems.length} partida(s).`);
  };

  const suggestTechnicalItem = async (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    const form = itemForms[itemId];
    if (!item || !form) return;
    try {
      setSuggestingTechnicalItemId(itemId);
      const suggestion = await TechnicalDataService.suggest({
        requestedDescription: item.erpDescription || item.customerDescription,
        supplierDescription: form.supplierDescription.trim() || undefined,
        existingAttributes: form.technicalAttributes,
      });
      const attributes = Object.fromEntries(suggestion.attributes.map((entry) => [entry.key, entry.value]));
      updateItemForm(itemId, {
        technicalFamily: suggestion.family,
        technicalAttributes: { ...form.technicalAttributes, ...attributes },
        standard: attributes.STANDARD || form.standard,
        diameter: attributes.NOMINAL_DIAMETER || form.diameter,
        thickness: attributes.THICKNESS || attributes.SCHEDULE || form.thickness,
        bore: attributes.BORE || form.bore,
        technicalRequiresReview: suggestion.confidence < 0.75 || suggestion.attributes.some((entry) => entry.confidence < 0.65),
      });
      notifier.success("Datos técnicos sugeridos. Revisa y confirma la ficha de la partida.");
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudieron sugerir los datos técnicos.");
    } finally {
      setSuggestingTechnicalItemId(null);
    }
  };

  const suggestTechnicalBatch = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return notifier.error("Selecciona al menos una partida.");
    if (selectedItems.length > 50) return notifier.error("La IA puede analizar hasta 50 partidas por lote. Selecciona un grupo menor.");
    try {
      setSuggestingTechnicalBatch(true);
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
      notifier.error(caught instanceof Error ? caught.message : "No se pudieron sugerir los datos técnicos por lote.");
    } finally {
      setSuggestingTechnicalBatch(false);
    }
  };

  const extractSupplierQuote = async (file: File) => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return notifier.error("Selecciona al menos una partida antes de extraer.");
    try {
      setExtracting(true);
      setExtractionProgress(0);
      const result = await SupplierQuoteExtractionService.extract(file, setExtractionProgress);
      setExtractionResult(result);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo extraer la cotización del proveedor.");
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
    setBulkCurrency(extractionResult.header.currency || "");
    setItemForms((current) => Object.fromEntries(items.map((item) => {
      const extracted = mappedItems[item.id];
      if (!extracted) return [item.id, current[item.id]];
      return [item.id, {
        ...current[item.id],
        supplierProductCode: extracted.supplierProductCode || current[item.id].supplierProductCode,
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
    if (selectedItems.length === 0) return notifier.error("Selecciona al menos una partida.");
    if (!normalizedSupplierName) return notifier.error("Selecciona o escribe el proveedor que cotizó las partidas.");
    if (supplierSelection === MANUAL_SUPPLIER) return notifier.error("Selecciona un proveedor registrado o créalo antes de guardar el lote.");
    if (!deliveryState) return notifier.error("Selecciona el estado donde se entregará el material.");

    const invalidCost = selectedItems.find((item) => {
      const cost = Number(itemForms[item.id]?.unitCost);
      return !Number.isFinite(cost) || cost <= 0;
    });
    if (invalidCost) {
      return notifier.error(`Captura un costo mayor a cero para la partida ${invalidCost.erpCode || invalidCost.id}.`);
    }
    const invalidExchangeRate = selectedItems.find((item) => {
      const form = itemForms[item.id];
      return form.currency === "USD" && (!Number.isFinite(Number(form.exchangeRate)) || Number(form.exchangeRate) <= 0);
    });
    if (invalidExchangeRate) return notifier.error(`Captura un tipo de cambio válido para ${invalidExchangeRate.erpCode || "la partida local"}.`);
    const missingDelivery = selectedItems.find((item) => !(itemForms[item.id].deliveryTime || supplierDeliveryTime));
    if (missingDelivery) return notifier.error(`Captura el tiempo de entrega para ${missingDelivery.erpCode || "la partida local"}.`);
    const pendingTechnicalReview = selectedItems.find((item) => itemForms[item.id].technicalRequiresReview);
    if (pendingTechnicalReview) return notifier.error(`Revisa y confirma los datos técnicos sugeridos para ${pendingTechnicalReview.erpCode || "la partida local"}.`);

    const updates: ProcurementPrequoteUpdate[] = selectedItems.map((item) => {
      const form = itemForms[item.id];
      return {
        itemId: item.id,
        data: {
          sellerSupplierId: supplierSelection === MANUAL_SUPPLIER ? null : supplierSelection,
          sellerSupplierName: normalizedSupplierName,
          sellerQuotedUnitCost: Number(form.unitCost),
          sellerCostSource: attachmentFile || supplierQuoteFiles.some((file) => file.clientItemIds.includes(item.id))
            ? "SELLER_SUPPLIER_QUOTE"
            : "ESTIMATED",
          sellerQuotedCurrency: form.currency,
          sellerQuotedExchangeRate: form.currency === "USD"
            ? Number(form.exchangeRate)
            : null,
          sellerQuotedBrand: form.brand,
          sellerSupplierDescription: form.supplierDescription.trim().toUpperCase(),
          sellerSupplierProductCode: form.supplierProductCode.trim(),
          sellerSupplierOrigin: form.origin,
          sellerSupplierQuoteValidUntil: form.validUntil,
          sellerSupplierQuoteReference: form.externalReference.trim(),
          sellerSupplierQuoteNotes: form.notes.trim(),
          sellerOriginRestrictions: form.originRestrictions,
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
      if (attachmentFile) {
        await AttachmentsService.uploadSellerQuote(clientDraftId, selectedItems.map((item) => item.id), attachmentFile);
        await attachments.refetch();
      }
      await onSave(updates);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo guardar la cotización del proveedor.");
    } finally {
      setSaving(false);
    }
  };

  const catalogsLoading = suppliers.isLoading
    || brands.isLoading
    || restrictions.isLoading
    || deliveryStates.isLoading
    || deliveryTimes.isLoading;

  if (stage === "SELECT") return <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-select-title">
    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Un proveedor por referencia</p><h2 id="bulk-select-title" className="mt-1 text-lg font-semibold text-slate-900">Seleccionar partidas para el proveedor</h2><p className="mt-1 text-xs text-slate-500">Elige todas o solo las partidas que cotizó el mismo proveedor. Las demás no cambiarán.</p></div><button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></header>
      <div className="min-h-0 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700"><Checkbox checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} onChange={toggleAll} size="small" />Seleccionar todas</label><span className="text-xs text-slate-500">{selectedIds.size} de {items.length} seleccionadas</span></div>
        <div className="space-y-2">{items.map((item, index) => {
          const purchaseQty = getQuoteItemFulfillment(item).purchaseQty;
          return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${selectedIds.has(item.id) ? "border-amber-300 bg-amber-50" : "border-slate-200 hover:bg-slate-50"}`}><Checkbox checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} size="small" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-900">#{index + 1} · {item.erpCode || item.ean || "Producto local"} · {purchaseQty} {item.unit}</span><span className="mt-0.5 block text-[11px] text-slate-600">{item.erpDescription || item.customerDescription}</span>{item.sellerSupplierName && <span className="mt-0.5 block text-[10px] text-amber-800">Referencia actual: {item.sellerSupplierName}. Se reemplazará si guardas esta partida.</span>}</span></label>;
        })}</div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3"><Button type="button" size="small" variant="outlined" onClick={onClose}>Cancelar</Button><Button type="button" size="small" variant="contained" disabled={selectedIds.size === 0} onClick={continueToCapture}>Pasar {selectedIds.size} partida(s) a la tabla</Button></footer>
    </div>
  </div>;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-procurement-prequote-title">
      <div className="absolute inset-0 bg-slate-950/55" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-[min(1500px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><CheckSquare2 className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Información opcional para Compras</p>
              <h2 id="bulk-procurement-prequote-title" className="text-base font-semibold text-slate-900">Referencia de un proveedor · {selectedItems.length} partida(s)</h2>
              <p className="mt-1 text-xs text-slate-500">Las partidas de esta tabla se guardarán con el mismo proveedor.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp" className="sr-only" aria-label="Seleccionar cotización del proveedor" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              setAttachmentFile(file);
              if (/\.(pdf|xlsx?)$/i.test(file.name)) void extractSupplierQuote(file);
              else notifier.warning("El archivo quedó adjunto. La extracción con IA solo admite PDF, XLS y XLSX.");
            }} />
            <Button type="button" size="small" variant="outlined" disabled={busy} onClick={() => setStage("SELECT")} sx={{ fontSize: 11, textTransform: "none" }}>Cambiar selección</Button>
            <Button type="button" size="small" variant="contained" disabled={busy} startIcon={<AutoAwesomeOutlined fontSize="small" />} onClick={() => fileInputRef.current?.click()} sx={{ fontSize: 11, textTransform: "none" }}>{extracting ? `Extrayendo ${extractionProgress}%` : "Extraer cotización con IA"}</Button>
            <Button type="button" size="small" variant="outlined" startIcon={<FolderOpenOutlined fontSize="small" />} onClick={() => setAttachmentsOpen(true)} sx={{ fontSize: 11, textTransform: "none" }}>Ver cotizaciones del proveedor</Button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-800">Proveedor y documento</h3><Button type="button" size="small" variant="outlined" onClick={() => { setSupplierInitialValues(undefined); setSupplierModalOpen(true); }} sx={{ fontSize: 11, textTransform: "none" }}>Nuevo proveedor</Button></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <TextField select size="small" required label="Proveedor" value={supplierSelection} onChange={(event) => { const id = event.target.value; setSupplierSelection(id); setSupplierName(supplierOptions.find((entry) => entry.id === id)?.name || ""); }} sx={{ ...compactFieldSx, gridColumn: { sm: "span 2", lg: "span 3" } }}>
                <MenuItem value={MANUAL_SUPPLIER}>Seleccionar proveedor</MenuItem>
                {supplierOptions.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" required label="Estado de entrega" value={deliveryState} onChange={(event) => setDeliveryState(event.target.value)} sx={compactFieldSx}><MenuItem value="">Seleccionar estado</MenuItem>{(deliveryStates.data || []).map((option) => <MenuItem key={option.id} value={optionValue(option)}>{option.label}</MenuItem>)}</TextField>
              <TextField size="small" label="No. cotización proveedor" value={commonValue(selectedItems.map((item) => itemForms[item.id].externalReference))} onChange={(event) => selectedItems.forEach((item) => updateItemForm(item.id, { externalReference: event.target.value }))} sx={compactFieldSx} />
              <TextField size="small" type="date" label="Vigencia" value={commonValue(selectedItems.map((item) => itemForms[item.id].validUntil))} onChange={(event) => selectedItems.forEach((item) => updateItemForm(item.id, { validUntil: event.target.value }))} InputLabelProps={{ shrink: true }} sx={compactFieldSx} />
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
                <SupplierRestrictionSelect id="supplier-restrictions-all" label="Restricción general" value={bulkRestrictions} options={restrictions.data || []} onChange={setBulkRestrictions} />
                <Button type="button" size="small" variant="outlined" disabled={busy || selectedItems.length === 0} onClick={applyBulkRestrictions} aria-label="Aplicar restricción a todas las partidas" sx={{ fontSize: 10, textTransform: "none" }}>Aplicar</Button>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
                <TextField select size="small" label="Moneda general" value={bulkCurrency} onChange={(event) => setBulkCurrency(event.target.value as QuoteCurrency | "")} sx={{ ...compactFieldSx, minWidth: 135 }}>
                  <MenuItem value="">Seleccionar</MenuItem>
                  <MenuItem value="MXN">MXN</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </TextField>
                <Button type="button" size="small" variant="outlined" disabled={busy || selectedItems.length === 0 || !bulkCurrency} onClick={applyBulkCurrency} aria-label="Aplicar moneda a todas las partidas" sx={{ fontSize: 10, textTransform: "none" }}>Aplicar</Button>
              </div>
            </div>
          </section>

          {attachmentFile && <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-slate-700"><Paperclip className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">Archivo para adjuntar: {attachmentFile.name}</span><Button type="button" size="small" onClick={() => setAttachmentFile(null)} sx={{ fontSize: 10 }}>Quitar</Button></div>}

          <section className="mt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-xs font-semibold text-slate-900">Material cotizado por este proveedor</h3><p className="text-[10px] text-slate-500">{selectedItems.length} partida(s). Cada fila conserva su costo, restricciones y datos técnicos.</p></div>
              <Button type="button" size="small" variant="outlined" disabled={busy} startIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => void suggestTechnicalBatch()} sx={{ fontSize: 10, textTransform: "none" }}>{suggestingTechnicalBatch ? "Completando..." : "Completar datos técnicos de todas con IA"}</Button>
            </div>
            <SellerSupplierBulkReferenceTable
              items={selectedItems}
              forms={itemForms}
              brands={brands.data || []}
              origins={originOptions}
              deliveryTimes={deliveryTimes.data || []}
              restrictions={restrictions.data || []}
              suggestingItemId={suggestingTechnicalItemId}
              busy={busy}
              onSuggest={(itemId) => { void suggestTechnicalItem(itemId); }}
              onChange={updateItemForm}
            />
          </section>

          <TextField size="small" multiline minRows={2} fullWidth label="Notas y condiciones del proveedor" value={commonValue(selectedItems.map((item) => itemForms[item.id].notes))} onChange={(event) => selectedItems.forEach((item) => updateItemForm(item.id, { notes: event.target.value }))} sx={{ ...compactFieldSx, mt: 2 }} />

          {catalogsLoading && <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando proveedores y catálogos...</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="inline-flex items-center gap-2 text-xs text-slate-500"><PackageSearch className="h-4 w-4" />Solo se guardarán las partidas seleccionadas para {supplierName || "este proveedor"}.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Aplicar a {selectedIds.size} partida(s)</button>
          </div>
        </div>
      </div>
      <Dialog open={attachmentsOpen} onClose={() => setAttachmentsOpen(false)} fullWidth maxWidth="md" aria-labelledby="bulk-supplier-attachments-title">
        <DialogTitle id="bulk-supplier-attachments-title" sx={{ fontSize: 16, fontWeight: 600 }}>Cotizaciones del proveedor</DialogTitle>
        <DialogContent dividers><AttachmentsPanel files={supplierQuoteFiles.filter((file) => file.clientItemIds.some((id) => selectedIds.has(id)))} loading={attachments.isLoading} title="Cotizaciones ligadas a estas partidas" itemLabels={itemLabels} canDelete busyFileId={busyAttachmentId} onPreview={setPreviewFile} onDownload={(file) => { void downloadAttachment(file); }} onDelete={(file) => { void deleteAttachment(file); }} /></DialogContent>
        <DialogActions><Button type="button" size="small" onClick={() => setAttachmentsOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>
      {previewFile && <PdfAttachmentViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {extractionResult && (
        <SupplierQuoteBulkExtractionReviewModal
          result={extractionResult}
          items={items.filter((item) => selectedIds.has(item.id))}
          onApply={applyExtractionMappings}
          onClose={() => setExtractionResult(null)}
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
          }}
        />
      )}
    </div>
  );
};
