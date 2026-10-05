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
import type { TechnicalDataFormValue } from "../procurement/technical-data-editor";

interface SellerProcurementPrequoteModalProps {
  item: ManualQuoteItem;
  clientDraftId: string;
  quoteCurrency: QuoteCurrency;
  quoteExchangeRate: number;
  onClose: () => void;
  onSave: (data: ProcurementPrequoteData) => void | Promise<void>;
}

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
    supplierDescription: item.sellerSupplierDescription || "",
    supplierProductCode: item.sellerSupplierProductCode || "",
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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierInitialValues, setSupplierInitialValues] = useState<Partial<SaveSupplierInput> | undefined>();

  const supplierQuoteFiles = useMemo(
    () => (attachments.data || []).filter((file) => file.category === "SELLER_SUPPLIER_QUOTE" && file.clientItemIds.includes(item.id)),
    [attachments.data, item.id],
  );
  const originOptions = (origins.data || []).filter((option) => option.code !== "NO_RESTRICTION");
  const busy = saving || suggestingTechnical || supplierMutations.isPending;
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedCost = Number(offer.unitCost);
    const parsedExchangeRate = Number(offer.exchangeRate);
    if (!offer.supplierId || !offer.supplierName.trim()) return notifier.error("Selecciona el proveedor que cotizó la partida.");
    if (!Number.isFinite(parsedCost) || parsedCost <= 0) return notifier.error("El costo cotizado debe ser mayor a cero.");
    if (offer.currency === "USD" && (!Number.isFinite(parsedExchangeRate) || parsedExchangeRate <= 0)) return notifier.error("Captura un tipo de cambio válido.");
    if (!deliveryState) return notifier.error("Selecciona el estado donde se entregará el material.");
    if (!offer.deliveryTime) return notifier.error("Selecciona el tiempo de entrega ofrecido por el proveedor.");
    try {
      setSaving(true);
      if (attachmentFile) {
        await AttachmentsService.uploadSellerQuote(clientDraftId, [item.id], attachmentFile);
        await attachments.refetch();
      }
      await onSave({
        sellerSupplierId: offer.supplierId,
        sellerSupplierName: offer.supplierName.trim(),
        sellerQuotedUnitCost: parsedCost,
        sellerCostSource: attachmentFile || supplierQuoteFiles.length > 0
          ? "SELLER_SUPPLIER_QUOTE"
          : "ESTIMATED",
        sellerQuotedCurrency: offer.currency,
        sellerQuotedExchangeRate: offer.currency === "USD" ? parsedExchangeRate : null,
        sellerQuotedBrand: offer.brand,
        sellerSupplierDescription: offer.supplierDescription.trim(),
        sellerSupplierProductCode: offer.supplierProductCode?.trim() || "",
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
      notifier.error(caught instanceof Error ? caught.message : "No se pudo guardar la cotización del proveedor.");
    } finally {
      setSaving(false);
    }
  };

  const suggestTechnicalData = async () => {
    try {
      setSuggestingTechnical(true);
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
      notifier.error(caught instanceof Error ? caught.message : "No se pudieron sugerir los datos técnicos.");
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
        sellerContext={{ item, deliveryState, deliveryStates: deliveryStates.data || [], onDeliveryStateChange: setDeliveryState }}
        technical={technicalValue}
        onTechnicalChange={updateTechnicalValue}
        onSuggestTechnical={() => void suggestTechnicalData()}
        suggestingTechnical={suggestingTechnical}
        restrictions={originRestrictions}
        restrictionOptions={origins.data || []}
        onRestrictionsChange={setOriginRestrictions}
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
          }}
        />
      )}
    </>
  );
};
