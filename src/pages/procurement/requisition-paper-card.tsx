import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField } from "@mui/material";
import { FileDown, Pencil } from "lucide-react";
import { useState } from "react";
import type { PurchaseRequisition, RequisitionItem, UpdateRequisitionDocumentInput } from "../../modules/procurement/services/purchase-requisitions.service";
import { downloadRequisitionDocument, type RequisitionDocumentKind } from "../../modules/procurement/utils/requisition-document-pdf";
import { notifier } from "../../shared/notifications/notifier";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

const matchingOffer = (item: RequisitionItem) =>
  item.offers.find((offer) => offer.isSelected)
  ?? item.offers.find((offer) => offer.source === "SELLER")
  ?? null;

const initialDocument = (requisition: PurchaseRequisition): UpdateRequisitionDocumentInput => ({
  supplierOrderReference: requisition.supplierOrderReference || "",
  shipmentReference: requisition.shipmentReference || "",
  fobTerms: requisition.fobTerms || "",
  paymentTerms: requisition.paymentTerms || "",
  qualityCertificatesRequired: requisition.qualityCertificatesRequired,
  markingInstructions: requisition.markingInstructions || "",
});

export const RequisitionPaperCard = ({ requisition, canEditDocument, canChangeOwner, canEditOfferCode, role, busy, onSaveDocument, onChangeOwner, onSaveSupplierCode }: {
  requisition: PurchaseRequisition;
  canEditDocument: boolean;
  canChangeOwner: boolean;
  canEditOfferCode: boolean;
  role: string;
  busy: boolean;
  onSaveDocument: (input: UpdateRequisitionDocumentInput) => Promise<boolean>;
  onChangeOwner: (itemId: string, owner: "SELLER" | "PURCHASING") => Promise<boolean>;
  onSaveSupplierCode: (itemId: string, offerId: string, code: string | null) => Promise<boolean>;
}) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateRequisitionDocumentInput>(() => initialDocument(requisition));
  const [exporting, setExporting] = useState<RequisitionDocumentKind | null>(null);
  const [codeEditing, setCodeEditing] = useState<{ itemId: string; offerId: string; code: string } | null>(null);
  const sellerCount = requisition.items.filter((item) => item.quotationOwner === "SELLER").length;
  const purchasingCount = requisition.items.length - sellerCount;
  const exportPdf = async (kind: RequisitionDocumentKind) => {
    setExporting(kind);
    try {
      await downloadRequisitionDocument(requisition, kind);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo generar el PDF.");
    } finally {
      setExporting(null);
    }
  };
  const save = async () => {
    if (await onSaveDocument(form)) setEditing(false);
  };
  const setText = (key: keyof UpdateRequisitionDocumentInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const saveCode = async () => {
    if (!codeEditing) return;
    if (await onSaveSupplierCode(codeEditing.itemId, codeEditing.offerId, codeEditing.code.trim() || null)) setCodeEditing(null);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Formato de solicitud de cotización y requisición de compra">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <img src="/img/logo-tuvansa.png" alt="Tuvansa" className="mb-2 h-8 w-auto object-contain" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Formato de compras</p>
          <h3 className="text-sm font-semibold text-slate-900">Solicitud de cotización y/o requisición de compra</h3>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-700">
            <span aria-label={`${sellerCount} partidas cotizadas por Ventas`}>{sellerCount ? "☑" : "☐"} Cotización · Ventas ({sellerCount})</span>
            <span aria-label={`${purchasingCount} partidas por cotizar por Compras`}>{purchasingCount ? "☑" : "☐"} Requisición · Compras ({purchasingCount})</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditDocument && <Button size="small" variant="outlined" startIcon={<Pencil size={15} />} onClick={() => { setForm(initialDocument(requisition)); setEditing(true); }}>Referencias</Button>}
          {sellerCount > 0 && <Button size="small" variant="outlined" startIcon={<FileDown size={15} />} disabled={Boolean(exporting)} onClick={() => void exportPdf("COTIZACION")}>PDF cotización</Button>}
          {purchasingCount > 0 && <Button size="small" variant="outlined" startIcon={<FileDown size={15} />} disabled={Boolean(exporting)} onClick={() => void exportPdf("REQUISICION")}>PDF requisición</Button>}
        </div>
      </div>

      <div className="grid gap-px bg-slate-200 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Proveedor", ([...new Set(requisition.items.map((item) => matchingOffer(item)?.supplier.name || item.sellerSupplierName).filter(Boolean))].join(", ") || "Pendiente")],
          ["Sucursal", [requisition.branchName, requisition.branchAddress].filter(Boolean).join(" · ")],
          ["No. requisición", requisition.requisitionNumber],
          ["Cotización cliente", requisition.quoteNumber],
          ["O.C. proveedor", requisition.supplierOrderReference || "Pendiente"],
          ["No. embarque", requisition.shipmentReference || "No registrado"],
          ["Fecha", new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(requisition.createdAt))],
          ["Lugar de entrega", requisition.deliveryPlace || requisition.deliveryState || "Según partida"],
        ].map(([label, value]) => <div key={label} className="min-w-0 bg-white px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 break-words font-medium text-slate-800">{value}</p></div>)}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] border-collapse text-left text-xs">
          <thead className="bg-slate-900 text-white"><tr>
            {[
              "Part.", "Cant.", "UM", "Código ERP / EAN", "Código proveedor", "Descripción", "Norma · diámetro · espesor", "Costo ref.", "Moneda", "Marca", "Origen", "Entrega", "Responsable",
            ].map((label) => <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-200">
            {requisition.items.map((item) => {
              const offer = matchingOffer(item);
              const cost = offer?.unitCost ?? item.sellerUnitCost;
              const currency = offer?.currency ?? item.sellerCurrency;
              const differentDelivery = Boolean(offer?.deliveryTime && item.sellerDeliveryTime
                && offer.deliveryTime.trim().toUpperCase() !== item.sellerDeliveryTime.trim().toUpperCase());
              return <tr key={item.id} className="align-top hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold">{item.position}</td>
                <td className="px-3 py-3">{item.qty}</td>
                <td className="px-3 py-3">{item.unit}</td>
                <td className="max-w-[140px] px-3 py-3">{item.erpEan || item.erpCode || <span className="text-amber-800">Pendiente de alta ERP</span>}</td>
                <td className="max-w-[120px] px-3 py-3">
                  {offer?.supplierProductCode || "-"}
                  {offer && canEditOfferCode && (role !== "SELLER" || offer.source === "SELLER") && <button
                    type="button"
                    aria-label={`Editar código del proveedor de la partida ${item.position}`}
                    title="Editar código del proveedor"
                    disabled={busy}
                    onClick={() => setCodeEditing({ itemId: item.id, offerId: offer.id, code: offer.supplierProductCode || "" })}
                    className="ml-1 inline-flex rounded p-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  ><Pencil size={12} /></button>}
                  {offer?.externalReference && <span className="mt-1 block text-[10px] text-slate-500">Cot. prov.: {offer.externalReference}</span>}
                </td>
                <td className="min-w-[220px] px-3 py-3">{item.description}</td>
                <td className="max-w-[180px] px-3 py-3">{[item.standard, item.diameter, item.thickness, item.bore].filter(Boolean).join(" · ") || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{cost > 0 ? money(cost, currency) : "Pendiente"}</td>
                <td className="px-3 py-3">{currency}</td>
                <td className="max-w-[110px] px-3 py-3">{offer?.brand || item.sellerBrand || "-"}</td>
                <td className="max-w-[130px] px-3 py-3">{item.originRestrictions.join(", ") || "-"}</td>
                <td className="max-w-[130px] px-3 py-3">{offer?.deliveryTime || item.sellerDeliveryTime || "Pendiente"}{differentDelivery && <span className="mt-1 block font-semibold text-amber-800">Difiere del solicitado: {item.sellerDeliveryTime}</span>}</td>
                <td className="px-3 py-3">
                  {canChangeOwner ? <select
                    aria-label={`Responsable de cotizar partida ${item.position}`}
                    value={item.quotationOwner}
                    disabled={busy}
                    onChange={(event) => void onChangeOwner(item.id, event.target.value as "SELLER" | "PURCHASING")}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  ><option value="SELLER">Ventas</option><option value="PURCHASING">Compras</option></select>
                    : item.quotationOwner === "SELLER" ? "Ventas" : "Compras"}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-700 md:grid-cols-2">
        <div><p className="font-semibold text-slate-900">Términos y condiciones</p><p>Certificados de calidad: {requisition.qualityCertificatesRequired ? "Requeridos" : "No indicados"}</p><p>Marcas / colada: {requisition.markingInstructions || "No indicado"}</p><p>L.A.B. / FOB: {requisition.fobTerms || "No indicado"} · Pago: {requisition.paymentTerms || "No indicado"}</p></div>
        <div className="flex flex-wrap items-end justify-between gap-3"><span>Vendedor: <strong>{requisition.requestedBy.fullName}</strong></span><span>Compras: <strong>{requisition.assignedBuyer?.fullName || "Sin asignar"}</strong></span></div>
      </div>

      <Dialog open={editing} onClose={() => !busy && setEditing(false)} fullWidth maxWidth="sm">
        <DialogTitle>Referencias y condiciones</DialogTitle>
        <DialogContent className="space-y-4 pt-2!">
          <p className="text-xs text-slate-600">El número de embarque es una referencia independiente del pedido ERP. No se modifica ningún embarque existente.</p>
          <TextField fullWidth label="O.C. al proveedor" value={form.supplierOrderReference || ""} onChange={(event) => setText("supplierOrderReference", event.target.value)} inputProps={{ maxLength: 120 }} />
          <TextField fullWidth label="Referencia de embarque" value={form.shipmentReference || ""} onChange={(event) => setText("shipmentReference", event.target.value)} inputProps={{ maxLength: 120 }} />
          <TextField fullWidth label="L.A.B. / FOB" value={form.fobTerms || ""} onChange={(event) => setText("fobTerms", event.target.value)} inputProps={{ maxLength: 255 }} />
          <TextField fullWidth label="Condiciones de pago" value={form.paymentTerms || ""} onChange={(event) => setText("paymentTerms", event.target.value)} inputProps={{ maxLength: 255 }} />
          <TextField fullWidth multiline minRows={2} label="Marcas y número de colada" value={form.markingInstructions || ""} onChange={(event) => setText("markingInstructions", event.target.value)} inputProps={{ maxLength: 500 }} />
          <FormControlLabel control={<Switch checked={form.qualityCertificatesRequired === true} onChange={(_, checked) => setForm((current) => ({ ...current, qualityCertificatesRequired: checked }))} />} label="Requiere certificados de calidad" />
        </DialogContent>
        <DialogActions><Button onClick={() => setEditing(false)} disabled={busy}>Cancelar</Button><Button variant="contained" onClick={() => void save()} disabled={busy}>Guardar</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(codeEditing)} onClose={() => !busy && setCodeEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Código del proveedor</DialogTitle>
        <DialogContent className="pt-2!">
          <p className="mb-3 text-xs text-slate-600">Este código pertenece al proveedor. No modifica el EAN ni genera un código en Proscai.</p>
          <TextField fullWidth autoFocus label="Clave del proveedor" value={codeEditing?.code || ""} onChange={(event) => setCodeEditing((current) => current && ({ ...current, code: event.target.value }))} inputProps={{ maxLength: 120 }} />
        </DialogContent>
        <DialogActions><Button onClick={() => setCodeEditing(null)} disabled={busy}>Cancelar</Button><Button variant="contained" onClick={() => void saveCode()} disabled={busy}>Guardar</Button></DialogActions>
      </Dialog>
    </section>
  );
};
