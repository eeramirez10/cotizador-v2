import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Loader2,
  Link2,
  PackageCheck,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  type Currency,
  type PurchaseRequisition,
  type RequisitionItem,
  type RequisitionStatus,
  type SaveOfferInput,
  type SaveSupplierInput,
  type Supplier,
} from "../../modules/procurement/services/purchase-requisitions.service";
import {
  usePurchaseRequisition,
  usePurchaseRequisitionMutations,
  usePurchaseRequisitions,
  useSuppliers,
} from "../../queries/procurement/use-purchase-requisitions";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";
import { UsersService, type ManagedUser } from "../../modules/users/services/users.service";
import { useQuoteCatalogs } from "../../queries/quote-catalogs/use-quote-catalogs";
import type { QuoteCatalogOption } from "../../modules/quote-catalogs/services/quote-catalogs.service";
import { AddErpProductsModal } from "../../shared/components/modals/add-erp-products.modal";
import type { ErpProduct } from "../../modules/products/types/erp-product.types";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";
import { useRequisitionAttachments } from "../../queries/attachments/use-attachments";
import { AttachmentsModal } from "../../shared/components/attachments/attachments.modal";
import { AttachmentsService, type FileAttachment } from "../../modules/attachments/services/attachments.service";
import { TechnicalDataService } from "../../modules/procurement/services/technical-data.service";
import { SelectOrCreateSupplierModal } from "../../shared/components/modals/select-or-create-supplier.modal";
import { SupplierOfferModal, type SupplierOfferFormValue } from "../../shared/components/modals/supplier-offer.modal";

const PAGE_SIZE = 15;

const STATUS: Record<RequisitionStatus, { label: string; color: string }> = {
  DRAFT: { label: "Por completar", color: "bg-slate-100 text-slate-700" },
  SUBMITTED: { label: "Enviada a Compras", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "En cotización", color: "bg-cyan-100 text-cyan-800" },
  PARTIALLY_QUOTED: { label: "Cotización parcial", color: "bg-indigo-100 text-indigo-800" },
  COST_REVIEW: { label: "Revisión de costo", color: "bg-rose-100 text-rose-800" },
  READY_FOR_ORDER: { label: "Lista para pedido", color: "bg-emerald-100 text-emerald-800" },
  COMPLETED: { label: "Completada", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", color: "bg-gray-200 text-gray-700" },
};

const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

const date = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));

interface ItemForm {
  standard: string;
  diameter: string;
  thickness: string;
  bore: string;
  technicalFamily: string;
  technicalAttributes: Record<string, string>;
  sellerUnitCost: string;
  sellerCurrency: Currency;
  sellerCostSource: "ERP_COST" | "SELLER_SUPPLIER_QUOTE" | "ESTIMATED";
  sellerBrand: string;
  originRestrictions: string[];
  sellerDeliveryTime: string;
  deliveryPlace: string;
}

const itemForm = (item: RequisitionItem): ItemForm => ({
  standard: item.standard || "",
  diameter: item.diameter || "",
  thickness: item.thickness || "",
  bore: item.bore || "",
  technicalFamily: item.technicalFamily || "OTHER",
  technicalAttributes: item.technicalAttributes || {},
  sellerUnitCost: item.sellerUnitCost > 0 ? String(item.sellerUnitCost) : "",
  sellerCurrency: item.sellerCurrency,
  sellerCostSource: item.sellerCostSource,
  sellerBrand: item.sellerBrand || "",
  originRestrictions: item.originRestrictions,
  sellerDeliveryTime: item.sellerDeliveryTime || "",
  deliveryPlace: item.deliveryPlace || "",
});

type OfferForm = SupplierOfferFormValue;

const offerForm = (item: RequisitionItem): OfferForm => ({
  supplierId: "",
  supplierName: "",
  supplierDescription: item.description,
  qty: String(item.qty),
  unitCost: "",
  currency: item.sellerCurrency,
  exchangeRate: item.sellerCurrency === "USD" ? String(item.sellerExchangeRate) : "",
  brand: item.sellerBrand || "",
  origin: "",
  deliveryTime: item.sellerDeliveryTime || "",
  validUntil: "",
  externalReference: "",
  notes: "",
});

const catalogValue = (option: QuoteCatalogOption): string => option.value || option.label;

export const PurchaseRequisitionsPage = () => {
  const user = useAuthStore((state) => state.user);
  const capabilities = useSystemCapabilities();
  const role = (user?.role || "").toUpperCase();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RequisitionStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RequisitionItem | null>(null);
  const [editingItemForm, setEditingItemForm] = useState<ItemForm | null>(null);
  const [linkingItem, setLinkingItem] = useState<RequisitionItem | null>(null);
  const [offerItem, setOfferItem] = useState<RequisitionItem | null>(null);
  const [currentOfferForm, setCurrentOfferForm] = useState<OfferForm | null>(null);
  const [offerAttachmentFile, setOfferAttachmentFile] = useState<File | null>(null);
  const [showOfferAttachmentModal, setShowOfferAttachmentModal] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierInitialValues, setSupplierInitialValues] = useState<Partial<SaveSupplierInput> | undefined>();
  const debouncedSearch = useDebouncedValue(search, 350);
  const list = usePurchaseRequisitions({ page, pageSize: PAGE_SIZE, search: debouncedSearch, status });
  const detail = usePurchaseRequisition(selectedId);
  const requisitionAttachments = useRequisitionAttachments(selectedId);
  const suppliers = useSuppliers(Boolean(offerItem));
  const brandCatalog = useQuoteCatalogs("PURCHASE_BRAND");
  const restrictionCatalog = useQuoteCatalogs("ORIGIN_RESTRICTION");
  const deliveryStateCatalog = useQuoteCatalogs("DELIVERY_STATE");
  const deliveryTimeCatalog = useQuoteCatalogs("DELIVERY_TIME");
  const mutations = usePurchaseRequisitionMutations();
  const canBuy = role === "ADMIN" || role === "PURCHASING";
  const requisitionInternalApprovalEnabled = capabilities.data?.requisitionInternalApprovalEnabled ?? true;
  const canApproveCost = requisitionInternalApprovalEnabled && (role === "ADMIN" || role === "MANAGER");
  const buyers = useQuery({
    queryKey: ["purchase-requisitions", "buyers"],
    queryFn: () => UsersService.listActiveQuoteProviders({ page: 1, pageSize: 100 }),
    enabled: canBuy,
    staleTime: 30_000,
  });
  const requisition = detail.data || null;

  const attachmentItemLabels = useMemo(() => Object.fromEntries(
    (requisition?.items || []).flatMap((item) => item.quoteClientItemId
      ? [[item.quoteClientItemId, `#${item.position} ${item.erpCode || "LOCAL"}`]]
      : []),
  ), [requisition]);

  const attachmentOfferLabels = useMemo(() => Object.fromEntries(
    (requisition?.items || []).flatMap((item) => item.offers.map((offer) => [
      offer.id,
      `#${item.position} ${offer.supplier.name}`,
    ])),
  ), [requisition]);

  const selectedCosts = useMemo(
    () => requisition?.items.reduce((sum, item) => {
      const selected = item.offers.find((offer) => offer.isSelected);
      return sum + (selected?.total || 0);
    }, 0) || 0,
    [requisition],
  );

  const run = async (label: string, action: () => Promise<unknown>, success: string) => {
    const toast = notifier.loading(label);
    try {
      await action();
      if (toast !== undefined) notifier.update(toast, "success", success);
      else notifier.success(success);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la operación.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
      return false;
    }
  };

  const openItem = (item: RequisitionItem) => {
    setEditingItem(item);
    setEditingItemForm(itemForm(item));
  };

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requisition || !editingItem || !editingItemForm) return;
    const sellerUnitCost = Number(editingItemForm.sellerUnitCost);
    if (!Number.isFinite(sellerUnitCost) || sellerUnitCost < 0) {
      notifier.warning("Captura un costo válido.");
      return;
    }
    const saved = await run(
      "Guardando partida...",
      () => mutations.updateItem.mutateAsync({
        id: requisition.id,
        itemId: editingItem.id,
        input: {
          standard: editingItemForm.standard,
          diameter: editingItemForm.diameter,
          thickness: editingItemForm.thickness,
          bore: editingItemForm.bore,
          technicalFamily: editingItemForm.technicalFamily,
          technicalAttributes: editingItemForm.technicalAttributes,
          sellerUnitCost,
          sellerCurrency: editingItemForm.sellerCurrency,
          sellerCostSource: editingItemForm.sellerCostSource,
          sellerBrand: editingItemForm.sellerBrand,
          originRestrictions: editingItemForm.originRestrictions,
          sellerDeliveryTime: editingItemForm.sellerDeliveryTime,
          deliveryPlace: editingItemForm.deliveryPlace,
        },
      }),
      "Partida actualizada.",
    );
    if (saved) {
      setEditingItem(null);
      setEditingItemForm(null);
    }
  };

  const linkErpProduct = async (product: ErpProduct) => {
    if (!requisition || !linkingItem) return;
    const linked = await run(
      "Validando y vinculando producto ERP...",
      () => mutations.linkItemToErp.mutateAsync({
        id: requisition.id,
        itemId: linkingItem.id,
        erpCode: product.code,
        erpEan: product.ean,
      }),
      `Producto ${product.code} vinculado correctamente.`,
    );
    if (linked) setLinkingItem(null);
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requisition || !offerItem || !currentOfferForm) return;
    const input: SaveOfferInput = {
      supplierId: currentOfferForm.supplierId,
      supplierProductCode: currentOfferForm.supplierProductCode || null,
      alternateCodes: currentOfferForm.alternateCodes || [],
      supplierDescription: currentOfferForm.supplierDescription,
      qty: Number(currentOfferForm.qty),
      unit: currentOfferForm.unit || null,
      listUnitPrice: currentOfferForm.listUnitPrice ?? null,
      discountPct: currentOfferForm.discountPct ?? null,
      unitCost: Number(currentOfferForm.unitCost),
      currency: currentOfferForm.currency,
      exchangeRate: currentOfferForm.currency === "USD" ? Number(currentOfferForm.exchangeRate) : null,
      brand: currentOfferForm.brand,
      origin: currentOfferForm.origin,
      deliveryTime: currentOfferForm.deliveryTime,
      availableDate: currentOfferForm.availableDate || null,
      minimumQty: currentOfferForm.minimumQty ?? null,
      validUntil: currentOfferForm.validUntil || null,
      quoteDate: currentOfferForm.quoteDate || new Date().toISOString().slice(0, 10),
      externalReference: currentOfferForm.externalReference,
      paymentTerms: currentOfferForm.paymentTerms || null,
      deliveryTerms: currentOfferForm.deliveryTerms || null,
      documentSubtotal: currentOfferForm.documentSubtotal ?? null,
      documentDiscount: currentOfferForm.documentDiscount || 0,
      documentFreight: currentOfferForm.documentFreight || 0,
      documentOtherCharges: currentOfferForm.documentOtherCharges || 0,
      taxIncluded: currentOfferForm.taxIncluded === true,
      taxRate: currentOfferForm.documentTaxRate === null || currentOfferForm.documentTaxRate === undefined
        ? 0.16
        : currentOfferForm.documentTaxRate > 1 ? currentOfferForm.documentTaxRate / 100 : currentOfferForm.documentTaxRate,
      documentTax: currentOfferForm.documentTax ?? null,
      documentTotal: currentOfferForm.documentTotal ?? null,
      notes: currentOfferForm.notes,
    };
    if (!input.supplierId || !Number.isFinite(input.qty) || input.qty <= 0 || !Number.isFinite(input.unitCost) || input.unitCost < 0) {
      notifier.warning("Completa proveedor, cantidad y costo.");
      return;
    }
    const previousOfferIds = new Set(offerItem.offers.map((offer) => offer.id));
    const targetItemId = offerItem.id;
    const toast = notifier.loading(offerAttachmentFile ? "Registrando propuesta y archivo..." : "Registrando propuesta...");
    try {
      const savedRequisition = await mutations.createOffer.mutateAsync({ id: requisition.id, itemId: targetItemId, input });
      const createdOffer = savedRequisition.items
        .find((item) => item.id === targetItemId)
        ?.offers.find((offer) => !previousOfferIds.has(offer.id));

      if (offerAttachmentFile) {
        if (!createdOffer) {
          const message = "Propuesta registrada, pero no se pudo identificar para adjuntar el archivo.";
          if (toast !== undefined) notifier.update(toast, "warning", message);
          else notifier.warning(message);
          setOfferItem(null);
          setCurrentOfferForm(null);
          setOfferAttachmentFile(null);
          return;
        }
        try {
          await AttachmentsService.uploadPurchaseOffer(requisition.id, [createdOffer.id], offerAttachmentFile);
          await requisitionAttachments.refetch();
        } catch (attachmentError) {
          const message = attachmentError instanceof Error ? attachmentError.message : "No se pudo guardar el archivo.";
          if (toast !== undefined) notifier.update(toast, "warning", `Propuesta registrada, pero el archivo falló: ${message}`);
          else notifier.warning(`Propuesta registrada, pero el archivo falló: ${message}`);
          setOfferItem(null);
          setCurrentOfferForm(null);
          setOfferAttachmentFile(null);
          return;
        }
      }

      if (toast !== undefined) notifier.update(toast, "success", "Propuesta registrada.");
      else notifier.success("Propuesta registrada.");
      setOfferItem(null);
      setCurrentOfferForm(null);
      setOfferAttachmentFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la propuesta.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    }
  };

  const downloadAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.download(file);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const deleteAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.delete(file.id);
      await requisitionAttachments.refetch();
      notifier.success("Archivo eliminado.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo eliminar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const attachPurchaseOfferFile = async (file: File, offerIds: string[]) => {
    if (!requisition) return false;
    const toast = notifier.loading("Guardando archivo de propuestas...");
    try {
      await AttachmentsService.uploadPurchaseOffer(requisition.id, offerIds, file);
      await requisitionAttachments.refetch();
      if (toast !== undefined) notifier.update(toast, "success", "Archivo ligado a las propuestas seleccionadas.");
      else notifier.success("Archivo ligado a las propuestas seleccionadas.");
      setShowOfferAttachmentModal(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el archivo.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Operación comercial</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Requisiciones de compra</h1>
          <p className="mt-1 text-sm text-slate-500">Cotizaciones aceptadas con material nuevo o sin existencia.</p>
        </div>
        {canBuy && (
          <NavLink to="/procurement/products" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            Productos locales históricos <ArrowRight className="h-4 w-4" />
          </NavLink>
        )}
      </header>

      <section className="grid min-h-[650px] overflow-hidden rounded-xl border border-slate-200 bg-white xl:grid-cols-[410px_minmax(0,1fr)]">
        <div className={`border-slate-200 xl:border-r ${selectedId ? "hidden xl:block" : "block"}`}>
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Folio, cliente o material..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value as RequisitionStatus | "ALL"); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="ALL">Todos los estados</option>
              {Object.entries(STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </div>

          <div className="max-h-[570px] divide-y divide-slate-100 overflow-y-auto">
            {list.isLoading && <Empty icon={<Loader2 className="h-6 w-6 animate-spin" />} text="Cargando requisiciones..." />}
            {!list.isLoading && !list.data?.items.length && <Empty icon={<ClipboardList className="h-7 w-7" />} text="No hay requisiciones para este filtro." />}
            {list.data?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full p-4 text-left transition hover:bg-amber-50/60 ${selectedId === item.id ? "bg-amber-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.requisitionNumber}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{item.quoteNumber} · {item.branchName}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-3 line-clamp-1 text-sm text-slate-700">{item.customerName}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{item.items.length} partida{item.items.length === 1 ? "" : "s"}</span>
                  <span>{date(item.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 p-3 text-xs text-slate-500">
            <span>{list.data?.total || 0} registros</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border p-1.5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" disabled={page >= (list.data?.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="rounded-md border p-1.5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <div className={selectedId ? "block" : "hidden xl:block"}>
          {!selectedId && <Empty icon={<PackageCheck className="h-10 w-10" />} text="Selecciona una requisición para abrir su expediente." large />}
          {selectedId && detail.isLoading && <Empty icon={<Loader2 className="h-7 w-7 animate-spin" />} text="Cargando expediente..." large />}
          {requisition && (
            <RequisitionDetail
              requisition={requisition}
              role={role}
              currentUserId={user?.id || ""}
              selectedCosts={selectedCosts}
              busy={mutations.isPending}
              attachments={requisitionAttachments.data || []}
              attachmentsLoading={requisitionAttachments.isLoading}
              attachmentItemLabels={attachmentItemLabels}
              attachmentOfferLabels={attachmentOfferLabels}
              busyAttachmentId={busyAttachmentId}
              onDownloadAttachment={(file) => { void downloadAttachment(file); }}
              onDeleteAttachment={(file) => { void deleteAttachment(file); }}
              onAttachOffers={() => setShowOfferAttachmentModal(true)}
              onBack={() => setSelectedId(null)}
              onEdit={openItem}
              onLinkErp={setLinkingItem}
              onOffer={(item) => { setOfferItem(item); setCurrentOfferForm(offerForm(item)); }}
              onSelect={(itemId, offerId) => run(
                "Seleccionando propuesta...",
                () => mutations.selectOffer.mutateAsync({ id: requisition.id, itemId, offerId }),
                "Propuesta seleccionada.",
              )}
              onSubmit={() => run(
                "Enviando requisición a Compras...",
                () => mutations.submit.mutateAsync(requisition.id),
                "Requisición enviada a Compras.",
              )}
              onApproveCost={() => run(
                "Aprobando variación de costo...",
                () => mutations.approveCostVariance.mutateAsync(requisition.id),
                "Variación de costo aprobada.",
              )}
              canBuy={canBuy}
              canApproveCost={canApproveCost}
              buyers={(buyers.data?.items || []).filter((item) => item.role === "PURCHASING")}
              onAssign={(buyerUserId) => run(
                "Asignando comprador...",
                () => mutations.assign.mutateAsync({ id: requisition.id, buyerUserId }),
                "Comprador asignado.",
              )}
            />
          )}
        </div>
      </section>

      {editingItem && editingItemForm && (
        <ItemModal
          form={editingItemForm}
          setForm={setEditingItemForm}
          item={editingItem}
          busy={mutations.isPending}
          brands={brandCatalog.data || []}
          restrictions={restrictionCatalog.data || []}
          deliveryStates={deliveryStateCatalog.data || []}
          deliveryTimes={deliveryTimeCatalog.data || []}
          onClose={() => { setEditingItem(null); setEditingItemForm(null); }}
          onSubmit={saveItem}
        />
      )}
      {offerItem && currentOfferForm && (
        <OfferModal
          item={offerItem}
          form={currentOfferForm}
          setForm={setCurrentOfferForm}
          suppliers={suppliers.data || []}
          brands={brandCatalog.data || []}
          origins={(restrictionCatalog.data || []).filter((option) => option.code !== "NO_RESTRICTION")}
          deliveryTimes={deliveryTimeCatalog.data || []}
          busy={mutations.isPending}
          attachmentFile={offerAttachmentFile}
          onAttachmentFile={setOfferAttachmentFile}
          onNewSupplier={(initialValues) => {
            setSupplierInitialValues(initialValues);
            setSupplierOpen(true);
          }}
          onClose={() => { setOfferItem(null); setCurrentOfferForm(null); setOfferAttachmentFile(null); }}
          onSubmit={saveOffer}
        />
      )}
      {showOfferAttachmentModal && requisition && (
        <PurchaseOfferAttachmentModal
          requisition={requisition}
          busy={Boolean(busyAttachmentId)}
          onClose={() => setShowOfferAttachmentModal(false)}
          onSubmit={attachPurchaseOfferFile}
        />
      )}
      {supplierOpen && (
        <SelectOrCreateSupplierModal
          initialValues={supplierInitialValues}
          initialMode={supplierInitialValues ? "LOCAL" : "ERP"}
          onClose={() => {
            setSupplierOpen(false);
            setSupplierInitialValues(undefined);
          }}
          onSelect={(supplier) => {
            setCurrentOfferForm((state) => state ? { ...state, supplierId: supplier.id, supplierName: supplier.name } : state);
            setSupplierOpen(false);
            setSupplierInitialValues(undefined);
          }}
        />
      )}
      <AddErpProductsModal
        open={Boolean(linkingItem)}
        onClose={() => { if (!mutations.linkItemToErp.isPending) setLinkingItem(null); }}
        onSelect={(product) => { void linkErpProduct(product); }}
        title="Vincular partida con producto ERP"
        subtitle="Busca y selecciona el producto oficial. La consulta utiliza exclusivamente la sucursal México."
        actionLabel="Vincular"
        customerDescription={linkingItem?.description || ""}
        customerUnit={linkingItem?.unit || ""}
        initialMode="erp"
        fixedErpBranchCode="01"
        erpOnly
        selectionDisabled={mutations.linkItemToErp.isPending}
      />
    </div>
  );
};

const RequisitionDetail = ({
  requisition,
  role,
  currentUserId,
  selectedCosts,
  busy,
  attachments,
  attachmentsLoading,
  attachmentItemLabels,
  attachmentOfferLabels,
  busyAttachmentId,
  onDownloadAttachment,
  onDeleteAttachment,
  onAttachOffers,
  onBack,
  onEdit,
  onLinkErp,
  onOffer,
  onSelect,
  onSubmit,
  onApproveCost,
  canBuy,
  canApproveCost,
  buyers,
  onAssign,
}: {
  requisition: PurchaseRequisition;
  role: string;
  currentUserId: string;
  selectedCosts: number;
  busy: boolean;
  attachments: FileAttachment[];
  attachmentsLoading: boolean;
  attachmentItemLabels: Record<string, string>;
  attachmentOfferLabels: Record<string, string>;
  busyAttachmentId: string | null;
  onDownloadAttachment: (file: FileAttachment) => void;
  onDeleteAttachment: (file: FileAttachment) => void;
  onAttachOffers: () => void;
  onBack: () => void;
  onEdit: (item: RequisitionItem) => void;
  onLinkErp: (item: RequisitionItem) => void;
  onOffer: (item: RequisitionItem) => void;
  onSelect: (itemId: string, offerId: string) => Promise<boolean>;
  onSubmit: () => Promise<boolean>;
  onApproveCost: () => Promise<boolean>;
  canBuy: boolean;
  canApproveCost: boolean;
  buyers: ManagedUser[];
  onAssign: (buyerUserId: string) => Promise<boolean>;
}) => {
  const sellerDraft = role === "SELLER" && requisition.status === "DRAFT";
  const hasOffers = requisition.items.some((item) => item.offers.length > 0);
  const [attachmentView, setAttachmentView] = useState<{
    type: "ALL" | "SELLER_ITEM";
    clientItemId?: string;
    position?: number;
  } | null>(null);
  const visibleAttachments = attachmentView?.type === "SELLER_ITEM"
    ? attachments.filter((file) => file.category === "SELLER_SUPPLIER_QUOTE"
      && Boolean(attachmentView.clientItemId)
      && file.clientItemIds.includes(attachmentView.clientItemId!))
    : attachments;
  const attachmentModalTitle = attachmentView?.type === "SELLER_ITEM"
    ? `Archivos cotizados por el vendedor · Partida ${attachmentView.position}`
    : `Expediente de ${requisition.requisitionNumber}`;
  return (
    <div className="flex h-full min-h-[650px] flex-col">
      <header className="border-b border-slate-200 px-5 py-4">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 xl:hidden"><ChevronLeft className="h-4 w-4" />Volver</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">{requisition.requisitionNumber}</h2>
              <StatusBadge status={requisition.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{requisition.customerName}</p>
            <p className="mt-1 text-xs text-slate-500">{requisition.branchName} · Solicitó {requisition.requestedBy.fullName}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <NavLink to={`/quotes/${requisition.quoteId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
              Ver {requisition.quoteNumber}<ExternalLink className="h-3.5 w-3.5" />
            </NavLink>
            <button type="button" onClick={() => setAttachmentView({ type: "ALL" })} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Paperclip className="h-3.5 w-3.5" />Expediente ({attachments.length})
            </button>
            {canBuy && !["COMPLETED", "CANCELLED"].includes(requisition.status) && buyers.length > 0 && (
              <select
                value={requisition.assignedBuyerUserId || ""}
                onChange={(event) => { if (event.target.value) void onAssign(event.target.value); }}
                disabled={busy}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <option value="">Asignar comprador...</option>
                {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.fullName}</option>)}
              </select>
            )}
            {canBuy && hasOffers && (
              <button type="button" onClick={onAttachOffers} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50">
                <Paperclip className="h-3.5 w-3.5" />Adjuntar a propuestas
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <Info label="Comprador" value={requisition.assignedBuyer?.fullName || "Sin asignar"} />
          <Info label="Destino" value={requisition.deliveryState || "Definido por partida"} />
          <Info label="Partidas" value={String(requisition.items.length)} />
          <Info label="Total seleccionado" value={selectedCosts ? money(selectedCosts, requisition.quoteCurrency) : "Pendiente"} />
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {requisition.items.map((item) => {
          const selected = item.offers.find((offer) => offer.isSelected);
          const sellerAttachmentCount = item.quoteClientItemId
            ? attachments.filter((file) => file.category === "SELLER_SUPPLIER_QUOTE" && file.clientItemIds.includes(item.quoteClientItemId!)).length
            : 0;
          return (
            <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-col gap-3 bg-slate-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">PART. {item.position}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.source === "LOCAL_NEW" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                      {item.source === "LOCAL_NEW" ? "PRODUCTO NUEVO" : "ERP SIN EXISTENCIA"}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold leading-5 text-slate-900">{item.description}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.qty} {item.unit} · Código: {item.erpCode || "Pendiente de alta"}</p>
                  {item.erpEan && <p className="mt-1 text-xs font-medium text-slate-500">EAN: {item.erpEan}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {canBuy && sellerAttachmentCount > 0 && item.quoteClientItemId && (
                    <button type="button" onClick={() => setAttachmentView({ type: "SELLER_ITEM", clientItemId: item.quoteClientItemId!, position: item.position })} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                      <Paperclip className="h-3.5 w-3.5" />Archivos vendedor ({sellerAttachmentCount})
                    </button>
                  )}
                  {(sellerDraft || canBuy) && (
                    <button type="button" disabled={busy} onClick={() => onEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      <Pencil className="h-3.5 w-3.5" />Completar
                    </button>
                  )}
                  {canBuy && item.source === "LOCAL_NEW" && !["COMPLETED", "CANCELLED"].includes(requisition.status) && (
                    <button type="button" disabled={busy} onClick={() => onLinkErp(item)} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                      <Link2 className="h-3.5 w-3.5" />{item.erpCode ? "Cambiar ERP" : "Vincular ERP"}
                    </button>
                  )}
                  {canBuy && requisition.status !== "DRAFT" && !["COMPLETED", "CANCELLED"].includes(requisition.status) && (
                    <button type="button" disabled={busy} onClick={() => onOffer(item)} className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950">
                      <Plus className="h-3.5 w-3.5" />Propuesta
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-6">
                <InfoBlock label="Costo vendedor" value={money(item.sellerUnitCost, item.sellerCurrency)} />
                <InfoBlock label="Proveedor vendedor" value={item.sellerSupplierName || "No registrado"} />
                <InfoBlock label="Norma / diámetro" value={[item.standard, item.diameter].filter(Boolean).join(" · ") || "-"} />
                <InfoBlock label="Marca" value={item.sellerBrand || "-"} />
                <InfoBlock label="Estado de entrega" value={item.deliveryPlace || "-"} />
                <InfoBlock label="Entrega proveedor" value={item.sellerDeliveryTime || "-"} />
              </div>
              {item.originRestrictions.length > 0 && <p className="border-t border-slate-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">Restricción de origen: {item.originRestrictions.join(", ")}</p>}
              {(item.technicalFamily || Object.keys(item.technicalAttributes).length > 0) && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Datos técnicos · {item.technicalFamily || "Sin familia"}</p>
                  {Object.keys(item.technicalAttributes).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(item.technicalAttributes).map(([key, value]) => (
                        <span key={key} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                          <strong>{key.replaceAll("_", " ")}:</strong> {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 p-4">
                {item.offers.length === 0 && <p className="py-4 text-center text-xs text-slate-500">Compras aún no registra propuestas.</p>}
                {item.offers.map((offer) => (
                  <div key={offer.id} className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${offer.isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{offer.supplier.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${offer.source === "SELLER" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                          {offer.source === "SELLER" ? "Propuesta del vendedor" : "Propuesta de Compras"}
                        </span>
                        {offer.isSelected && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">Elegida</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{offer.brand || "Sin marca"} · Origen: {offer.origin || "No indicado"} · Entrega: {offer.deliveryTime || "-"}</p>
                      {offer.supplierDescription && <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-700"><span className="font-semibold">Descripción proveedor:</span> {offer.supplierDescription}</p>}
                      {offer.source === "SELLER" && sellerAttachmentCount > 0 && item.quoteClientItemId && (
                        <button type="button" onClick={() => setAttachmentView({ type: "SELLER_ITEM", clientItemId: item.quoteClientItemId!, position: item.position })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline">
                          <Paperclip className="h-3.5 w-3.5" />Ver cotización adjunta del vendedor
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-950">{money(offer.unitCost, offer.currency)}</p>
                        <p className="text-[10px] text-slate-500">por {item.unit}</p>
                      </div>
                      {canBuy && !offer.isSelected && (
                        <button type="button" disabled={busy} onClick={() => void onSelect(item.id, offer.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" title="Seleccionar propuesta">
                          <Check className="h-4 w-4" />{offer.source === "SELLER" ? "Aplicar cotización del vendedor" : "Seleccionar"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {selected && item.source === "LOCAL_NEW" && !item.erpCode && (
                  <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">La propuesta ya fue seleccionada. Falta asignar el código ERP.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
        <p className="text-xs text-slate-500">
          {requisition.status === "READY_FOR_ORDER" ? "La cotización ya puede generar el pedido ERP." : "El pedido se habilita cuando todas las partidas estén listas."}
        </p>
        {sellerDraft && (
          <button type="button" disabled={busy} onClick={() => void onSubmit()} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" />Enviar a Compras
          </button>
        )}
        {canApproveCost && requisition.status === "COST_REVIEW" && (
          <button type="button" disabled={busy} onClick={() => void onApproveCost()} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <BadgeDollarSign className="h-4 w-4" />Aprobar mayor costo
          </button>
        )}
      </footer>

      {attachmentView && (
        <AttachmentsModal
          title={attachmentModalTitle}
          files={visibleAttachments}
          loading={attachmentsLoading}
          itemLabels={attachmentItemLabels}
          offerLabels={attachmentOfferLabels}
          canDelete={(file) => role === "ADMIN" || (
            file.uploadedByUserId === currentUserId
            && !["COMPLETED", "CANCELLED"].includes(requisition.status)
          )}
          busyFileId={busyAttachmentId}
          onClose={() => setAttachmentView(null)}
          onDownload={onDownloadAttachment}
          onDelete={onDeleteAttachment}
        />
      )}
    </div>
  );
};

const ItemModal = ({ form, setForm, item, busy, brands, restrictions, deliveryStates, deliveryTimes, onClose, onSubmit }: {
  form: ItemForm;
  setForm: React.Dispatch<React.SetStateAction<ItemForm | null>>;
  item: RequisitionItem;
  busy: boolean;
  brands: QuoteCatalogOption[];
  restrictions: QuoteCatalogOption[];
  deliveryStates: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) => {
  const [suggestingTechnical, setSuggestingTechnical] = useState(false);
  const [newTechnicalKey, setNewTechnicalKey] = useState("");
  const [newTechnicalValue, setNewTechnicalValue] = useState("");
  const noRestriction = restrictions.find((option) => option.code === "NO_RESTRICTION");
  const noRestrictionValue = noRestriction ? catalogValue(noRestriction) : "SIN RESTRICCIÓN";
  const toggleRestriction = (value: string) => setForm((state) => {
    if (!state) return state;
    if (state.originRestrictions.includes(value)) {
      return { ...state, originRestrictions: state.originRestrictions.filter((entry) => entry !== value) };
    }
    return {
      ...state,
      originRestrictions: value === noRestrictionValue
        ? [value]
        : [...state.originRestrictions.filter((entry) => entry !== noRestrictionValue), value],
    };
  });
  const suggestTechnical = async () => {
    try {
      setSuggestingTechnical(true);
      const sellerOfferDescription = item.offers.find((offer) => offer.source === "SELLER")?.supplierDescription || undefined;
      const suggestion = await TechnicalDataService.suggest({
        requestedDescription: item.description,
        supplierDescription: sellerOfferDescription,
        existingAttributes: form.technicalAttributes,
      });
      const attributes = Object.fromEntries(suggestion.attributes.map((attribute) => [attribute.key, attribute.value]));
      setForm((state) => state && ({
        ...state,
        technicalFamily: suggestion.family,
        technicalAttributes: { ...state.technicalAttributes, ...attributes },
        standard: attributes.STANDARD || state.standard,
        diameter: attributes.NOMINAL_DIAMETER || state.diameter,
        thickness: attributes.THICKNESS || attributes.SCHEDULE || state.thickness,
      }));
      notifier.success(`IA sugirió ${suggestion.attributes.length} dato(s) técnicos. Revisa antes de guardar.`);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudieron sugerir los datos técnicos.");
    } finally {
      setSuggestingTechnical(false);
    }
  };
  const addTechnicalAttribute = () => {
    const key = newTechnicalKey.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const value = newTechnicalValue.trim().toUpperCase();
    if (!key || !value) return;
    setForm((state) => state && ({ ...state, technicalAttributes: { ...state.technicalAttributes, [key]: value } }));
    setNewTechnicalKey("");
    setNewTechnicalValue("");
  };
  return (
  <Modal title={`Partida ${item.position}`} subtitle={item.description} onClose={onClose}>
    <form onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Norma" value={form.standard} onChange={(standard) => setForm((state) => state && ({ ...state, standard }))} />
        <Field label="Diámetro" value={form.diameter} onChange={(diameter) => setForm((state) => state && ({ ...state, diameter }))} />
        <Field label="Espesor" value={form.thickness} onChange={(thickness) => setForm((state) => state && ({ ...state, thickness }))} />
        <Field label="Bore" value={form.bore} onChange={(bore) => setForm((state) => state && ({ ...state, bore }))} />
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Datos técnicos variables</p><button type="button" disabled={suggestingTechnical} onClick={() => void suggestTechnical()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{suggestingTechnical ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Completar con IA</button></div>
          <select value={form.technicalFamily} onChange={(event) => setForm((state) => state && ({ ...state, technicalFamily: event.target.value }))} className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {[['PIPE','Tubería'],['VALVE','Válvula'],['FITTING','Conexión'],['FLANGE','Brida'],['GASKET','Empaque'],['FASTENER','Tornillería'],['OTHER','Otro']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(form.technicalAttributes).map(([key, value]) => <label key={key} className="text-[11px] font-semibold text-slate-500">{key.replaceAll('_', ' ')}<input value={value} onChange={(event) => setForm((state) => state && ({ ...state, technicalAttributes: { ...state.technicalAttributes, [key]: event.target.value.toUpperCase() } }))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" /></label>)}</div>
          <div className="mt-3 flex gap-2"><input value={newTechnicalKey} onChange={(event) => setNewTechnicalKey(event.target.value)} placeholder="Nuevo campo" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs" /><input value={newTechnicalValue} onChange={(event) => setNewTechnicalValue(event.target.value)} placeholder="Valor" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs" /><button type="button" onClick={addTechnicalAttribute} className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950">Agregar</button></div>
        </div>
        <Field label="Costo unitario del vendedor *" type="number" value={form.sellerUnitCost} onChange={(sellerUnitCost) => setForm((state) => state && ({ ...state, sellerUnitCost }))} />
        <Select label="Moneda *" value={form.sellerCurrency} onChange={(sellerCurrency) => setForm((state) => state && ({ ...state, sellerCurrency: sellerCurrency as Currency }))} options={[["MXN", "MXN"], ["USD", "USD"]]} />
        <Select label="Origen del costo *" value={form.sellerCostSource} onChange={(sellerCostSource) => setForm((state) => state && ({ ...state, sellerCostSource: sellerCostSource as ItemForm["sellerCostSource"] }))} options={[["ERP_COST", "Costo ERP"], ["SELLER_SUPPLIER_QUOTE", "Cotización del vendedor"], ["ESTIMATED", "Estimado"]]} />
        <Select label="Marca cotizada" value={form.sellerBrand} onChange={(sellerBrand) => setForm((state) => state && ({ ...state, sellerBrand }))} options={[["", "Seleccionar"], ...brands.map((option) => [catalogValue(option), option.label] as [string, string])]} />
        <Select label="Tiempo de entrega *" value={form.sellerDeliveryTime} onChange={(sellerDeliveryTime) => setForm((state) => state && ({ ...state, sellerDeliveryTime }))} options={[["", "Seleccionar"], ...deliveryTimes.map((option) => [catalogValue(option), option.label] as [string, string])]} />
        <Select label="Estado de entrega *" value={form.deliveryPlace} onChange={(deliveryPlace) => setForm((state) => state && ({ ...state, deliveryPlace }))} options={[["", "Seleccionar"], ...deliveryStates.map((option) => [catalogValue(option), option.label] as [string, string])]} />
        <fieldset className="rounded-lg border border-slate-200 p-3 sm:col-span-2"><legend className="px-1 text-xs font-semibold text-slate-600">Restricción de origen</legend><div className="flex flex-wrap gap-2">{restrictions.map((option) => { const value = catalogValue(option); const selected = form.originRestrictions.includes(value); return <button key={option.id} type="button" onClick={() => toggleRestriction(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-300 bg-white text-slate-600"}`}>{option.label}</button>; })}</div></fieldset>
      </div>
      <ModalActions busy={busy} onClose={onClose} label="Guardar partida" />
    </form>
  </Modal>
  );
};

const OfferModal = ({ item, form, setForm, suppliers, brands, origins, deliveryTimes, busy, attachmentFile, onAttachmentFile, onNewSupplier, onClose, onSubmit }: {
  item: RequisitionItem;
  form: OfferForm;
  setForm: React.Dispatch<React.SetStateAction<OfferForm | null>>;
  suppliers: Supplier[];
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  busy: boolean;
  attachmentFile: File | null;
  onAttachmentFile: (file: File | null) => void;
  onNewSupplier: (initialValues?: Partial<SaveSupplierInput>) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) => (
  <SupplierOfferModal
    mode="PURCHASING"
    itemDescription={item.description}
    value={form}
    onChange={(value) => setForm(value)}
    suppliers={suppliers}
    brands={brands}
    origins={origins}
    deliveryTimes={deliveryTimes}
    busy={busy}
    attachmentFile={attachmentFile}
    onAttachmentFile={onAttachmentFile}
    onNewSupplier={onNewSupplier}
    onClose={onClose}
    onSubmit={onSubmit}
  />
);

const PurchaseOfferAttachmentModal = ({ requisition, busy, onClose, onSubmit }: {
  requisition: PurchaseRequisition;
  busy: boolean;
  onClose: () => void;
  onSubmit: (file: File, offerIds: string[]) => Promise<boolean>;
}) => {
  const offers = requisition.items.flatMap((item) => item.offers.map((offer) => ({ item, offer })));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(offers.map(({ offer }) => offer.id)));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (offerId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(offerId)) next.delete(offerId);
    else next.add(offerId);
    return next;
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return setError("Selecciona el archivo de la propuesta.");
    if (selectedIds.size === 0) return setError("Selecciona al menos una propuesta.");
    setSaving(true);
    setError("");
    const saved = await onSubmit(file, [...selectedIds]);
    if (!saved) setSaving(false);
  };

  return (
    <Modal title="Adjuntar archivo a propuestas" subtitle="Un mismo archivo se guardará una vez y quedará ligado a todas las propuestas seleccionadas." onClose={onClose}>
      <form onSubmit={submit}>
        <label className="block rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-amber-700" />Archivo *</span>
          <input type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp" disabled={saving || busy} onChange={(event) => setFile(event.currentTarget.files?.[0] || null)} className="mt-3 w-full text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950" />
        </label>

        <div className="mt-4 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {offers.map(({ item, offer }) => (
            <label key={offer.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.has(offer.id)} disabled={saving || busy} onChange={() => toggle(offer.id)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-900">Partida {item.position} · {offer.supplier.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{item.description} · {money(offer.unitCost, offer.currency)}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
        <ModalActions busy={saving || busy} onClose={onClose} label={`Adjuntar a ${selectedIds.size} propuesta(s)`} />
      </form>
    </Modal>
  );
};

const Modal = ({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 line-clamp-2 text-xs text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      {children}
    </div>
  </div>
);

const ModalActions = ({ busy, onClose, label }: { busy: boolean; onClose: () => void; label: string }) => (
  <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
    <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancelar</button>
    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button>
  </div>
);

const Field = ({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) => (
  <label className="text-xs font-semibold text-slate-600">{label}<input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.0001" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-amber-500" /></label>
);

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) => (
  <label className="text-xs font-semibold text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
);

const StatusBadge = ({ status }: { status: RequisitionStatus }) => (
  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS[status].color}`}>{STATUS[status].label}</span>
);

const Info = ({ label, value }: { label: string; value: string }) => <div><p className="uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>;
const InfoBlock = ({ label, value }: { label: string; value: string }) => <div className="bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-semibold text-slate-800">{value}</p></div>;
const Empty = ({ icon, text, large = false }: { icon: React.ReactNode; text: string; large?: boolean }) => <div className={`flex flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 ${large ? "min-h-[650px]" : "px-6 py-16"}`}><span className="text-slate-400">{icon}</span>{text}</div>;
