import { useState } from "react";
import { Check, ChevronLeft, ExternalLink, Link2, Paperclip, Pencil, Plus } from "lucide-react";
import { NavLink } from "react-router";
import type { Currency, PurchaseRequisition, RequisitionItem } from "../../modules/procurement/services/purchase-requisitions.service";
import type { FileAttachment } from "../../modules/attachments/services/attachments.service";
import { sellerCostSourceLabel } from "../../modules/quotes/utils/seller-cost-source";
import { AttachmentsModal } from "../../shared/components/attachments/attachments.modal";

const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

interface RequisitionItemPageProps {
  requisition: PurchaseRequisition;
  item: RequisitionItem;
  role: string;
  currentUserId: string;
  canBuy: boolean;
  busy: boolean;
  localPurchaseWithoutErpCodeEnabled: boolean;
  attachments: FileAttachment[];
  attachmentsLoading: boolean;
  attachmentItemLabels: Record<string, string>;
  attachmentOfferLabels: Record<string, string>;
  busyAttachmentId: string | null;
  onDownloadAttachment: (file: FileAttachment) => void;
  onDeleteAttachment: (file: FileAttachment) => void;
  onBack: () => void;
  onEdit: (item: RequisitionItem) => void;
  onLinkErp: (item: RequisitionItem) => void;
  onOffer: (item: RequisitionItem) => void;
  onSelect: (itemId: string, offerId: string) => Promise<boolean>;
  onAllocate: (itemId: string, allocations: Array<{ offerId: string; qty: number }>) => Promise<boolean>;
}

export const RequisitionItemPage = ({
  requisition, item, role, currentUserId, canBuy, busy, localPurchaseWithoutErpCodeEnabled,
  attachments, attachmentsLoading, attachmentItemLabels, attachmentOfferLabels, busyAttachmentId,
  onDownloadAttachment, onDeleteAttachment, onBack, onEdit, onLinkErp, onOffer, onSelect, onAllocate,
}: RequisitionItemPageProps) => {
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const selectedOffer = item.offers.find((offer) => offer.isSelected);
  const itemFiles = attachments.filter((file) =>
    (file.category === "SELLER_SUPPLIER_QUOTE" && Boolean(item.quoteClientItemId && file.clientItemIds.includes(item.quoteClientItemId)))
    || (file.category === "PURCHASE_SUPPLIER_PROPOSAL" && file.purchaseOfferIds.some((offerId) => item.offers.some((offer) => offer.id === offerId))),
  );
  const canEdit = role === "SELLER" && requisition.status === "DRAFT" || canBuy;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-amber-800">
            <ChevronLeft className="h-4 w-4" />Volver a {requisition.requisitionNumber}
          </button>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Gestión de partida · #{item.position}</p>
          <h2 className="mt-1 max-w-4xl text-xl font-semibold leading-snug text-slate-950">{item.customerDescription || item.description}</h2>
          <p className="mt-2 text-xs text-slate-500">{item.qty} {item.unit} · {item.erpCode || "Producto local sin código ERP"} · {requisition.customerName}</p>
        </div>
        <NavLink to={`/quotes/${requisition.quoteId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
          Ver {requisition.quoteNumber}<ExternalLink className="h-3.5 w-3.5" />
        </NavLink>
      </header>

      <div className="flex flex-wrap gap-2">
        {itemFiles.length > 0 && (
          <button type="button" onClick={() => setAttachmentsOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
            <Paperclip className="h-3.5 w-3.5" />Archivos de la partida ({itemFiles.length})
          </button>
        )}
        {canEdit && (
          <button type="button" disabled={busy} onClick={() => onEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Pencil className="h-3.5 w-3.5" />Completar
          </button>
        )}
        {canBuy && item.source === "LOCAL_NEW" && !["COMPLETED", "CANCELLED"].includes(requisition.status) && (
          <button type="button" disabled={busy} onClick={() => onLinkErp(item)} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            <Link2 className="h-3.5 w-3.5" />{item.erpCode ? "Cambiar ERP" : "Vincular ERP"}
          </button>
        )}
        {canBuy && requisition.status !== "DRAFT" && !["COMPLETED", "CANCELLED"].includes(requisition.status) && (
          <button type="button" disabled={busy} onClick={() => onOffer(item)} className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" />Propuesta
          </button>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-semibold text-slate-900">Material y condiciones</h3></div>
        <div className="grid gap-px bg-slate-200 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <InfoBlock label={`Costo vendedor · ${sellerCostSourceLabel(item.sellerCostSource)}`} value={item.sellerUnitCost > 0 ? money(item.sellerUnitCost, item.sellerCurrency) : "Pendiente de cotizar"} />
          <InfoBlock label="Proveedor vendedor" value={item.sellerSupplierName || "No registrado"} />
          <InfoBlock label="Norma / diámetro" value={[item.standard, item.diameter].filter(Boolean).join(" · ") || "-"} />
          <InfoBlock label="Marca" value={item.sellerBrand || "-"} />
          <InfoBlock label="Estado de entrega" value={item.deliveryPlace || "-"} />
          <InfoBlock label="Entrega proveedor" value={item.sellerDeliveryTime || "-"} />
        </div>
      </section>

      {item.originRestrictions.length > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Restricción de origen: {item.originRestrictions.join(", ")}</p>}
      {(item.technicalFamily || Object.keys(item.technicalAttributes).length > 0) && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <h3 className="font-semibold text-slate-700">Datos técnicos · {item.technicalFamily || "Sin familia"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(item.technicalAttributes).map(([key, value]) => <span key={key} className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700"><strong>{key.replaceAll("_", " ")}:</strong> {value}</span>)}
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={`Propuestas de la partida ${item.position}`}>
        <h3 className="text-sm font-semibold text-slate-900">Propuestas de proveedor ({item.offers.length})</h3>
        {item.offers.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Compras aún no registra propuestas.</p>}
        {item.offers.map((offer) => (
          <div key={offer.id} className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${offer.isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{offer.supplier.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${offer.source === "SELLER" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{offer.source === "SELLER" ? "Vendedor" : "Compras"}</span>
                {offer.isSelected && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">Elegida</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{offer.brand || "Sin marca"} · Origen: {offer.origin || "No indicado"} · Entrega: {offer.deliveryTime || "-"}</p>
              {offer.supplierDescription && <p className="mt-1 text-xs text-slate-700">{offer.supplierDescription}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:justify-end">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-950">{money(offer.unitCost, offer.currency)}</p>
                <p className="text-[10px] text-slate-500">por {item.unit}</p>
                {offer.currency === "USD" && <p className="text-[10px] text-slate-500">{offer.exchangeRate ? `≈ ${money(offer.unitCost * offer.exchangeRate, "MXN")} al TC ${offer.exchangeRate}` : "Tipo de cambio pendiente"}</p>}
                {offer.isSelected && <p className="text-[10px] font-semibold text-emerald-700">Adjudicado: {offer.awardedQty ?? item.qty} {item.unit}</p>}
              </div>
              {canBuy && !requisition.supplierRequisitions?.length && !offer.isSelected && (
                <button type="button" disabled={busy} onClick={() => void onSelect(item.id, offer.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" title="Seleccionar propuesta">
                  <Check className="h-4 w-4" />{offer.source === "SELLER" ? "Aplicar cotización" : "Seleccionar"}
                </button>
              )}
            </div>
          </div>
        ))}
        {canBuy && !requisition.supplierRequisitions?.length && item.offers.length > 1 && (
          <AllocationEditor key={`${item.id}:${item.offers.map((offer) => `${offer.id}-${offer.awardedQty}`).join(":")}`} item={item} busy={busy} onAllocate={onAllocate} />
        )}
        {selectedOffer && item.source === "LOCAL_NEW" && !item.erpCode && (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">
            {localPurchaseWithoutErpCodeEnabled
              ? requisition.supplierRequisitions?.length
                ? "La requisición al proveedor ya fue emitida. Para generar el TXT de Proscai aún debes vincular este producto."
                : "Compras puede emitir la requisición al proveedor sin código ERP. Para generar el TXT de Proscai aún debes vincular este producto."
              : "La propuesta ya fue seleccionada. Falta asignar el código ERP."}
          </p>
        )}
      </section>

      {attachmentsOpen && (
        <AttachmentsModal
          title={`Archivos de la partida ${item.position}`}
          files={itemFiles}
          loading={attachmentsLoading}
          itemLabels={attachmentItemLabels}
          offerLabels={attachmentOfferLabels}
          canDelete={(file) => role === "ADMIN" || (file.uploadedByUserId === currentUserId && !["COMPLETED", "CANCELLED"].includes(requisition.status))}
          busyFileId={busyAttachmentId}
          onClose={() => setAttachmentsOpen(false)}
          onDownload={onDownloadAttachment}
          onDelete={onDeleteAttachment}
        />
      )}
    </div>
  );
};

const InfoBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white px-4 py-3">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-xs font-semibold text-slate-800">{value}</p>
  </div>
);

const AllocationEditor = ({ item, busy, onAllocate }: {
  item: RequisitionItem;
  busy: boolean;
  onAllocate: (itemId: string, allocations: Array<{ offerId: string; qty: number }>) => Promise<boolean>;
}) => {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(
    item.offers.map((offer) => [offer.id, offer.isSelected ? String(offer.awardedQty ?? item.qty) : ""]),
  ));
  const allocations = item.offers.flatMap((offer) => {
    const qty = Number(quantities[offer.id]);
    return Number.isFinite(qty) && qty > 0 ? [{ offerId: offer.id, qty }] : [];
  });
  const total = allocations.reduce((sum, allocation) => sum + allocation.qty, 0);
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
      <p className="font-semibold text-slate-900">Repartir {item.qty} {item.unit} entre proveedores</p>
      <p className="mt-1 text-slate-600">Deja en blanco las propuestas no elegidas. La suma debe ser exactamente {item.qty}.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {item.offers.map((offer) => (
          <label key={offer.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5">
            <span>{offer.supplier.name} · {money(offer.unitCost, offer.currency)}/{item.unit} · máx. {offer.qty}</span>
            <input type="number" min="0" max={offer.qty} step="0.0001" value={quantities[offer.id] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [offer.id]: event.target.value }))} className="w-24 rounded border border-slate-300 px-2 py-1 text-right" aria-label={`Cantidad para ${offer.supplier.name}`} />
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className={Math.abs(total - item.qty) < 0.00001 ? "text-emerald-700" : "text-red-700"}>Asignado: {total} / {item.qty}</span>
        <button type="button" disabled={busy || Math.abs(total - item.qty) > 0.00001} onClick={() => void onAllocate(item.id, allocations)} className="rounded bg-blue-700 px-3 py-1.5 font-semibold text-white disabled:opacity-40">Guardar reparto</button>
      </div>
    </div>
  );
};
