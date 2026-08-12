import { Loader2, PackageSearch, Paperclip, Sparkles, Store, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Supplier } from "../../../modules/procurement/services/purchase-requisitions.service";
import { SupplierQuoteExtractionService, type ExtractedSupplierData, type ExtractedSupplierQuoteItem, type SupplierQuoteExtractionResult } from "../../../modules/procurement/services/supplier-quote-extraction.service";
import type { SaveSupplierInput } from "../../../modules/procurement/services/purchase-requisitions.service";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import { notifier } from "../../notifications/notifier";
import { SupplierQuoteExtractionReviewModal } from "./supplier-quote-extraction-review.modal";
import { DetectedSupplierModal, findDetectedSupplierMatch } from "./detected-supplier.modal";

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
  error?: string;
  loadingMessage?: string;
  children?: ReactNode;
  existingAttachments?: ReactNode;
}

const optionValue = (option: QuoteCatalogOption) => option.value || option.label;
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-500";
const labelClass = "text-xs font-semibold text-slate-600";

export const SupplierOfferModal = ({
  mode,
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
  error,
  loadingMessage,
  children,
  existingAttachments,
}: SupplierOfferModalProps) => {
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extraction, setExtraction] = useState<SupplierQuoteExtractionResult | null>(null);
  const [detectedSupplier, setDetectedSupplier] = useState<ExtractedSupplierData | null>(null);
  const update = <K extends keyof SupplierOfferFormValue>(key: K, fieldValue: SupplierOfferFormValue[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };
  const title = mode === "SELLER" ? "Agregar referencia de proveedor" : "Nueva propuesta de proveedor";
  const eyebrow = mode === "SELLER" ? "Información opcional para Compras" : "Propuesta de Compras";
  const submitLabel = mode === "SELLER" ? "Guardar referencia" : "Registrar propuesta de Compras";
  const modalBusy = busy || extracting;
  const canExtract = Boolean(attachmentFile && /\.(pdf|xlsx?)$/i.test(attachmentFile.name));

  const extractSupplierQuote = async () => {
    if (!attachmentFile || !canExtract) return;
    setExtracting(true);
    setExtractionProgress(0);
    try {
      const result = await SupplierQuoteExtractionService.extract(attachmentFile, setExtractionProgress);
      setExtraction(result);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo extraer la cotización del proveedor.");
    } finally {
      setExtracting(false);
    }
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
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="shrink-0 rounded-xl bg-amber-100 p-2 text-amber-700"><PackageSearch className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">{eyebrow}</p>
              <h2 id="supplier-offer-title" className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{itemDescription}</p>
            </div>
          </div>
          <button type="button" disabled={modalBusy} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto px-5 py-5">
            <section>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Proveedor y material</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  <span className="flex items-center justify-between gap-3">Proveedor *<button type="button" onClick={() => onNewSupplier()} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"><Store className="h-3.5 w-3.5" />Nuevo proveedor</button></span>
                  <select value={value.supplierId} onChange={(event) => {
                    const supplierId = event.target.value;
                    const supplier = suppliers.find((entry) => entry.id === supplierId);
                    onChange({ ...value, supplierId, supplierName: supplier?.name || "" });
                  }} className={inputClass}>
                    <option value="">Selecciona un proveedor registrado...</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</option>)}
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>Descripción según el proveedor
                  <textarea
                    value={value.supplierDescription}
                    onChange={(event) => update("supplierDescription", event.target.value)}
                    onBlur={(event) => update("supplierDescription", event.currentTarget.value.toUpperCase())}
                    rows={3}
                    maxLength={500}
                    className={inputClass}
                    placeholder="Descripción utilizada por el proveedor"
                  />
                </label>
              </div>
            </section>

            <section className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Condiciones de la propuesta</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Cantidad *" type="number" value={value.qty} disabled={quantityReadOnly} onChange={(fieldValue) => update("qty", fieldValue)} />
                <Field label="Costo unitario *" type="number" value={value.unitCost} onChange={(fieldValue) => update("unitCost", fieldValue)} />
                <Select label="Moneda *" value={value.currency} onChange={(fieldValue) => update("currency", fieldValue as SupplierOfferCurrency)} options={[["MXN", "MXN"], ["USD", "USD"]]} />
                {value.currency === "USD" && <Field label="Tipo de cambio *" type="number" value={value.exchangeRate} onChange={(fieldValue) => update("exchangeRate", fieldValue)} />}
                <Select label="Marca" value={value.brand} onChange={(fieldValue) => update("brand", fieldValue)} options={[["", "Seleccionar"], ...brands.map((option) => [optionValue(option), option.label] as [string, string])]} />
                <Select label="Procedencia" value={value.origin} onChange={(fieldValue) => update("origin", fieldValue)} options={[["", "Seleccionar"], ...origins.map((option) => [optionValue(option), option.label] as [string, string])]} />
                <Select label="Tiempo de entrega *" value={value.deliveryTime} onChange={(fieldValue) => update("deliveryTime", fieldValue)} options={[["", "Seleccionar"], ...deliveryTimes.map((option) => [optionValue(option), option.label] as [string, string])]} />
                <Field label="Vigencia" type="date" value={value.validUntil} onChange={(fieldValue) => update("validUntil", fieldValue)} />
                <Field label="Referencia del proveedor" value={value.externalReference} onChange={(fieldValue) => update("externalReference", fieldValue)} />
                <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Notas
                  <textarea value={value.notes} onChange={(event) => update("notes", event.target.value)} rows={3} maxLength={1000} className={inputClass} placeholder="Condiciones o aclaraciones de la propuesta" />
                </label>
              </div>
            </section>

            {children}

            <section className="mt-6 border-t border-slate-200 pt-5">
              <label className="block rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-amber-700" />Archivo de la propuesta (opcional)</span>
                <input type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp" disabled={modalBusy} onChange={(event) => onAttachmentFile(event.currentTarget.files?.[0] || null)} className="mt-3 w-full text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950" />
                {attachmentFile && <span className="mt-2 block font-normal text-slate-500">{attachmentFile.name}</span>}
                <button type="button" disabled={!canExtract || modalBusy} onClick={() => void extractSupplierQuote()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {extracting ? `Extrayendo con IA (${extractionProgress}%)` : "Extraer cotización con IA"}
                </button>
                {attachmentFile && !canExtract && <span className="mt-2 block font-normal text-slate-500">La extracción con IA está disponible para PDF, XLS y XLSX.</span>}
              </label>
              {existingAttachments && <div className="mt-4">{existingAttachments}</div>}
            </section>

            {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
            {loadingMessage && <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{loadingMessage}</p>}
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button type="button" onClick={onClose} disabled={modalBusy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={modalBusy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{modalBusy && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</button>
          </footer>
        </form>
      </div>
    </div>
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

const Field = ({ label, value, onChange, type = "text", disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) => (
  <label className={labelClass}>{label}<input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.0001" : undefined} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>
);

const Select = ({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) => (
  <label className={labelClass}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
);
