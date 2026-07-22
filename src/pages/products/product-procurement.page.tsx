import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  type ProcurementOffer,
  type ProcurementOfferInput,
  type ProcurementProduct,
  type ProductProcurementStatus,
} from "../../modules/products/services/local-product-procurement.service";
import {
  useProcurementMutations,
  useProcurementProduct,
  useProcurementProducts,
} from "../../queries/products/use-local-product-procurement";
import { notifier } from "../../shared/notifications/notifier";
import { isValidEmail, isValidPhoneNumber } from "../../shared/utils/contact-validation";

const PAGE_SIZE = 20;

const STATUS: Record<ProductProcurementStatus, { label: string; className: string }> = {
  PENDING_REVIEW: { label: "Pendiente de revisión", className: "bg-amber-100 text-amber-800" },
  QUOTING: { label: "Cotizando", className: "bg-blue-100 text-blue-800" },
  COSTED: { label: "Con costo", className: "bg-emerald-100 text-emerald-800" },
  PENDING_ERP: { label: "Pendiente de alta ERP", className: "bg-violet-100 text-violet-800" },
  ERP_LINKED: { label: "Vinculado a ERP", className: "bg-slate-200 text-slate-800" },
  REJECTED: { label: "Rechazado por Compras", className: "bg-rose-100 text-rose-800" },
};

interface OfferForm {
  supplierName: string;
  contactName: string;
  email: string;
  phone: string;
  unitCost: string;
  currency: "MXN" | "USD";
  minimumQty: string;
  deliveryTime: string;
  validUntil: string;
  notes: string;
}

const EMPTY_OFFER: OfferForm = {
  supplierName: "",
  contactName: "",
  email: "",
  phone: "",
  unitCost: "",
  currency: "MXN",
  minimumQty: "",
  deliveryTime: "",
  validUntil: "",
  notes: "",
};

const offerToForm = (offer: ProcurementOffer): OfferForm => ({
  supplierName: offer.supplierName,
  contactName: offer.contactName || "",
  email: offer.email || "",
  phone: offer.phone || "",
  unitCost: String(offer.unitCost),
  currency: offer.currency,
  minimumQty: offer.minimumQty === null ? "" : String(offer.minimumQty),
  deliveryTime: offer.deliveryTime || "",
  validUntil: offer.validUntil || "",
  notes: offer.notes || "",
});

const money = (value: number | null, currency: "MXN" | "USD") =>
  value === null
    ? "-"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

const dateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";

export const ProductProcurementPage = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductProcurementStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ProcurementOffer | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>(EMPTY_OFFER);
  const [confirmSelection, setConfirmSelection] = useState<ProcurementOffer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProcurementOffer | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const listQuery = useProcurementProducts({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    status,
  });
  const detailQuery = useProcurementProduct(selectedProductId);
  const mutations = useProcurementMutations();
  const product = detailQuery.data || null;

  const openNewOffer = () => {
    setEditingOffer(null);
    setOfferForm({
      ...EMPTY_OFFER,
      currency: product?.currency || "MXN",
    });
    setOfferModalOpen(true);
  };

  const openEditOffer = (offer: ProcurementOffer) => {
    setEditingOffer(offer);
    setOfferForm(offerToForm(offer));
    setOfferModalOpen(true);
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!product) return;
    const cost = Number(offerForm.unitCost);
    const minimumQty = offerForm.minimumQty.trim() ? Number(offerForm.minimumQty) : null;
    if (!offerForm.supplierName.trim()) return notifier.warning("El proveedor es obligatorio.");
    if (!Number.isFinite(cost) || cost <= 0) return notifier.warning("El costo debe ser mayor a cero.");
    if (minimumQty !== null && (!Number.isFinite(minimumQty) || minimumQty <= 0)) {
      return notifier.warning("La cantidad mínima debe ser mayor a cero.");
    }
    if (offerForm.email.trim() && !isValidEmail(offerForm.email)) return notifier.warning("El correo no es válido.");
    if (offerForm.phone.trim() && !isValidPhoneNumber(offerForm.phone)) return notifier.warning("El teléfono no es válido.");

    const input: ProcurementOfferInput = {
      supplierName: offerForm.supplierName.trim(),
      contactName: offerForm.contactName.trim() || null,
      email: offerForm.email.trim() || null,
      phone: offerForm.phone.trim() || null,
      unitCost: cost,
      currency: offerForm.currency,
      minimumQty,
      deliveryTime: offerForm.deliveryTime.trim() || null,
      validUntil: offerForm.validUntil || null,
      notes: offerForm.notes.trim() || null,
    };

    try {
      if (editingOffer) {
        await mutations.updateOffer.mutateAsync({ productId: product.id, offerId: editingOffer.id, input });
        notifier.success("Propuesta actualizada.");
      } else {
        await mutations.createOffer.mutateAsync({ productId: product.id, input });
        notifier.success("Propuesta agregada.");
      }
      setOfferModalOpen(false);
      setEditingOffer(null);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo guardar la propuesta.");
    }
  };

  const changeStatus = async (nextStatus: ProductProcurementStatus, comment?: string) => {
    if (!product) return;
    try {
      await mutations.changeStatus.mutateAsync({ productId: product.id, status: nextStatus, comment });
      notifier.success("Estado de Compras actualizado.");
      setRejectOpen(false);
      setRejectComment("");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Abastecimiento</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Productos locales pendientes</h1>
            <p className="mt-1 text-sm text-slate-500">Cotiza productos temporales y define el costo que utilizará el equipo comercial.</p>
          </div>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar producto o proveedor..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ProductProcurementStatus | "ALL");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">Todos los estados</option>
            {Object.entries(STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Producto", "Sucursal", "Estado", "Propuestas", "Costo elegido", "Último cambio", ""].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {listQuery.isFetching && !listQuery.data && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Cargando productos...</td></tr>
              )}
              {!listQuery.isFetching && (listQuery.data?.items.length || 0) === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500"><PackageSearch className="mx-auto mb-2 h-7 w-7 text-slate-400" />No hay productos para este filtro.</td></tr>
              )}
              {(listQuery.data?.items || []).map((item) => {
                const selected = item.offers.find((offer) => offer.isSelected);
                return (
                  <tr key={item.id} className="hover:bg-amber-50/40">
                    <td className="max-w-md px-4 py-3"><p className="text-sm font-semibold text-slate-800">{item.description}</p><p className="mt-1 text-xs text-slate-500">UM: {item.unit} · Creado por {item.createdBy?.fullName || "Sin registro"}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{item.branch?.name || "General"}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.procurementStatus} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{item.offers.length}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{selected ? money(selected.unitCost, selected.currency) : "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{dateTime(item.procurementUpdatedAt || item.createdAt)}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedProductId(item.id)} className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50">Gestionar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
          <span>Página {page} de {listQuery.data?.totalPages || 1} · {listQuery.data?.total || 0} productos</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={!listQuery.data?.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      {selectedProductId && (
        <ProductModal
          product={product}
          loading={detailQuery.isLoading}
          busy={mutations.isPending}
          onClose={() => setSelectedProductId(null)}
          onNewOffer={openNewOffer}
          onEditOffer={openEditOffer}
          onSelectOffer={setConfirmSelection}
          onDeleteOffer={setConfirmDelete}
          onStatus={changeStatus}
          onReject={() => setRejectOpen(true)}
        />
      )}

      {offerModalOpen && product && (
        <OfferModal form={offerForm} setForm={setOfferForm} editing={Boolean(editingOffer)} busy={mutations.isPending} onClose={() => setOfferModalOpen(false)} onSubmit={saveOffer} />
      )}

      {confirmSelection && product && (
        <ConfirmModal
          title="Seleccionar propuesta"
          text={`Se usará el costo de ${confirmSelection.supplierName}: ${money(confirmSelection.unitCost, confirmSelection.currency)}.`}
          confirmLabel="Seleccionar costo"
          busy={mutations.selectOffer.isPending}
          onClose={() => setConfirmSelection(null)}
          onConfirm={async () => {
            try {
              await mutations.selectOffer.mutateAsync({ productId: product.id, offerId: confirmSelection.id });
              notifier.success("Costo seleccionado para el producto.");
              setConfirmSelection(null);
            } catch (error) {
              notifier.error(error instanceof Error ? error.message : "No se pudo seleccionar.");
            }
          }}
        />
      )}

      {confirmDelete && product && (
        <ConfirmModal
          title="Retirar propuesta"
          text={`La propuesta de ${confirmDelete.supplierName} dejará de estar disponible.`}
          confirmLabel="Retirar"
          destructive
          busy={mutations.deactivateOffer.isPending}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              await mutations.deactivateOffer.mutateAsync({ offerId: confirmDelete.id, productId: product.id });
              notifier.success("Propuesta retirada.");
              setConfirmDelete(null);
            } catch (error) {
              notifier.error(error instanceof Error ? error.message : "No se pudo retirar.");
            }
          }}
        />
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Rechazar producto local</h2>
            <p className="mt-1 text-xs text-slate-500">Indica por qué Compras no puede cotizar este producto.</p>
            <textarea value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} rows={4} maxLength={1000} className="mt-4 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Motivo obligatorio..." />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Cancelar</button>
              <button type="button" disabled={!rejectComment.trim() || mutations.isPending} onClick={() => void changeStatus("REJECTED", rejectComment)} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: ProductProcurementStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS[status].className}`}>{STATUS[status].label}</span>
);

const ProductModal = ({
  product,
  loading,
  busy,
  onClose,
  onNewOffer,
  onEditOffer,
  onSelectOffer,
  onDeleteOffer,
  onStatus,
  onReject,
}: {
  product: ProcurementProduct | null;
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onNewOffer: () => void;
  onEditOffer: (offer: ProcurementOffer) => void;
  onSelectOffer: (offer: ProcurementOffer) => void;
  onDeleteOffer: (offer: ProcurementOffer) => void;
  onStatus: (status: ProductProcurementStatus) => Promise<void>;
  onReject: () => void;
}) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Expediente de Compras</p><h2 className="mt-1 text-lg font-bold text-slate-900">{product?.description || "Cargando producto..."}</h2>{product && <p className="mt-1 text-xs text-slate-500">UM: {product.unit} · {product.branch?.name || "General"}</p>}</div>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>
      <div className="overflow-y-auto p-5">
        {loading || !product ? <div className="py-16 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Cargando expediente...</div> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div><StatusBadge status={product.procurementStatus} /><p className="mt-2 text-xs text-slate-500">Último cambio: {product.procurementUpdatedBy?.fullName || "Sin registro"} · {dateTime(product.procurementUpdatedAt)}</p>{product.procurementNotes && <p className="mt-2 text-sm text-rose-700">{product.procurementNotes}</p>}</div>
              <div className="flex flex-wrap gap-2">
                {(product.procurementStatus === "PENDING_REVIEW" || product.procurementStatus === "REJECTED") && <button type="button" disabled={busy} onClick={() => void onStatus("QUOTING")} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Iniciar cotización</button>}
                {product.procurementStatus === "COSTED" && <button type="button" disabled={busy} onClick={() => void onStatus("PENDING_ERP")} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"><Send className="h-3.5 w-3.5" />Enviar a alta ERP</button>}
                {(product.procurementStatus === "COSTED" || product.procurementStatus === "PENDING_ERP") && <button type="button" disabled={busy} onClick={() => void onStatus("QUOTING")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Recotizar</button>}
                {product.procurementStatus !== "ERP_LINKED" && product.procurementStatus !== "REJECTED" && <button type="button" disabled={busy} onClick={onReject} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700">Rechazar</button>}
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-900">Propuestas de proveedor</h3><p className="mt-1 text-xs text-slate-500">Compara costo, vigencia y entrega antes de seleccionar.</p></div>
              <button type="button" onClick={onNewOffer} disabled={busy || product.procurementStatus === "ERP_LINKED"} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"><Plus className="h-4 w-4" />Agregar propuesta</button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {product.offers.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">Aún no hay propuestas registradas.</div>}
              {product.offers.map((offer) => (
                <article key={offer.id} className={`rounded-xl border p-4 ${offer.isSelected ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2"><h4 className="text-sm font-bold text-slate-900">{offer.supplierName}</h4>{offer.isSelected && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">Seleccionada</span>}</div><p className="mt-1 text-xs text-slate-500">{offer.contactName || "Sin contacto"} · {offer.email || offer.phone || "Sin datos de contacto"}</p></div>
                    <p className="text-lg font-bold text-slate-900">{money(offer.unitCost, offer.currency)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">Cantidad mínima</p><p className="mt-1 font-semibold text-slate-700">{offer.minimumQty ?? "-"}</p></div><div><p className="text-slate-400">Entrega</p><p className="mt-1 font-semibold text-slate-700">{offer.deliveryTime || "-"}</p></div><div><p className="text-slate-400">Vigencia</p><p className="mt-1 font-semibold text-slate-700">{offer.validUntil || "-"}</p></div></div>
                  {offer.notes && <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{offer.notes}</p>}
                  <p className="mt-3 text-[11px] text-slate-400">Registró {offer.createdBy.fullName} · {dateTime(offer.createdAt)}</p>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" disabled={busy} onClick={() => onEditOffer(offer)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700"><Pencil className="h-3.5 w-3.5" />Editar</button>
                    {!offer.isSelected && <button type="button" disabled={busy} onClick={() => onDeleteOffer(offer)} className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1.5 text-xs font-semibold text-rose-700"><Trash2 className="h-3.5 w-3.5" />Retirar</button>}
                    {!offer.isSelected && <button type="button" disabled={busy} onClick={() => onSelectOffer(offer)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" />Seleccionar</button>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const OfferModal = ({ form, setForm, editing, busy, onClose, onSubmit }: {
  form: OfferForm;
  setForm: React.Dispatch<React.SetStateAction<OfferForm>>;
  editing: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4">
    <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between"><div><h2 className="text-base font-semibold text-slate-900">{editing ? "Editar propuesta" : "Nueva propuesta"}</h2><p className="mt-1 text-xs text-slate-500">Registra los datos entregados por el proveedor.</p></div><button type="button" onClick={onClose} disabled={busy} className="p-1 text-slate-500"><X className="h-5 w-5" /></button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Proveedor *" value={form.supplierName} onChange={(supplierName) => setForm((state) => ({ ...state, supplierName }))} />
        <Field label="Contacto" value={form.contactName} onChange={(contactName) => setForm((state) => ({ ...state, contactName }))} />
        <Field label="Correo" type="email" value={form.email} onChange={(email) => setForm((state) => ({ ...state, email }))} />
        <Field label="Teléfono" value={form.phone} onChange={(phone) => setForm((state) => ({ ...state, phone }))} />
        <Field label="Costo unitario *" type="number" value={form.unitCost} onChange={(unitCost) => setForm((state) => ({ ...state, unitCost }))} />
        <label className="text-xs font-semibold text-slate-600">Moneda *<select value={form.currency} onChange={(event) => setForm((state) => ({ ...state, currency: event.target.value as "MXN" | "USD" }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
        <Field label="Cantidad mínima" type="number" value={form.minimumQty} onChange={(minimumQty) => setForm((state) => ({ ...state, minimumQty }))} />
        <Field label="Tiempo de entrega" value={form.deliveryTime} onChange={(deliveryTime) => setForm((state) => ({ ...state, deliveryTime }))} placeholder="Ej. 3 a 5 días" />
        <Field label="Vigencia" type="date" value={form.validUntil} onChange={(validUntil) => setForm((state) => ({ ...state, validUntil }))} />
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Notas<textarea value={form.notes} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} rows={3} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Cancelar</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}{editing ? "Guardar cambios" : "Agregar propuesta"}</button></div>
    </form>
  </div>
);

const Field = ({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) => (
  <label className="text-xs font-semibold text-slate-600">{label}<input type={type} value={value} placeholder={placeholder} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" /></label>
);

const ConfirmModal = ({ title, text, confirmLabel, destructive = false, busy, onClose, onConfirm }: { title: string; text: string; confirmLabel: string; destructive?: boolean; busy: boolean; onClose: () => void; onConfirm: () => Promise<void> }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-600">{text}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Cancelar</button><button type="button" onClick={() => void onConfirm()} disabled={busy} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${destructive ? "bg-rose-600" : "bg-emerald-600"}`}>{busy ? "Procesando..." : confirmLabel}</button></div></div></div>
);
