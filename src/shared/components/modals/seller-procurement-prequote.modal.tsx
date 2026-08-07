import { useMemo, useState } from "react";
import { AttachmentsService, type FileAttachment } from "../../../modules/attachments/services/attachments.service";
import { TechnicalDataService } from "../../../modules/procurement/services/technical-data.service";
import type { SaveSupplierInput } from "../../../modules/procurement/services/purchase-requisitions.service";
import { useDraftAttachments } from "../../../queries/attachments/use-attachments";
import { usePurchaseRequisitionMutations, useSuppliers } from "../../../queries/procurement/use-purchase-requisitions";
import { useQuoteCatalogs } from "../../../queries/quote-catalogs/use-quote-catalogs";
import type { ManualQuoteItem, ProcurementPrequoteData } from "../../../store/quote/manual-quote.store";
import type { QuoteCurrency } from "../../../store/quote/manual-quote.store";
import { getQuoteItemEffectiveCost, getQuoteItemFulfillment } from "../../../modules/quotes/utils/quote-fulfillment";
import { AttachmentsPanel } from "../attachments/attachments-panel";
import { PdfAttachmentViewerModal } from "../attachments/pdf-attachment-viewer.modal";
import { notifier } from "../../notifications/notifier";
import { SelectOrCreateSupplierModal } from "./select-or-create-supplier.modal";
import { SupplierOfferModal, type SupplierOfferFormValue } from "./supplier-offer.modal";
import { TechnicalDataEditor, type TechnicalDataFormValue } from "../procurement/technical-data-editor";

interface SellerProcurementPrequoteModalProps {
  item: ManualQuoteItem;
  clientDraftId: string;
  quoteCurrency: QuoteCurrency;
  quoteExchangeRate: number;
  onClose: () => void;
  onSave: (data: ProcurementPrequoteData) => void;
}

const optionValue = (option: { value: string | null; label: string }) => option.value || option.label;

export const SellerProcurementPrequoteModal = ({ item, clientDraftId, quoteCurrency, quoteExchangeRate, onClose, onSave }: SellerProcurementPrequoteModalProps) => {
  const suppliers = useSuppliers(true);
  const supplierMutations = usePurchaseRequisitionMutations();
  const brands = useQuoteCatalogs("PURCHASE_BRAND");
  const origins = useQuoteCatalogs("ORIGIN_RESTRICTION");
  const deliveryStates = useQuoteCatalogs("DELIVERY_STATE");
  const deliveryTimes = useQuoteCatalogs("DELIVERY_TIME");
  const attachments = useDraftAttachments(clientDraftId);
  const fulfillment = getQuoteItemFulfillment(item);
  const [offer, setOffer] = useState<SupplierOfferFormValue>({
    supplierId: item.sellerSupplierId || "",
    supplierName: item.sellerSupplierName || "",
    supplierDescription: item.sellerSupplierDescription || item.erpDescription || item.customerDescription || "",
    qty: String(fulfillment.purchaseQty),
    unitCost: item.sellerQuotedUnitCost === null ? "" : String(item.sellerQuotedUnitCost),
    currency: item.sellerQuotedCurrency || "MXN",
    exchangeRate: String(item.sellerQuotedExchangeRate || quoteExchangeRate),
    brand: item.sellerQuotedBrand || "",
    origin: item.sellerSupplierOrigin || "",
    deliveryTime: item.sellerSupplierDeliveryTime || "",
    validUntil: item.sellerSupplierQuoteValidUntil?.slice(0, 10) || "",
    externalReference: item.sellerSupplierQuoteReference || "",
    notes: item.sellerSupplierQuoteNotes || "",
  });
  const [originRestrictions, setOriginRestrictions] = useState<string[]>(item.sellerOriginRestrictions || []);
  const [deliveryState, setDeliveryState] = useState(item.sellerDeliveryState || "");
  const [standard, setStandard] = useState(item.purchaseStandard || "");
  const [diameter, setDiameter] = useState(item.purchaseDiameter || "");
  const [thickness, setThickness] = useState(item.purchaseThickness || "");
  const [bore, setBore] = useState(item.purchaseBore || "");
  const [technicalFamily, setTechnicalFamily] = useState(item.technicalFamily || "OTHER");
  const [technicalAttributes, setTechnicalAttributes] = useState<Record<string, string>>(item.technicalAttributes || {});
  const [suggestingTechnical, setSuggestingTechnical] = useState(false);
  const [error, setError] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierInitialValues, setSupplierInitialValues] = useState<Partial<SaveSupplierInput> | undefined>();

  const noRestrictionValue = useMemo(() => {
    const option = (origins.data || []).find((entry) => entry.code === "NO_RESTRICTION");
    return option ? optionValue(option) : "SIN RESTRICCIÓN";
  }, [origins.data]);
  const supplierQuoteFiles = useMemo(
    () => (attachments.data || []).filter((file) => file.category === "SELLER_SUPPLIER_QUOTE" && file.clientItemIds.includes(item.id)),
    [attachments.data, item.id],
  );
  const originOptions = (origins.data || []).filter((option) => option.code !== "NO_RESTRICTION");
  const busy = saving || suggestingTechnical || supplierMutations.isPending;
  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100";
  const labelClass = "text-xs font-semibold text-slate-600";
  const technicalValue: TechnicalDataFormValue = {
    standard,
    diameter,
    thickness,
    bore,
    technicalFamily,
    technicalAttributes,
  };
  const quotedUnitCost = Number(offer.unitCost);
  const effectiveCostPreview = Number.isFinite(quotedUnitCost) && quotedUnitCost > 0
    ? getQuoteItemEffectiveCost({
        ...item,
        sellerQuotedUnitCost: quotedUnitCost,
        sellerQuotedCurrency: offer.currency,
        sellerQuotedExchangeRate: Number(offer.exchangeRate) || quoteExchangeRate,
      }, quoteCurrency, quoteExchangeRate)
    : null;
  const updateTechnicalValue = (value: TechnicalDataFormValue) => {
    setStandard(value.standard);
    setDiameter(value.diameter);
    setThickness(value.thickness);
    setBore(value.bore);
    setTechnicalFamily(value.technicalFamily);
    setTechnicalAttributes(value.technicalAttributes);
  };

  const toggleRestriction = (value: string) => {
    setOriginRestrictions((current) => {
      if (current.includes(value)) return current.filter((entry) => entry !== value);
      if (value === noRestrictionValue) return [value];
      return [...current.filter((entry) => entry !== noRestrictionValue), value];
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedCost = Number(offer.unitCost);
    const parsedExchangeRate = Number(offer.exchangeRate);
    if (!offer.supplierId || !offer.supplierName.trim()) return setError("Selecciona el proveedor que cotizó la partida.");
    if (!Number.isFinite(parsedCost) || parsedCost <= 0) return setError("El costo cotizado debe ser mayor a cero.");
    if (offer.currency === "USD" && (!Number.isFinite(parsedExchangeRate) || parsedExchangeRate <= 0)) return setError("Captura un tipo de cambio válido.");
    if (!deliveryState) return setError("Selecciona el estado donde se entregará el material.");
    if (!offer.deliveryTime) return setError("Selecciona el tiempo de entrega ofrecido por el proveedor.");
    try {
      setSaving(true);
      setError("");
      if (attachmentFile) {
        await AttachmentsService.uploadSellerQuote(clientDraftId, [item.id], attachmentFile);
        await attachments.refetch();
      }
      onSave({
        sellerSupplierId: offer.supplierId,
        sellerSupplierName: offer.supplierName.trim(),
        sellerQuotedUnitCost: parsedCost,
        sellerQuotedCurrency: offer.currency,
        sellerQuotedExchangeRate: offer.currency === "USD" ? parsedExchangeRate : null,
        sellerQuotedBrand: offer.brand,
        sellerSupplierDescription: offer.supplierDescription.trim(),
        sellerSupplierOrigin: offer.origin,
        sellerSupplierQuoteValidUntil: offer.validUntil,
        sellerSupplierQuoteReference: offer.externalReference.trim(),
        sellerSupplierQuoteNotes: offer.notes.trim(),
        sellerOriginRestrictions: originRestrictions,
        sellerDeliveryState: deliveryState,
        sellerSupplierDeliveryTime: offer.deliveryTime,
        purchaseStandard: standard.trim(),
        purchaseDiameter: diameter.trim(),
        purchaseThickness: thickness.trim(),
        purchaseBore: bore.trim(),
        technicalFamily,
        technicalAttributes,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la cotización del proveedor.");
    } finally {
      setSaving(false);
    }
  };

  const suggestTechnicalData = async () => {
    try {
      setSuggestingTechnical(true);
      setError("");
      const suggestion = await TechnicalDataService.suggest({
        requestedDescription: item.erpDescription || item.customerDescription,
        supplierDescription: offer.supplierDescription.trim() || undefined,
        existingAttributes: technicalAttributes,
      });
      setTechnicalFamily(suggestion.family);
      const suggested = Object.fromEntries(suggestion.attributes.map((attribute) => [attribute.key, attribute.value]));
      setTechnicalAttributes((current) => ({ ...current, ...suggested }));
      setStandard(suggested.STANDARD || standard);
      setDiameter(suggested.NOMINAL_DIAMETER || diameter);
      setThickness(suggested.THICKNESS || suggested.SCHEDULE || thickness);
      notifier.success(`IA completó ${suggestion.attributes.length} dato(s) técnicos para ${suggestion.familyLabel}. Revisa antes de guardar.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron sugerir los datos técnicos.");
    } finally {
      setSuggestingTechnical(false);
    }
  };

  const downloadAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try { await AttachmentsService.download(file); }
    catch (caught) { notifier.error(caught instanceof Error ? caught.message : "No se pudo descargar el archivo."); }
    finally { setBusyAttachmentId(null); }
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

  return (
    <>
      <SupplierOfferModal
        mode="SELLER"
        itemDescription={item.erpDescription || item.customerDescription || "Partida sin descripción"}
        value={offer}
        onChange={setOffer}
        suppliers={suppliers.data || []}
        brands={brands.data || []}
        origins={originOptions}
        deliveryTimes={deliveryTimes.data || []}
        quantityReadOnly
        busy={busy}
        attachmentFile={attachmentFile}
        onAttachmentFile={setAttachmentFile}
        onNewSupplier={(initialValues) => {
          setSupplierInitialValues(initialValues);
          setSupplierModalOpen(true);
        }}
        onClose={onClose}
        onSubmit={submit}
        error={error}
        loadingMessage={(suppliers.isLoading || brands.isLoading || origins.isLoading || deliveryStates.isLoading) ? "Cargando catálogos..." : undefined}
        existingAttachments={
          <AttachmentsPanel
            files={supplierQuoteFiles}
            loading={attachments.isLoading}
            title="Cotizaciones del proveedor de esta partida"
            itemLabels={{ [item.id]: item.erpCode || "LOCAL" }}
            canDelete
            busyFileId={busyAttachmentId}
            onPreview={setPreviewFile}
            onDownload={(file) => { void downloadAttachment(file); }}
            onDelete={(file) => { void deleteAttachment(file); }}
          />
        }
      >
        <section className="mb-5 grid grid-cols-3 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Solicitado</p><p className="mt-1 text-sm font-bold text-slate-900">{fulfillment.requestedQty} {item.unit}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Stock ERP</p><p className="mt-1 text-sm font-bold text-emerald-700">{fulfillment.stockQty} {item.unit}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Por comprar</p><p className="mt-1 text-sm font-bold text-amber-700">{fulfillment.purchaseQty} {item.unit}</p></div>
          {effectiveCostPreview && (
            <p className="col-span-3 border-t border-amber-200 pt-2 text-xs text-slate-600">
              Costo efectivo ponderado: <strong>{quoteCurrency} {effectiveCostPreview.effectiveUnitCost.toFixed(2)}</strong> por {item.unit}
            </p>
          )}
        </section>
        <section className="mt-6 border-t border-slate-200 pt-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Datos de la requisición</p>
          <label className={labelClass}>Estado de entrega *
            <select value={deliveryState} onChange={(event) => setDeliveryState(event.target.value)} className={inputClass}>
              <option value="">Seleccionar estado</option>
              {(deliveryStates.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
            </select>
          </label>
          <fieldset className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <legend className="px-1 text-xs font-semibold text-slate-600">Restricción de origen del cliente</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(origins.data || []).map((option) => {
                const value = optionValue(option);
                const checked = originRestrictions.includes(value);
                return <label key={option.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${checked ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}><input type="checkbox" checked={checked} onChange={() => toggleRestriction(value)} className="sr-only" />{option.label}</label>;
              })}
            </div>
          </fieldset>
        </section>

        <div className="mt-6"><TechnicalDataEditor value={technicalValue} onChange={updateTechnicalValue} onSuggest={() => void suggestTechnicalData()} suggesting={suggestingTechnical} /></div>
      </SupplierOfferModal>

      {previewFile && <PdfAttachmentViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {supplierModalOpen && (
        <SelectOrCreateSupplierModal
          initialValues={supplierInitialValues}
          initialMode={supplierInitialValues ? "LOCAL" : "ERP"}
          onClose={() => {
            setSupplierModalOpen(false);
            setSupplierInitialValues(undefined);
          }}
          onSelect={(supplier) => {
            setOffer((current) => ({ ...current, supplierId: supplier.id, supplierName: supplier.name }));
            setSupplierModalOpen(false);
            setSupplierInitialValues(undefined);
            setError("");
          }}
        />
      )}
    </>
  );
};
