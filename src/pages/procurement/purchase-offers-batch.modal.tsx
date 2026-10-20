import { useMemo, useRef, useState } from "react";
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { FileSearch, FolderOpen, Loader2, Paperclip, Plus, Sparkles } from "lucide-react";
import type { Currency, PurchaseRequisition, RequisitionItem, SaveOffersBatchInput, SaveSupplierInput } from "../../modules/procurement/services/purchase-requisitions.service";
import { SupplierQuoteExtractionService, type ExtractedSupplierData, type SupplierQuoteExtractionResult } from "../../modules/procurement/services/supplier-quote-extraction.service";
import { AttachmentsService, type FileAttachment } from "../../modules/attachments/services/attachments.service";
import { usePurchaseRequisitionMutations, useSuppliers } from "../../queries/procurement/use-purchase-requisitions";
import { useRequisitionAttachments } from "../../queries/attachments/use-attachments";
import { useQuoteCatalogs } from "../../queries/quote-catalogs/use-quote-catalogs";
import { TechnicalDataService } from "../../modules/procurement/services/technical-data.service";
import { notifier } from "../../shared/notifications/notifier";
import { SelectOrCreateSupplierModal } from "../../shared/components/modals/select-or-create-supplier.modal";
import { SupplierQuoteBulkExtractionReviewModal, type SupplierQuoteBulkMapping } from "../../shared/components/modals/supplier-quote-bulk-extraction-review.modal";
import { DetectedSupplierModal, findDetectedSupplierMatch } from "../../shared/components/modals/detected-supplier.modal";
import { SupplierBulkReferenceTable, type SupplierBulkLineItem } from "../../shared/components/modals/seller-supplier-bulk-reference-table";
import type { BulkProcurementItemForm } from "../../shared/components/modals/bulk-procurement-item.types";
import { SupplierRestrictionSelect } from "../../shared/components/modals/supplier-offer-line-controls";
import { compactFieldSx } from "../../shared/components/modals/supplier-offer-line-styles";
import { AttachmentsPanel } from "../../shared/components/attachments/attachments-panel";
import { PdfAttachmentViewerModal } from "../../shared/components/attachments/pdf-attachment-viewer.modal";

const optionValue = (option: { value: string | null; label: string }) => option.value || option.label;

const defaultRow = (item: RequisitionItem): BulkProcurementItemForm => ({
  supplierProductCode: "",
  supplierDescription: "",
  unitCost: "",
  currency: item.sellerCurrency || "MXN",
  exchangeRate: "",
  brand: item.sellerBrand || "",
  origin: "",
  deliveryTime: item.sellerDeliveryTime || "",
  validUntil: "",
  externalReference: "",
  notes: "",
  standard: item.standard || "",
  diameter: item.diameter || "",
  thickness: item.thickness || "",
  bore: item.bore || "",
  technicalFamily: item.technicalFamily || "OTHER",
  technicalAttributes: item.technicalAttributes || {},
  technicalRequiresReview: false,
  originRestrictions: item.originRestrictions || [],
});

const tableItem = (item: RequisitionItem): SupplierBulkLineItem => ({
  id: item.id,
  position: item.position,
  qty: item.qty,
  unit: item.unit,
  erpCode: item.erpCode || "",
  ean: item.erpEan || "",
  customerDescription: item.customerDescription || item.description,
  erpDescription: item.erpDescription || "",
});

const mappingItem = (item: RequisitionItem) => ({
  id: item.id,
  erpCode: item.erpCode || "",
  ean: item.erpEan || "",
  erpDescription: item.erpDescription || item.description,
  customerDescription: item.customerDescription || item.description,
  qty: item.qty,
  unit: item.unit,
  customerUnit: item.unit,
});

export const PurchaseOffersBatchModal = ({ requisition, editingSupplierQuoteId, onClose, onSaved }: {
  requisition: PurchaseRequisition;
  editingSupplierQuoteId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { createOffersBatch, updateOffersBatch } = usePurchaseRequisitionMutations();
  const editingOffers = requisition.items.flatMap((item) => item.offers
    .filter((offer) => offer.source === "PURCHASING" && offer.supplierQuoteId === editingSupplierQuoteId)
    .map((offer) => ({ item, offer })));
  const existingByItemId = new Map(editingOffers.map(({ item, offer }) => [item.id, offer]));
  const editingQuote = editingOffers[0]?.offer.supplierQuote || null;
  const fixedSupplierId = editingOffers[0]?.offer.supplierId || "";
  const editingItemIds = new Set(editingOffers.map(({ item }) => item.id));
  const suppliers = useSuppliers();
  const brands = useQuoteCatalogs("PURCHASE_BRAND");
  const restrictions = useQuoteCatalogs("ORIGIN_RESTRICTION");
  const deliveryStates = useQuoteCatalogs("DELIVERY_STATE");
  const deliveryTimes = useQuoteCatalogs("DELIVERY_TIME");
  const attachments = useRequisitionAttachments(requisition.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"SELECT" | "CAPTURE">(editingSupplierQuoteId ? "CAPTURE" : "SELECT");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(
    editingSupplierQuoteId
      ? editingOffers.map(({ item }) => item.id)
      : requisition.items.filter((item) => !item.offers.some((offer) => offer.source === "PURCHASING")).map((item) => item.id),
  ));
  const [rows, setRows] = useState<Record<string, BulkProcurementItemForm>>(() => Object.fromEntries(
    requisition.items.map((item) => {
      const offer = existingByItemId.get(item.id);
      return [item.id, offer ? {
        ...defaultRow(item), supplierProductCode: offer.supplierProductCode || "",
        supplierDescription: offer.supplierDescription || "", unitCost: String(offer.unitCost),
        currency: offer.currency, exchangeRate: offer.exchangeRate ? String(offer.exchangeRate) : String(requisition.quoteExchangeRate || ""),
        brand: offer.brand || "", origin: offer.origin || "", deliveryTime: offer.deliveryTime || "",
        validUntil: offer.validUntil?.slice(0, 10) || "", externalReference: offer.externalReference || "",
        notes: offer.notes || "",
      } : { ...defaultRow(item), exchangeRate: requisition.quoteExchangeRate > 0 ? String(requisition.quoteExchangeRate) : "" }];
    }),
  ));
  const [supplierId, setSupplierId] = useState(fixedSupplierId || requisition.supplierId || "");
  const [deliveryState, setDeliveryState] = useState(requisition.deliveryState || "");
  const [bulkCurrency, setBulkCurrency] = useState<Currency | "">(editingQuote?.currency || "");
  const [globalExchangeRate, setGlobalExchangeRate] = useState(
    editingQuote?.exchangeRate ? String(editingQuote.exchangeRate) : requisition.quoteExchangeRate > 0 ? String(requisition.quoteExchangeRate) : "",
  );
  const [bulkRestrictions, setBulkRestrictions] = useState<string[]>([]);
  const [quoteDate, setQuoteDate] = useState(editingQuote?.quoteDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState(editingQuote?.paymentTerms || "");
  const [deliveryTerms, setDeliveryTerms] = useState(editingQuote?.deliveryTerms || "");
  const [taxRate, setTaxRate] = useState(editingQuote ? String(editingQuote.taxRate * 100) : "16");
  const [documentSubtotal, setDocumentSubtotal] = useState(editingQuote ? String(editingQuote.subtotal) : "");
  const [documentDiscount, setDocumentDiscount] = useState(editingQuote ? String(editingQuote.discount) : "");
  const [documentFreight, setDocumentFreight] = useState(editingQuote ? String(editingQuote.freight) : "");
  const [documentOtherCharges, setDocumentOtherCharges] = useState(editingQuote ? String(editingQuote.otherCharges) : "");
  const [documentTax, setDocumentTax] = useState(editingQuote ? String(editingQuote.tax) : "");
  const [documentTotal, setDocumentTotal] = useState(editingQuote ? String(editingQuote.total) : "");
  const [taxIncluded, setTaxIncluded] = useState(editingQuote?.taxIncluded || false);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extraction, setExtraction] = useState<SupplierQuoteExtractionResult | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierInitialValues, setSupplierInitialValues] = useState<Partial<SaveSupplierInput> | undefined>();
  const [detectedSupplier, setDetectedSupplier] = useState<ExtractedSupplierData | null>(null);
  const [suggestingItemId, setSuggestingItemId] = useState<string | null>(null);
  const [suggestingBatch, setSuggestingBatch] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const selectedItems = useMemo(() => requisition.items.filter((item) => selectedIds.has(item.id)), [requisition.items, selectedIds]);
  const supplierOptions = suppliers.data || [];
  const allSelected = selectedIds.size === requisition.items.length;
  const selectedTableItems = selectedItems.map(tableItem);
  const selectedQuoteItemIds = new Set(selectedItems.flatMap((item) => item.quoteClientItemId ? [item.quoteClientItemId] : []));
  const selectedOfferIds = new Set(selectedItems.flatMap((item) => item.offers.map((offer) => offer.id)));
  const supplierQuoteFiles = (attachments.data || []).filter((attachment) =>
    (attachment.category === "SELLER_SUPPLIER_QUOTE" && attachment.clientItemIds.some((id) => selectedQuoteItemIds.has(id)))
    || (attachment.category === "PURCHASE_SUPPLIER_PROPOSAL" && attachment.purchaseOfferIds.some((id) => selectedOfferIds.has(id))),
  );
  const originOptions = (restrictions.data || []).filter((option) => option.code !== "NO_RESTRICTION");
  const busy = saving || extracting || suggestingBatch || suggestingItemId !== null;

  const clearDerivedTotals = () => {
    if (!editingSupplierQuoteId) return;
    setDocumentSubtotal("");
    setDocumentTax("");
    setDocumentTotal("");
  };

  const updateRow = (id: string, patch: Partial<BulkProcurementItemForm>) => {
    if (patch.unitCost !== undefined || patch.currency !== undefined) clearDerivedTotals();
    setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };
  const toggle = (id: string) => setSelectedIds((current) => {
    if (editingItemIds.has(id)) return current;
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const applyBulkCurrency = () => {
    if (!bulkCurrency) return notifier.warning("Selecciona la moneda que se aplicará a todas las partidas.");
    clearDerivedTotals();
    setRows((current) => Object.fromEntries(requisition.items.map((item) => [item.id,
      selectedIds.has(item.id) ? { ...current[item.id], currency: bulkCurrency, exchangeRate: current[item.id].exchangeRate || String(requisition.quoteExchangeRate || "") } : current[item.id],
    ])));
    notifier.success(`Moneda ${bulkCurrency} aplicada a ${selectedItems.length} partida(s).`);
  };

  const applyBulkRestrictions = () => {
    setRows((current) => Object.fromEntries(requisition.items.map((item) => [item.id,
      selectedIds.has(item.id) ? { ...current[item.id], originRestrictions: [...bulkRestrictions] } : current[item.id],
    ])));
    notifier.success(`Restricciones aplicadas a ${selectedItems.length} partida(s).`);
  };

  const suggestTechnical = async (itemId: string) => {
    const item = requisition.items.find((entry) => entry.id === itemId);
    const row = rows[itemId];
    if (!item || !row) return;
    setSuggestingItemId(itemId);
    try {
      const suggestion = await TechnicalDataService.suggest({
        requestedDescription: item.erpDescription || item.customerDescription || item.description,
        supplierDescription: row.supplierDescription.trim() || undefined,
        existingAttributes: row.technicalAttributes,
      });
      const attributes = Object.fromEntries(suggestion.attributes.map((entry) => [entry.key, entry.value]));
      updateRow(itemId, {
        technicalFamily: suggestion.family,
        technicalAttributes: { ...row.technicalAttributes, ...attributes },
        standard: attributes.STANDARD || row.standard,
        diameter: attributes.NOMINAL_DIAMETER || row.diameter,
        thickness: attributes.THICKNESS || attributes.SCHEDULE || row.thickness,
        bore: attributes.BORE || row.bore,
        technicalRequiresReview: suggestion.confidence < 0.75 || suggestion.attributes.some((entry) => entry.confidence < 0.65),
      });
      notifier.success("Datos técnicos sugeridos. Revisa y confirma la ficha de la partida.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudieron sugerir los datos técnicos.");
    } finally {
      setSuggestingItemId(null);
    }
  };

  const suggestTechnicalBatch = async () => {
    if (selectedItems.length === 0) return notifier.warning("Selecciona al menos una partida.");
    if (selectedItems.length > 50) return notifier.warning("La IA puede analizar hasta 50 partidas por lote.");
    setSuggestingBatch(true);
    try {
      const suggestions = await TechnicalDataService.suggestBatch(selectedItems.map((item) => ({
        itemId: item.id,
        requestedDescription: item.erpDescription || item.customerDescription || item.description,
        supplierDescription: rows[item.id].supplierDescription.trim() || undefined,
        existingAttributes: rows[item.id].technicalAttributes,
      })));
      const byId = new Map(suggestions.map((entry) => [entry.itemId, entry]));
      setRows((current) => Object.fromEntries(requisition.items.map((item) => {
        const row = current[item.id];
        const suggestion = byId.get(item.id);
        if (!suggestion) return [item.id, row];
        const attributes = Object.fromEntries(suggestion.attributes.map((entry) => [entry.key, entry.value]));
        return [item.id, {
          ...row,
          technicalFamily: suggestion.family,
          technicalAttributes: { ...row.technicalAttributes, ...attributes },
          standard: attributes.STANDARD || row.standard,
          diameter: attributes.NOMINAL_DIAMETER || row.diameter,
          thickness: attributes.THICKNESS || attributes.SCHEDULE || row.thickness,
          bore: attributes.BORE || row.bore,
          technicalRequiresReview: suggestion.confidence < 0.75 || suggestion.attributes.some((entry) => entry.confidence < 0.65),
        }];
      })));
      if (suggestions.length < selectedItems.length) notifier.warning(`IA completó ${suggestions.length} partida(s); las demás requieren captura manual.`);
      else notifier.success(`IA completó datos técnicos para ${suggestions.length} partida(s). Revisa cada resultado.`);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudieron sugerir los datos técnicos por lote.");
    } finally {
      setSuggestingBatch(false);
    }
  };

  const downloadAttachment = async (attachment: FileAttachment) => {
    setBusyAttachmentId(attachment.id);
    try {
      await AttachmentsService.download(attachment);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const extractExistingAttachment = async (attachment: FileAttachment) => {
    setBusyAttachmentId(attachment.id);
    try {
      const blob = await AttachmentsService.getBlob(attachment);
      const existingFile = new File([blob], attachment.originalName, { type: attachment.mimeType });
      setFile(existingFile);
      setAttachmentsOpen(false);
      await extract(existingFile);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo leer la cotización adjunta.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const extract = async (attachment: File) => {
    if (selectedItems.length === 0) return notifier.warning("Selecciona al menos una partida antes de extraer.");
    setExtracting(true);
    setExtractionProgress(0);
    const toast = notifier.loading("Extrayendo cotización del proveedor...");
    try {
      const result = await SupplierQuoteExtractionService.extract(attachment, setExtractionProgress);
      setExtraction(result);
      if (toast !== undefined) notifier.update(toast, "success", "Extracción lista. Revisa el mapeo de partidas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo analizar el archivo.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    } finally {
      setExtracting(false);
    }
  };

  const applyExtraction = (mappings: SupplierQuoteBulkMapping[]) => {
    if (!extraction) return;
    if (editingSupplierQuoteId && (extraction.supplier.name || extraction.supplier.taxId)) {
      const matched = findDetectedSupplierMatch(extraction.supplier, supplierOptions);
      if (matched && matched.id !== fixedSupplierId) {
        return notifier.warning("El archivo corresponde a otro proveedor. Registra sus partidas en una referencia separada.");
      }
      const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const currentName = editingOffers[0]?.offer.supplier.name || "";
      if (!matched && extraction.supplier.name && currentName && normalized(extraction.supplier.name) !== normalized(currentName)) {
        return notifier.warning("No se pudo confirmar que el archivo sea del proveedor de esta referencia. Revísalo y captura sus datos manualmente, o crea otra referencia.");
      }
    }
    const mappedIds = new Set(mappings.map((mapping) => mapping.systemItemId));
    setSelectedIds(editingSupplierQuoteId ? new Set([...editingItemIds, ...mappedIds]) : mappedIds);
    setBulkCurrency(extraction.header.currency || "");
    setRows((current) => {
      const next = { ...current };
      for (const { systemItemId, extractedItemIndex } of mappings) {
        const extracted = extraction.items[extractedItemIndex];
        if (!extracted || !next[systemItemId]) continue;
        next[systemItemId] = {
          ...next[systemItemId],
          supplierProductCode: extracted.supplierProductCode || next[systemItemId].supplierProductCode,
          supplierDescription: extracted.description.toUpperCase(),
          unitCost: extracted.netUnitPrice === null ? next[systemItemId].unitCost : String(extracted.netUnitPrice),
          currency: extraction.header.currency || next[systemItemId].currency,
          exchangeRate: next[systemItemId].exchangeRate,
          brand: extracted.brand || next[systemItemId].brand,
          origin: extracted.origin || next[systemItemId].origin,
          deliveryTime: extracted.deliveryTime || next[systemItemId].deliveryTime,
          validUntil: extraction.header.validUntil || next[systemItemId].validUntil,
          externalReference: extraction.header.reference || next[systemItemId].externalReference,
        };
      }
      return next;
    });
    setQuoteDate(extraction.header.quoteDate || quoteDate);
    setPaymentTerms(extraction.header.paymentTerms || paymentTerms);
    setDeliveryTerms(extraction.header.deliveryTerms || deliveryTerms);
    setTaxRate(extraction.totals.taxRate === null ? taxRate : String(extraction.totals.taxRate > 1 ? extraction.totals.taxRate : extraction.totals.taxRate * 100));
    setDocumentSubtotal(extraction.totals.subtotal === null ? "" : String(extraction.totals.subtotal));
    setDocumentDiscount(extraction.totals.discount === null ? "" : String(extraction.totals.discount));
    setDocumentFreight(extraction.totals.freight === null ? "" : String(extraction.totals.freight));
    setDocumentOtherCharges(extraction.totals.otherCharges === null ? "" : String(extraction.totals.otherCharges));
    setDocumentTax(extraction.totals.tax === null ? "" : String(extraction.totals.tax));
    setDocumentTotal(extraction.totals.total === null ? "" : String(extraction.totals.total));
    setTaxIncluded(extraction.totals.taxIncluded === true);
    if (!editingSupplierQuoteId && (extraction.supplier.name || extraction.supplier.taxId)) {
      setSupplierId("");
      setDetectedSupplier(extraction.supplier);
    }
    setExtraction(null);
    notifier.success(`${mappings.length} partida(s) cargadas. Revisa costos, datos técnicos y proveedor antes de guardar.`);
  };

  const save = async () => {
    if (selectedItems.length === 0) return notifier.warning("Selecciona al menos una partida.");
    if (editingSupplierQuoteId && editingOffers.length === 0) return notifier.error("La referencia del proveedor ya no está disponible.");
    if (!supplierId) return notifier.warning("Selecciona un proveedor para el lote.");
    if (!deliveryState) return notifier.warning("Selecciona el estado de entrega.");
    const rate = Number(taxRate) / 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) return notifier.warning("La tasa de IVA debe estar entre 0 y 100%.");
    const totals = [documentSubtotal, documentDiscount, documentFreight, documentOtherCharges, documentTax, documentTotal];
    if (totals.some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0))) return notifier.warning("Revisa los totales del documento; no pueden ser negativos.");
    const currencies = new Set(selectedItems.map((item) => rows[item.id].currency));
    if (currencies.size !== 1) return notifier.warning("Una cotización del proveedor debe tener una sola moneda. Usa «Moneda general» o separa las partidas en otro lote.");
    const offers: SaveOffersBatchInput["offers"] = [];
    for (const item of selectedItems) {
      const row = rows[item.id];
      const unitCost = Number(row.unitCost);
      if (!row.unitCost.trim() || !Number.isFinite(unitCost) || unitCost <= 0) {
        return notifier.warning(`Captura un costo mayor a cero para la partida #${item.position}.`);
      }
      if (!row.originRestrictions.length) return notifier.warning(`Selecciona una restricción o Sin restricción para la partida #${item.position}.`);
      if (row.currency !== "MXN" && row.currency !== "USD") return notifier.warning(`Selecciona la moneda para la partida #${item.position}.`);
      if (row.currency === "USD" && (!globalExchangeRate.trim() || !Number.isFinite(Number(globalExchangeRate)) || Number(globalExchangeRate) <= 0)) return notifier.warning("Captura un tipo de cambio global válido para las partidas en USD.");
      if (!row.origin.trim()) return notifier.warning(`Selecciona el origen para la partida #${item.position}.`);
      if (!row.deliveryTime.trim()) return notifier.warning(`Captura el plazo de entrega para la partida #${item.position}.`);
      if (row.technicalRequiresReview) return notifier.warning(`Revisa y confirma los datos técnicos sugeridos para la partida #${item.position}.`);
      const originalTechnical = {
        standard: item.standard || "", diameter: item.diameter || "", thickness: item.thickness || "", bore: item.bore || "",
        technicalFamily: item.technicalFamily || "OTHER", technicalAttributes: item.technicalAttributes || {},
        originRestrictions: item.originRestrictions || [],
      };
      const itemDetails = {
        standard: row.standard, diameter: row.diameter, thickness: row.thickness, bore: row.bore,
        technicalFamily: row.technicalFamily, technicalAttributes: row.technicalAttributes,
        originRestrictions: row.originRestrictions,
      };
      offers.push({
        itemId: item.id, supplierId, qty: item.qty, unitCost, unit: item.unit,
        ...(editingSupplierQuoteId && existingByItemId.has(item.id) ? { offerId: existingByItemId.get(item.id)!.id } : {}),
        itemDetails: JSON.stringify(itemDetails) === JSON.stringify(originalTechnical) ? undefined : itemDetails,
        supplierProductCode: row.supplierProductCode.trim() || null,
        supplierDescription: row.supplierDescription.trim() || null,
        currency: row.currency, exchangeRate: row.currency === "USD" ? Number(globalExchangeRate) : null,
        taxRate: rate, brand: row.brand.trim() || null, origin: row.origin.trim() || null,
        deliveryTime: row.deliveryTime.trim() || null,
        quoteDate, validUntil: row.validUntil || null,
        externalReference: row.externalReference.trim() || null,
        paymentTerms: paymentTerms.trim() || null,
        deliveryTerms: deliveryTerms.trim() || null,
        documentSubtotal: documentSubtotal === "" ? null : Number(documentSubtotal),
        documentDiscount: documentDiscount === "" ? 0 : Number(documentDiscount),
        documentFreight: documentFreight === "" ? 0 : Number(documentFreight),
        documentOtherCharges: documentOtherCharges === "" ? 0 : Number(documentOtherCharges),
        documentTax: documentTax === "" ? null : Number(documentTax),
        documentTotal: documentTotal === "" ? null : Number(documentTotal),
        taxIncluded,
        notes: row.notes.trim() || null,
      });
    }
    setSaving(true);
    const toast = notifier.loading(editingSupplierQuoteId ? "Actualizando referencia del proveedor..." : "Guardando propuestas del lote...");
    try {
      const result = editingSupplierQuoteId
        ? await updateOffersBatch.mutateAsync({ id: requisition.id, supplierQuoteId: editingSupplierQuoteId, input: { offers, deliveryState } })
        : await createOffersBatch.mutateAsync({ id: requisition.id, input: { offers, deliveryState } });
      if (file) {
        try {
          await AttachmentsService.uploadPurchaseOffer(requisition.id, result.offerIds, file);
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo adjuntar el archivo.";
          if (toast !== undefined) notifier.update(toast, "warning", `Propuestas guardadas, pero falló el archivo: ${message}. Usa «Adjuntar a propuestas» para reintentar.`);
          else notifier.warning(`Propuestas guardadas, pero falló el archivo: ${message}. Usa «Adjuntar a propuestas» para reintentar.`);
          onSaved();
          onClose();
          return;
        }
      }
      const message = editingSupplierQuoteId
        ? `${offers.length} partida(s) actualizadas en la referencia del proveedor.`
        : `${offers.length} propuestas registradas. Selecciona las ofertas ganadoras para completar la requisición.`;
      if (toast !== undefined) notifier.update(toast, "success", message);
      else notifier.success(message);
      onSaved();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el lote.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (stage === "SELECT") return <Dialog open onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>Seleccionar partidas para el proveedor</DialogTitle>
    <DialogContent dividers>
      <p className="mb-3 text-xs text-slate-600">{editingSupplierQuoteId ? "Las partidas existentes se conservan. Puedes agregar otras del mismo proveedor; para otro proveedor crea una referencia distinta." : "Elige todas o solo las partidas de la misma cotización. Las propuestas anteriores se conservarán."}</p>
      <label className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">
        <Checkbox size="small" checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} onChange={() => setSelectedIds(allSelected ? new Set(editingItemIds) : new Set(requisition.items.map((item) => item.id)))} />Seleccionar todas
        <span className="ml-auto text-slate-500">{selectedIds.size} de {requisition.items.length}</span>
      </label>
      <div className="max-h-[55vh] space-y-2 overflow-y-auto">{requisition.items.map((item) => <label key={item.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${selectedIds.has(item.id) ? "border-amber-300 bg-amber-50" : "border-slate-200 hover:bg-slate-50"}`}>
        <Checkbox size="small" checked={selectedIds.has(item.id)} disabled={editingItemIds.has(item.id)} onChange={() => toggle(item.id)} />
        <span className="min-w-0 flex-1 text-xs"><span className="block font-semibold">#{item.position} · {item.erpCode || item.erpEan || "Alta ERP pendiente"} · {item.qty} {item.unit}</span><span className="mt-1 block text-slate-600">{item.customerDescription || item.description}</span>{editingItemIds.has(item.id) ? <span className="mt-1 block text-blue-700">Ya pertenece a esta referencia.</span> : item.offers.length > 0 && <span className="mt-1 block text-amber-800">Tiene {item.offers.length} propuesta(s); la nueva se agregará sin sustituirlas.</span>}</span>
      </label>)}</div>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" disabled={selectedIds.size === 0} onClick={() => setStage("CAPTURE")}>Pasar {selectedIds.size} partida(s) a la tabla</Button></DialogActions>
  </Dialog>;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { maxWidth: "min(1500px, 96vw)", maxHeight: "94vh" } }}>
      <DialogTitle sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1, fontSize: 16 }}>
        <span>{editingSupplierQuoteId ? "Editar referencia de un proveedor" : "Referencia de un proveedor"} · {selectedItems.length} partida(s) <span className="text-xs font-normal text-slate-500">{requisition.requisitionNumber}</span></span>
        <span className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp" className="sr-only" aria-label="Seleccionar cotización del proveedor" onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!selected) return;
            setFile(selected);
            setExtraction(null);
            if (/\.(pdf|xlsx?)$/i.test(selected.name)) void extract(selected);
            else notifier.warning("El archivo quedó adjunto. La extracción con IA solo admite PDF, XLS y XLSX.");
          }} />
          <Button size="small" variant="outlined" onClick={() => setStage("SELECT")} disabled={busy} sx={{ fontSize: 11, textTransform: "none" }}>Cambiar selección</Button>
          <Button size="small" variant="contained" startIcon={<Sparkles size={14} />} onClick={() => fileInputRef.current?.click()} disabled={busy} sx={{ fontSize: 11, textTransform: "none" }}>{extracting ? `Extrayendo ${extractionProgress}%` : "Extraer cotización con IA"}</Button>
          <Button size="small" variant="outlined" startIcon={<FolderOpen size={14} />} onClick={() => setAttachmentsOpen(true)} sx={{ fontSize: 11, textTransform: "none" }}>Ver cotizaciones del proveedor</Button>
        </span>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: "74vh" }}>
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-800">Proveedor y documento</h3>{!editingSupplierQuoteId && <Button size="small" variant="outlined" startIcon={<Plus size={14} />} onClick={() => { setSupplierInitialValues(undefined); setSupplierModalOpen(true); }} sx={{ fontSize: 11, textTransform: "none" }}>Nuevo proveedor</Button>}</div>
          <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField select size="small" required label="Proveedor" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={busy || Boolean(editingSupplierQuoteId)} helperText={editingSupplierQuoteId ? "Para otro proveedor, crea una referencia separada." : undefined} sx={{ ...compactFieldSx, minWidth: 0 }}>
              <MenuItem value="">Seleccionar proveedor</MenuItem>
              {editingSupplierQuoteId && supplierId && !supplierOptions.some((supplier) => supplier.id === supplierId && supplier.isActive) && <MenuItem value={supplierId}>{editingOffers[0]?.offer.supplier.name || "Proveedor actual"}</MenuItem>}
              {supplierOptions.filter((supplier) => supplier.isActive).map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" required label="Estado de entrega" value={deliveryState} onChange={(event) => setDeliveryState(event.target.value)} sx={compactFieldSx}><MenuItem value="">Seleccionar estado</MenuItem>{(deliveryStates.data || []).map((option) => <MenuItem key={option.id} value={optionValue(option)}>{option.label}</MenuItem>)}</TextField>
            <TextField size="small" label="No. cotización proveedor" value={selectedItems.every((item) => rows[item.id].externalReference === rows[selectedItems[0].id].externalReference) ? rows[selectedItems[0].id].externalReference : ""} onChange={(event) => selectedItems.forEach((item) => updateRow(item.id, { externalReference: event.target.value }))} sx={compactFieldSx} />
            <TextField size="small" type="date" label="Vigencia" InputLabelProps={{ shrink: true }} value={selectedItems.every((item) => rows[item.id].validUntil === rows[selectedItems[0].id].validUntil) ? rows[selectedItems[0].id].validUntil : ""} onChange={(event) => selectedItems.forEach((item) => updateRow(item.id, { validUntil: event.target.value }))} sx={compactFieldSx} />
            <div className="flex min-w-0 flex-wrap items-center gap-2"><SupplierRestrictionSelect id="buyer-supplier-restrictions-all" label="Restricción general" value={bulkRestrictions} options={restrictions.data || []} onChange={setBulkRestrictions} /><Button size="small" variant="outlined" onClick={applyBulkRestrictions} disabled={busy} sx={{ fontSize: 10, textTransform: "none" }}>Aplicar</Button></div>
            <div className="flex min-w-0 flex-wrap items-center gap-2"><TextField select size="small" label="Moneda general" value={bulkCurrency} onChange={(event) => setBulkCurrency(event.target.value as Currency | "")} sx={{ ...compactFieldSx, minWidth: 135 }}><MenuItem value="">Seleccionar</MenuItem><MenuItem value="MXN">MXN</MenuItem><MenuItem value="USD">USD</MenuItem></TextField><Button size="small" variant="outlined" onClick={applyBulkCurrency} disabled={busy || !bulkCurrency} sx={{ fontSize: 10, textTransform: "none" }}>Aplicar</Button></div>
            {(bulkCurrency === "USD" || selectedItems.some((item) => rows[item.id].currency === "USD")) && (
              <TextField size="small" type="number" label="Tipo de cambio global (USD)" value={globalExchangeRate} onChange={(event) => setGlobalExchangeRate(event.target.value)} helperText="Se aplica a todas las partidas en USD" inputProps={{ min: 0, step: "any" }} sx={compactFieldSx} />
            )}
            <TextField size="small" type="date" label="Fecha cotización" InputLabelProps={{ shrink: true }} value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} sx={compactFieldSx} />
            <TextField size="small" type="number" label="IVA (%)" inputProps={{ min: 0, max: 100, step: "0.01" }} value={taxRate} onChange={(event) => { clearDerivedTotals(); setTaxRate(event.target.value); }} sx={compactFieldSx} />
            <TextField size="small" label="Condiciones de pago" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} sx={compactFieldSx} />
            <TextField size="small" label="Condiciones de entrega" value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} sx={compactFieldSx} />
          </div>
        </section>
        {file && <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-slate-700"><Paperclip size={14} /><span className="min-w-0 flex-1 truncate">Archivo para adjuntar: {file.name}</span><Button size="small" onClick={() => setFile(null)} sx={{ fontSize: 10 }}>Quitar</Button></div>}
        <details className="mt-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold">Totales y cargos del documento del proveedor</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["Subtotal", documentSubtotal, setDocumentSubtotal],
              ["Descuento", documentDiscount, setDocumentDiscount],
              ["Flete", documentFreight, setDocumentFreight],
              ["Otros cargos", documentOtherCharges, setDocumentOtherCharges],
              ["IVA", documentTax, setDocumentTax],
              ["Total", documentTotal, setDocumentTotal],
            ] as const).map(([label, value, setter]) => <TextField key={label} size="small" type="number" label={label} value={value} onChange={(event) => { if (label === "Descuento" || label === "Flete" || label === "Otros cargos") { setDocumentTax(""); setDocumentTotal(""); } setter(event.target.value); }} inputProps={{ min: 0, step: "0.0001" }} />)}
            <label className="flex items-center gap-2"><Checkbox size="small" checked={taxIncluded} onChange={(event) => { setDocumentTax(""); setDocumentTotal(""); setTaxIncluded(event.target.checked); }} />IVA incluido</label>
          </div>
        </details>
        <section className="mt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-xs font-semibold text-slate-900">Material cotizado por este proveedor</h3><p className="text-[10px] text-slate-500">{selectedItems.length} partida(s). Cada fila conserva su costo, restricciones y datos técnicos.</p></div>
            <Button size="small" variant="outlined" disabled={busy} startIcon={<Sparkles size={14} />} onClick={() => void suggestTechnicalBatch()} sx={{ fontSize: 10, textTransform: "none" }}>{suggestingBatch ? "Completando..." : "Completar datos técnicos de todas con IA"}</Button>
          </div>
          <SupplierBulkReferenceTable
            items={selectedTableItems}
            forms={rows}
            brands={brands.data || []}
            origins={originOptions}
            deliveryTimes={deliveryTimes.data || []}
            restrictions={restrictions.data || []}
            suggestingItemId={suggestingItemId}
            busy={busy}
            onSuggest={(itemId) => { void suggestTechnical(itemId); }}
            onChange={updateRow}
          />
        </section>
        <TextField size="small" multiline minRows={2} fullWidth label="Notas y condiciones del proveedor" value={selectedItems.length > 0 && selectedItems.every((item) => rows[item.id].notes === rows[selectedItems[0].id].notes) ? rows[selectedItems[0].id].notes : ""} onChange={(event) => selectedItems.forEach((item) => updateRow(item.id, { notes: event.target.value }))} sx={{ ...compactFieldSx, mt: 2 }} />
        {(suppliers.isLoading || brands.isLoading || restrictions.isLoading || deliveryStates.isLoading || deliveryTimes.isLoading) && <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Cargando proveedores y catálogos...</p>}
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><FileSearch size={13} />Puedes registrar el lote sin archivo y adjuntarlo después desde «Adjuntar a propuestas».</p>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving || extracting}>Cancelar</Button><Button variant="contained" disabled={saving || extracting || selectedIds.size === 0} onClick={() => void save()}>{saving ? "Guardando..." : editingSupplierQuoteId ? "Guardar cambios" : `Guardar ${selectedIds.size} propuesta(s)`}</Button></DialogActions>
      <Dialog open={attachmentsOpen} onClose={() => setAttachmentsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>Cotizaciones del proveedor</DialogTitle>
        <DialogContent dividers>
          <AttachmentsPanel files={supplierQuoteFiles} loading={attachments.isLoading} title="Cotizaciones ligadas a estas partidas" busyFileId={busyAttachmentId} onPreview={setPreviewFile} onDownload={(attachment) => { void downloadAttachment(attachment); }} />
          {supplierQuoteFiles.filter((attachment) => /\.(pdf|xlsx?)$/i.test(attachment.originalName)).map((attachment) => <div key={attachment.id} className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="truncate">{attachment.originalName}</span><Button size="small" disabled={busyAttachmentId === attachment.id || extracting} onClick={() => void extractExistingAttachment(attachment)}>Usar para extracción con IA</Button></div>)}
        </DialogContent>
        <DialogActions><Button size="small" onClick={() => setAttachmentsOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>
      {previewFile && <PdfAttachmentViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {extraction && <SupplierQuoteBulkExtractionReviewModal result={extraction} items={selectedItems.map(mappingItem)} onApply={applyExtraction} onClose={() => setExtraction(null)} />}
      {detectedSupplier && <DetectedSupplierModal detected={detectedSupplier} matchedSupplier={findDetectedSupplierMatch(detectedSupplier, supplierOptions)} onUseMatched={(supplier) => { setSupplierId(supplier.id); setDetectedSupplier(null); }} onCreate={(initialValues) => { setDetectedSupplier(null); setSupplierInitialValues(initialValues); setSupplierModalOpen(true); }} onChooseOther={() => { setDetectedSupplier(null); setSupplierInitialValues(undefined); setSupplierModalOpen(true); }} onClose={() => setDetectedSupplier(null)} />}
      {supplierModalOpen && <SelectOrCreateSupplierModal initialValues={supplierInitialValues} initialMode={supplierInitialValues ? "LOCAL" : "ERP"} onClose={() => { setSupplierModalOpen(false); setSupplierInitialValues(undefined); }} onSelect={(supplier) => { setSupplierId(supplier.id); setSupplierModalOpen(false); setSupplierInitialValues(undefined); }} />}
    </Dialog>
  );
};
