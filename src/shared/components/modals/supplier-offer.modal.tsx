import { AttachFileOutlined, AutoAwesomeOutlined, FolderOpenOutlined } from "@mui/icons-material";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from "@mui/material";
import { Loader2, PackageSearch, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { PurchaseRequisition, RequisitionItem, Supplier } from "../../../modules/procurement/services/purchase-requisitions.service";
import { SupplierQuoteExtractionService, type ExtractedSupplierData, type ExtractedSupplierQuoteItem, type SupplierQuoteExtractionResult } from "../../../modules/procurement/services/supplier-quote-extraction.service";
import type { SaveSupplierInput } from "../../../modules/procurement/services/purchase-requisitions.service";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import { notifier } from "../../notifications/notifier";
import { SupplierQuoteExtractionReviewModal } from "./supplier-quote-extraction-review.modal";
import { DetectedSupplierModal, findDetectedSupplierMatch } from "./detected-supplier.modal";
import { PurchasingSupplierOfferFields } from "./purchasing-supplier-offer-fields";
import { SellerSupplierReferenceFields } from "./seller-supplier-reference-fields";
import type { ManualQuoteItem } from "../../../store/quote/manual-quote.store";
import type { TechnicalDataFormValue } from "../procurement/technical-data-editor";

export type SupplierOfferMode = "SELLER" | "PURCHASING";
export type SupplierOfferCurrency = "MXN" | "USD";

export interface SupplierOfferFormValue {
  supplierId: string;
  supplierName: string;
  supplierDescription: string;
  qty: string;
  unitCost: string;
  currency: SupplierOfferCurrency;
  exchangeRate: string;
  brand: string;
  origin: string;
  deliveryTime: string;
  validUntil: string;
  externalReference: string;
  notes: string;
  quoteDate?: string;
  supplierProductCode?: string;
  alternateCodes?: string[];
  unit?: string;
  listUnitPrice?: number | null;
  discountPct?: number | null;
  availableDate?: string;
  minimumQty?: number | null;
  paymentTerms?: string;
  deliveryTerms?: string;
  documentSubtotal?: number | null;
  documentDiscount?: number;
  documentFreight?: number;
  documentOtherCharges?: number;
  taxIncluded?: boolean;
  documentTaxRate?: number | null;
  documentTax?: number | null;
  documentTotal?: number | null;
}

interface SupplierOfferModalProps {
  mode: SupplierOfferMode;
  purchasingContext?: { requisition: PurchaseRequisition; item: RequisitionItem };
  sellerContext?: {
    item: ManualQuoteItem;
    deliveryState: string;
    deliveryStates: QuoteCatalogOption[];
    onDeliveryStateChange: (value: string) => void;
  };
  technical: TechnicalDataFormValue;
  onTechnicalChange: (value: TechnicalDataFormValue) => void;
  onSuggestTechnical: () => void;
  suggestingTechnical: boolean;
  restrictions: string[];
  restrictionOptions: QuoteCatalogOption[];
  onRestrictionsChange: (value: string[]) => void;
  itemDescription: string;
  value: SupplierOfferFormValue;
  onChange: (value: SupplierOfferFormValue) => void;
  suppliers: Supplier[];
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  quantityReadOnly?: boolean;
  busy: boolean;
  attachmentFile: File | null;
  onAttachmentFile: (file: File | null) => void;
  onNewSupplier: (initialValues?: Partial<SaveSupplierInput>) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  loadingMessage?: string;
  children?: ReactNode;
  existingAttachments?: ReactNode;
}

export const SupplierOfferModal = ({
  mode,
  purchasingContext,
  sellerContext,
  technical,
  onTechnicalChange,
  onSuggestTechnical,
  suggestingTechnical,
  restrictions,
  restrictionOptions,
  onRestrictionsChange,
  itemDescription,
  value,
  onChange,
  suppliers,
  brands,
  origins,
  deliveryTimes,
  quantityReadOnly = false,
  busy,
  attachmentFile,
  onAttachmentFile,
  onNewSupplier,
  onClose,
  onSubmit,
  loadingMessage,
  children,
  existingAttachments,
}: SupplierOfferModalProps) => {
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extraction, setExtraction] = useState<SupplierQuoteExtractionResult | null>(null);
  const [detectedSupplier, setDetectedSupplier] = useState<ExtractedSupplierData | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const title = mode === "SELLER" ? "Agregar referencia de proveedor" : "Cotización de proveedor";
  const eyebrow = mode === "SELLER" ? "Información opcional para Compras" : "Propuesta de Compras";
  const submitLabel = mode === "SELLER" ? "Guardar referencia" : "Registrar propuesta de Compras";
  const modalBusy = busy || extracting;
  if ((mode === "PURCHASING" && !purchasingContext) || (mode === "SELLER" && !sellerContext)) {
    throw new Error("El contexto de la partida es obligatorio para capturar la referencia del proveedor.");
  }

  const extractSupplierQuote = async (file: File) => {
    setExtracting(true);
    setExtractionProgress(0);
    try {
      const result = await SupplierQuoteExtractionService.extract(file, setExtractionProgress);
      setExtraction(result);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo extraer la cotización del proveedor.");
    } finally {
      setExtracting(false);
    }
  };

  const chooseQuoteFile = (file: File | null) => {
    if (!file) return;
    onAttachmentFile(file);
    if (/\.(pdf|xlsx?)$/i.test(file.name)) void extractSupplierQuote(file);
    else notifier.warning("El archivo quedó adjunto. La extracción con IA solo admite PDF, XLS y XLSX.");
  };

  const applyExtraction = (item: ExtractedSupplierQuoteItem) => {
    if (!extraction) return;
    const detectedSupplier = Boolean(extraction.supplier.name || extraction.supplier.taxId);
    onChange({
      ...value,
      supplierId: detectedSupplier ? "" : value.supplierId,
      supplierName: detectedSupplier ? "" : value.supplierName,
      supplierDescription: item.description.toUpperCase(),
      qty: quantityReadOnly ? value.qty : item.quantity === null ? value.qty : String(item.quantity),
      unitCost: item.netUnitPrice === null ? value.unitCost : String(item.netUnitPrice),
      currency: extraction.header.currency || value.currency,
      exchangeRate: extraction.header.exchangeRate === null ? value.exchangeRate : String(extraction.header.exchangeRate),
      brand: item.brand || value.brand,
      origin: item.origin || value.origin,
      deliveryTime: item.deliveryTime || value.deliveryTime,
      validUntil: extraction.header.validUntil || value.validUntil,
      externalReference: extraction.header.reference || value.externalReference,
      notes: value.notes || extraction.header.deliveryTerms || "",
      quoteDate: extraction.header.quoteDate || undefined,
      supplierProductCode: item.supplierProductCode || undefined,
      alternateCodes: item.alternateCodes,
      unit: item.unit || undefined,
      listUnitPrice: item.listUnitPrice,
      discountPct: item.discountPct,
      availableDate: item.availableDate || undefined,
      minimumQty: item.minimumQuantity,
      paymentTerms: extraction.header.paymentTerms || undefined,
      deliveryTerms: extraction.header.deliveryTerms || undefined,
      documentSubtotal: extraction.totals.subtotal,
      documentDiscount: extraction.totals.discount || 0,
      documentFreight: extraction.totals.freight || 0,
      documentOtherCharges: extraction.totals.otherCharges || 0,
      taxIncluded: extraction.totals.taxIncluded === true,
      documentTaxRate: extraction.totals.taxRate,
      documentTax: extraction.totals.tax,
      documentTotal: extraction.totals.total,
    });
    if (detectedSupplier) setDetectedSupplier(extraction.supplier);
    setExtraction(null);
    notifier.success("Datos extraídos aplicados. Revisa la propuesta y confirma el proveedor.");
  };

  return (
    <>
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="supplier-offer-title">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${purchasingContext || sellerContext ? "max-w-[min(1500px,96vw)]" : "max-w-4xl"}`}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 gap-3">
            <span className="shrink-0 rounded-xl bg-amber-100 p-2 text-amber-700"><PackageSearch className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">{eyebrow}</p>
              <h2 id="supplier-offer-title" className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{itemDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp" className="sr-only" aria-label="Seleccionar cotización del proveedor" onChange={(event) => { chooseQuoteFile(event.currentTarget.files?.[0] || null); event.currentTarget.value = ""; }} />
            <Button type="button" size="small" variant="contained" disabled={modalBusy} startIcon={extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AutoAwesomeOutlined fontSize="small" />} onClick={() => fileInputRef.current?.click()} sx={{ fontSize: 11, textTransform: "none" }}>{extracting ? `Extrayendo ${extractionProgress}%` : "Extraer cotización con IA"}</Button>
            <Button type="button" size="small" variant="outlined" startIcon={<FolderOpenOutlined fontSize="small" />} onClick={() => setAttachmentsOpen(true)} sx={{ fontSize: 11, textTransform: "none" }}>Ver cotizaciones del proveedor</Button>
            <IconButton type="button" disabled={modalBusy} onClick={onClose} size="small" aria-label="Cerrar"><X className="h-4 w-4" /></IconButton>
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto px-4 py-3">
            {mode === "PURCHASING" ? (
              <PurchasingSupplierOfferFields
                requisition={purchasingContext!.requisition}
                item={purchasingContext!.item}
                value={value}
                onChange={onChange}
                suppliers={suppliers}
                brands={brands}
                origins={origins}
                deliveryTimes={deliveryTimes}
                onNewSupplier={onNewSupplier}
                technical={technical}
                onTechnicalChange={onTechnicalChange}
                onSuggestTechnical={onSuggestTechnical}
                suggestingTechnical={suggestingTechnical}
                restrictions={restrictions}
                restrictionOptions={restrictionOptions}
                onRestrictionsChange={onRestrictionsChange}
              />
            ) : (
              <SellerSupplierReferenceFields
                item={sellerContext!.item}
                deliveryState={sellerContext!.deliveryState}
                deliveryStates={sellerContext!.deliveryStates}
                onDeliveryStateChange={sellerContext!.onDeliveryStateChange}
                technical={technical}
                onTechnicalChange={onTechnicalChange}
                onSuggestTechnical={onSuggestTechnical}
                suggestingTechnical={suggestingTechnical}
                restrictions={restrictions}
                restrictionOptions={restrictionOptions}
                onRestrictionsChange={onRestrictionsChange}
                value={value}
                onChange={onChange}
                suppliers={suppliers}
                brands={brands}
                origins={origins}
                deliveryTimes={deliveryTimes}
                onNewSupplier={onNewSupplier}
              />
            )}

            {children}

            {attachmentFile && <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-slate-700"><AttachFileOutlined sx={{ fontSize: 15 }} /><span className="min-w-0 flex-1 truncate">Archivo para adjuntar: {attachmentFile.name}</span><Button type="button" size="small" onClick={() => onAttachmentFile(null)} sx={{ fontSize: 10 }}>Quitar</Button></div>}

            {loadingMessage && <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{loadingMessage}</p>}
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
            <button type="button" onClick={onClose} disabled={modalBusy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={modalBusy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{modalBusy && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</button>
          </footer>
        </form>
      </div>
    </div>
    <Dialog open={attachmentsOpen} onClose={() => setAttachmentsOpen(false)} fullWidth maxWidth="md" aria-labelledby="supplier-attachments-title">
      <DialogTitle id="supplier-attachments-title" sx={{ fontSize: 16, fontWeight: 600 }}>Cotizaciones del proveedor</DialogTitle>
      <DialogContent dividers>{existingAttachments || <p className="text-xs text-slate-500">Todavía no hay cotizaciones adjuntas para esta partida.</p>}</DialogContent>
      <DialogActions><Button type="button" size="small" onClick={() => setAttachmentsOpen(false)}>Cerrar</Button></DialogActions>
    </Dialog>
    {extraction && <SupplierQuoteExtractionReviewModal result={extraction} onApply={applyExtraction} onClose={() => setExtraction(null)} />}
    {detectedSupplier && <DetectedSupplierModal
      detected={detectedSupplier}
      matchedSupplier={findDetectedSupplierMatch(detectedSupplier, suppliers)}
      onUseMatched={(supplier) => {
        onChange({ ...value, supplierId: supplier.id, supplierName: supplier.name });
        setDetectedSupplier(null);
      }}
      onCreate={(initialValues) => {
        setDetectedSupplier(null);
        onNewSupplier(initialValues);
      }}
      onChooseOther={() => {
        setDetectedSupplier(null);
        onNewSupplier();
      }}
      onClose={() => setDetectedSupplier(null)}
    />}
    </>
  );
};
