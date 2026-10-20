import {
  ArrowRight,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Loader2,
  PackageCheck,
  Paperclip,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  type Currency,
  type PurchaseRequisition,
  PurchaseRequisitionsService,
  type ProcurementUser,
  type RequisitionItem,
  type RequisitionStatus,
  type SaveOfferInput,
  type SaveSupplierInput,
  type Supplier,
  type UpdateRequisitionDocumentInput,
} from "../../modules/procurement/services/purchase-requisitions.service";
import { RequisitionPaperCard } from "./requisition-paper-card";
import { RequisitionItemPage } from "./requisition-item.page";
import { requisitionSupplierSummary } from "../../modules/procurement/utils/requisition-supplier-display";
import {
  usePurchaseRequisition,
  usePurchaseRequisitionMutations,
  usePurchaseRequisitions,
  useSuppliers,
} from "../../queries/procurement/use-purchase-requisitions";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";
import { useQuoteCatalogs } from "../../queries/quote-catalogs/use-quote-catalogs";
import type { QuoteCatalogOption } from "../../modules/quote-catalogs/services/quote-catalogs.service";
import { AddErpProductsModal } from "../../shared/components/modals/add-erp-products.modal";
import type { ErpProduct } from "../../modules/products/types/erp-product.types";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";
import { useRequisitionAttachments } from "../../queries/attachments/use-attachments";
import { AttachmentsModal } from "../../shared/components/attachments/attachments.modal";
import { AttachmentsPanel } from "../../shared/components/attachments/attachments-panel";
import { PdfAttachmentViewerModal } from "../../shared/components/attachments/pdf-attachment-viewer.modal";
import { AttachmentsService, type FileAttachment } from "../../modules/attachments/services/attachments.service";
import { TechnicalDataService } from "../../modules/procurement/services/technical-data.service";
import { SelectOrCreateSupplierModal } from "../../shared/components/modals/select-or-create-supplier.modal";
import { SupplierOfferModal, type SupplierOfferFormValue } from "../../shared/components/modals/supplier-offer.modal";
import { SellerProcurementPrequoteModal } from "../../shared/components/modals/seller-procurement-prequote.modal";
import { SellerProcurementBulkPrequoteModal } from "../../shared/components/modals/seller-procurement-bulk-prequote.modal";
import { useQuoteDetail, useUpdateQuoteProcurementReference } from "../../queries/quotes/use-quote-detail";
import type { ProcurementPrequoteData, ProcurementPrequoteUpdate } from "../../store/quote/manual-quote.store";
import { savedQuoteItemRequiresPurchase, toManualQuoteItem } from "../../modules/quotes/utils/saved-quote-item";
import { TechnicalDataEditor, type TechnicalDataFormValue } from "../../shared/components/procurement/technical-data-editor";
import { downloadSupplierRequisition } from "../../modules/procurement/utils/requisition-document-pdf";

const PAGE_SIZE = 15;
const PurchaseOffersBatchModal = lazy(() => import("./purchase-offers-batch.modal").then((module) => ({ default: module.PurchaseOffersBatchModal })));

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
  sellerCostSource: "ERP_COST" | "SELLER_SUPPLIER_QUOTE" | "PRICE_LIST" | "ESTIMATED";
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

const offerForm = (item: RequisitionItem, quoteExchangeRate: number): OfferForm => ({
  supplierId: "",
  supplierName: "",
  supplierDescription: "",
  supplierProductCode: "",
  qty: String(item.qty),
  unit: item.unit,
  unitCost: "",
  currency: item.sellerCurrency,
  exchangeRate: quoteExchangeRate > 0 ? String(quoteExchangeRate) : "",
  brand: item.sellerBrand || "",
  origin: "",
  deliveryTime: item.sellerDeliveryTime || "",
  validUntil: "",
  quoteDate: new Date().toISOString().slice(0, 10),
  externalReference: "",
  notes: "",
});

const catalogValue = (option: QuoteCatalogOption): string => option.value || option.label;

export const PurchaseRequisitionsPage = () => {
  const { requisitionId, itemId } = useParams<{ requisitionId: string; itemId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = requisitionId || null;
  const search = searchParams.get("search") || "";
  const statusParam = searchParams.get("status");
  const status: RequisitionStatus | "ALL" = statusParam && statusParam in STATUS
    ? statusParam as RequisitionStatus
    : "ALL";
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const returnTo = `${location.pathname}${location.search}`;
  const savedReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const backTo = typeof savedReturnTo === "string" && (savedReturnTo === "/procurement" || savedReturnTo.startsWith("/procurement?") || /^\/quotes\/[A-Za-z0-9-]+$/.test(savedReturnTo))
    ? savedReturnTo
    : "/procurement";
  const setListParam = (key: "search" | "status" | "page", value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || (key === "status" && value === "ALL") || (key === "page" && value === "1")) next.delete(key);
      else next.set(key, value);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: key !== "page" });
  };
  const user = useAuthStore((state) => state.user);
  const capabilities = useSystemCapabilities();
  const role = (user?.role || "").toUpperCase();
  const [editingItem, setEditingItem] = useState<RequisitionItem | null>(null);
  const [editingItemForm, setEditingItemForm] = useState<ItemForm | null>(null);
  const [linkingItem, setLinkingItem] = useState<RequisitionItem | null>(null);
  const [offerItem, setOfferItem] = useState<RequisitionItem | null>(null);
  const [currentOfferForm, setCurrentOfferForm] = useState<OfferForm | null>(null);
  const [offerAttachmentFile, setOfferAttachmentFile] = useState<File | null>(null);
  const [showOfferAttachmentModal, setShowOfferAttachmentModal] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [sellerProcurementItemId, setSellerProcurementItemId] = useState<string | null>(null);
  const [showSellerBulkProcurement, setShowSellerBulkProcurement] = useState(false);
  const [showBuyerBulkOffers, setShowBuyerBulkOffers] = useState(false);
  const [editingBuyerQuoteId, setEditingBuyerQuoteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [supplierInitialValues, setSupplierInitialValues] = useState<Partial<SaveSupplierInput> | undefined>();
  const debouncedSearch = useDebouncedValue(search, 350);
  const list = usePurchaseRequisitions({ page, pageSize: PAGE_SIZE, search: debouncedSearch, status }, !selectedId);
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
    queryKey: ["purchase-requisitions", "buyers", selectedId],
    queryFn: () => PurchaseRequisitionsService.listBuyers(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 30_000,
  });
  const requisition = detail.data || null;
  const sourceQuote = useQuoteDetail(requisition?.quoteId);
  const updateProcurementReference = useUpdateQuoteProcurementReference();
  const sellerProcurementItems = useMemo(
    () => {
      const requisitionClientIds = new Set((requisition?.items || []).map((item) => item.quoteClientItemId));
      return (sourceQuote.data?.items || [])
        .filter((item) => requisitionClientIds.has(item.id) && savedQuoteItemRequiresPurchase(item))
        .map(toManualQuoteItem);
    },
    [sourceQuote.data, requisition],
  );
  const sellerProcurementItem = sellerProcurementItemId
    ? sellerProcurementItems.find((item) => item.id === sellerProcurementItemId) || null
    : null;

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
      for (const offer of item.offers) {
        if (!offer.isSelected) continue;
        const qty = offer.awardedQty ?? item.qty;
        sum[offer.currency] += qty * offer.unitCost * (1 + offer.taxRate);
      }
      return sum;
    }, { MXN: 0, USD: 0 }) || { MXN: 0, USD: 0 },
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

  const deleteRequisition = async () => {
    if (!requisition || deleteConfirmation !== requisition.requisitionNumber) return;
    const deleted = await run(
      "Eliminando requisición...",
      () => mutations.deletePermanently.mutateAsync({ id: requisition.id, confirmation: deleteConfirmation }),
      "Requisición eliminada. La cotización y los datos capturados por el vendedor permanecen.",
    );
    if (!deleted) return;
    setDeleteOpen(false);
    setDeleteConfirmation("");
    navigate(backTo, { replace: true });
  };

  const openItem = (item: RequisitionItem) => {
    setEditingItem(item);
    setEditingItemForm(itemForm(item));
  };

  const openSellerProcurementItem = (item: RequisitionItem) => {
    if (!item.quoteClientItemId) {
      notifier.error("La partida no conserva el identificador de la cotización.");
      return;
    }
    if (!sellerProcurementItems.some((quoteItem) => quoteItem.id === item.quoteClientItemId)) {
      notifier.error("No se encontró la partida original de la cotización.");
      return;
    }
    setSellerProcurementItemId(item.quoteClientItemId);
  };

  const saveSellerProcurementReference = async (itemId: string, input: ProcurementPrequoteData) => {
    if (!requisition) return;
    const saved = await run(
      "Guardando referencia de compra...",
      () => updateProcurementReference.mutateAsync({ quoteId: requisition.quoteId, itemId, input }),
      "Referencia de compra guardada.",
    );
    if (!saved) throw new Error("No se pudo guardar la referencia de compra.");
    await Promise.all([detail.refetch(), sourceQuote.refetch()]);
    setSellerProcurementItemId(null);
  };

  const saveSellerBulkProcurement = async (updates: ProcurementPrequoteUpdate[]) => {
    if (!requisition) return;
    const saved = await run(
      `Guardando ${updates.length} referencia(s) de compra...`,
      async () => {
        for (const update of updates) {
          await updateProcurementReference.mutateAsync({
            quoteId: requisition.quoteId,
            itemId: update.itemId,
            input: update.data,
          });
        }
      },
      "Referencias de compra guardadas.",
    );
    if (!saved) throw new Error("No se pudieron guardar todas las referencias de compra.");
    await Promise.all([detail.refetch(), sourceQuote.refetch()]);
    setShowSellerBulkProcurement(false);
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

  const saveOffer = async (event: React.FormEvent, technical: TechnicalDataFormValue, restrictions: string[]) => {
    event.preventDefault();
    if (!requisition || !offerItem || !currentOfferForm) return;
    const qty = Number(currentOfferForm.qty);
    const unitCost = Number(currentOfferForm.unitCost);
    const taxRate = currentOfferForm.documentTaxRate === null || currentOfferForm.documentTaxRate === undefined
      ? 0.16
      : currentOfferForm.documentTaxRate > 1 ? currentOfferForm.documentTaxRate / 100 : currentOfferForm.documentTaxRate;
    const documentSubtotal = currentOfferForm.documentSubtotal ?? qty * unitCost;
    const taxableAmount = Math.max(0, documentSubtotal
      - (currentOfferForm.documentDiscount || 0)
      + (currentOfferForm.documentFreight || 0)
      + (currentOfferForm.documentOtherCharges || 0));
    const hasDocumentAdjustments = Boolean(currentOfferForm.documentSubtotal !== null && currentOfferForm.documentSubtotal !== undefined
      || currentOfferForm.documentDiscount || currentOfferForm.documentFreight
      || currentOfferForm.documentOtherCharges || currentOfferForm.taxIncluded
      || currentOfferForm.documentTax !== null && currentOfferForm.documentTax !== undefined);
    const calculatedTax = currentOfferForm.taxIncluded
      ? taxableAmount - taxableAmount / (1 + taxRate)
      : taxableAmount * taxRate;
    const documentTax = currentOfferForm.documentTax ?? calculatedTax;
    const input: SaveOfferInput = {
      supplierId: currentOfferForm.supplierId,
      supplierProductCode: currentOfferForm.supplierProductCode || null,
      alternateCodes: currentOfferForm.alternateCodes || [],
      supplierDescription: currentOfferForm.supplierDescription,
      qty,
      unit: currentOfferForm.unit || null,
      listUnitPrice: currentOfferForm.listUnitPrice ?? null,
      discountPct: currentOfferForm.discountPct ?? null,
      unitCost,
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
      taxRate,
      documentTax: currentOfferForm.documentTax ?? (hasDocumentAdjustments ? Number(calculatedTax.toFixed(4)) : null),
      documentTotal: currentOfferForm.documentTotal ?? (hasDocumentAdjustments
        ? Number((taxableAmount + (currentOfferForm.taxIncluded ? 0 : documentTax)).toFixed(4))
        : null),
      notes: currentOfferForm.notes,
    };
    if (!input.supplierId || currentOfferForm.unitCost.trim() === "" || !Number.isFinite(input.qty) || input.qty <= 0 || !Number.isFinite(input.unitCost) || input.unitCost < 0) {
      notifier.warning("Completa proveedor, cantidad y costo.");
      return;
    }
    if (!restrictions.length) return notifier.warning("Selecciona una restricción o Sin restricción.");
    if (!currentOfferForm.origin.trim()) return notifier.warning("Selecciona el origen del material.");
    if (!currentOfferForm.deliveryTime.trim()) return notifier.warning("Selecciona el plazo de entrega.");
    if (currentOfferForm.currency !== "MXN" && currentOfferForm.currency !== "USD") return notifier.warning("Selecciona la moneda.");
    if (currentOfferForm.currency === "USD" && (!Number.isFinite(Number(currentOfferForm.exchangeRate)) || Number(currentOfferForm.exchangeRate) <= 0)) return notifier.warning("Captura un tipo de cambio válido.");
    const previousOfferIds = new Set(offerItem.offers.map((offer) => offer.id));
    const targetItemId = offerItem.id;
    const toast = notifier.loading(offerAttachmentFile ? "Registrando propuesta y archivo..." : "Registrando propuesta...");
    try {
      const originalTechnical = {
        standard: offerItem.standard || "",
        diameter: offerItem.diameter || "",
        thickness: offerItem.thickness || "",
        bore: offerItem.bore || "",
        technicalFamily: offerItem.technicalFamily || "OTHER",
        technicalAttributes: offerItem.technicalAttributes || {},
      };
      if (JSON.stringify(technical) !== JSON.stringify(originalTechnical) || JSON.stringify(restrictions) !== JSON.stringify(offerItem.originRestrictions)) {
        await mutations.updateItem.mutateAsync({ id: requisition.id, itemId: targetItemId, input: { ...technical, originRestrictions: restrictions } });
      }
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
          <h1 className="mt-1 text-2xl font-bold text-slate-950">{itemId ? "Gestión de partida" : selectedId ? "Expediente de compra" : "Requisiciones de compra"}</h1>
          <p className="mt-1 text-sm text-slate-500">{itemId ? "Consulta el material, sus documentos y las propuestas del proveedor." : selectedId ? "Consulta y completa la requisición seleccionada." : "Solicitudes de precio y compras de cotizaciones con material nuevo o sin existencia."}</p>
        </div>
        {canBuy && (
          <NavLink to="/procurement/products" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            Productos locales históricos <ArrowRight className="h-4 w-4" />
          </NavLink>
        )}
      </header>

      {!selectedId ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setListParam("search", event.target.value)}
                placeholder="Folio, cliente o material..."
                aria-label="Buscar requisiciones"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setListParam("status", event.target.value)}
              aria-label="Filtrar por estado"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:w-56"
            >
              <option value="ALL">Todos los estados</option>
              {Object.entries(STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </div>

          {list.isLoading && <Empty icon={<Loader2 className="h-6 w-6 animate-spin" />} text="Cargando requisiciones..." />}
          {list.isError && <Empty icon={<ClipboardList className="h-7 w-7" />} text="No se pudieron cargar las requisiciones." />}
          {!list.isLoading && !list.isError && !list.data?.items.length && <Empty icon={<ClipboardList className="h-7 w-7" />} text="No hay requisiciones para este filtro." />}
          {Boolean(list.data?.items.length) && !list.isError && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Requisición</th>
                    <th scope="col" className="px-4 py-3">Cotización</th>
                    <th scope="col" className="px-4 py-3">Cliente</th>
                    <th scope="col" className="px-4 py-3">Proveedor</th>
                    <th scope="col" className="px-4 py-3">Sucursal</th>
                    <th scope="col" className="px-4 py-3">Solicitó</th>
                    <th scope="col" className="px-4 py-3">Comprador</th>
                    <th scope="col" className="px-4 py-3 text-center">Partidas</th>
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3">Actualizada</th>
                    <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Abrir detalle</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.data?.items.map((item) => (
                    <tr key={item.id} onClick={() => navigate(`/procurement/${item.id}`, { state: { returnTo } })} className="cursor-pointer transition-colors hover:bg-amber-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <NavLink to={`/procurement/${item.id}`} state={{ returnTo }} onClick={(event) => event.stopPropagation()} className="rounded-sm hover:text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">{item.requisitionNumber}</NavLink>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.quoteNumber}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-slate-800" title={item.customerName}>{item.customerName}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-slate-800" title={requisitionSupplierSummary(item.items, item.supplierName)}>{requisitionSupplierSummary(item.items, item.supplierName)}</td>
                      <td className="px-4 py-3 text-slate-600">{item.branchName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.requestedBy.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.assignedBuyer?.fullName || "Sin asignar"}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-700">{item.items.length}</td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{date(item.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <NavLink to={`/procurement/${item.id}`} state={{ returnTo }} onClick={(event) => event.stopPropagation()} aria-label={`Abrir requisición ${item.requisitionNumber}`} className="inline-flex rounded-md p-1.5 text-slate-500 hover:bg-amber-100 hover:text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><ArrowRight className="h-4 w-4" /></NavLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <span>{list.data?.total || 0} registros · Página {page} de {list.data?.totalPages || 1}</span>
            <div className="flex gap-2">
              <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setListParam("page", String(page - 1))} className="rounded-md border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Página siguiente" disabled={page >= (list.data?.totalPages || 1)} onClick={() => setListParam("page", String(page + 1))} className="rounded-md border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>
      ) : (
        <section className="min-h-[650px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {detail.isLoading && <Empty icon={<Loader2 className="h-7 w-7 animate-spin" />} text="Cargando expediente..." large />}
          {detail.isError && <div><Empty icon={<ClipboardList className="h-7 w-7" />} text="No se pudo cargar esta requisición." /><div className="pb-8 text-center"><NavLink to={backTo} className="text-sm font-semibold text-amber-800 hover:underline">Volver al listado</NavLink></div></div>}
          {requisition && (
            <RequisitionDetail
              requisition={requisition}
              itemId={itemId}
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
              onBulkSellerReference={() => setShowSellerBulkProcurement(true)}
              onBulkBuyerOffers={() => { setEditingBuyerQuoteId(null); setShowBuyerBulkOffers(true); }}
              onEditSupplierReference={(supplierQuoteId) => { setEditingBuyerQuoteId(supplierQuoteId); setShowBuyerBulkOffers(true); }}
              onBack={() => navigate(backTo)}
              onOpenItem={(item) => navigate(`/procurement/${requisition.id}/items/${item.id}`, { state: { returnTo: backTo } })}
              onBackToRequisition={() => navigate(`/procurement/${requisition.id}`, { state: { returnTo: backTo } })}
              onEdit={(item) => role === "SELLER" && item.quotationOwner === "SELLER" ? openSellerProcurementItem(item) : openItem(item)}
              onSaveDocument={(input) => run(
                "Guardando referencias...",
                () => mutations.updateDocument.mutateAsync({ id: requisition.id, input }),
                "Referencias actualizadas.",
              )}
              onSaveSupplierCode={(itemId, offerId, supplierProductCode) => run(
                "Guardando código del proveedor...",
                () => mutations.updateSupplierCode.mutateAsync({ id: requisition.id, itemId, offerId, supplierProductCode }),
                "Código del proveedor actualizado.",
              )}
              onLinkErp={setLinkingItem}
              onOffer={(item) => { setOfferItem(item); setCurrentOfferForm(offerForm(item, requisition.quoteExchangeRate)); }}
              onSelect={(itemId, offerId) => run(
                "Seleccionando propuesta...",
                () => mutations.selectOffer.mutateAsync({ id: requisition.id, itemId, offerId }),
                "Propuesta seleccionada.",
              )}
              onAllocate={(itemId, allocations) => run(
                "Repartiendo partida...",
                () => mutations.allocateOffers.mutateAsync({ id: requisition.id, itemId, allocations }),
                "Partida adjudicada entre proveedores.",
              )}
              onFinalizePrices={() => run(
                "Aplicando costos de Compras...",
                () => mutations.finalizePricesForQuote.mutateAsync({ quoteId: requisition.quoteId }),
                "Costos aplicados a la cotización. Se avisó al vendedor si no había recibido este cierre.",
              )}
              onGenerate={() => run(
                "Generando requisiciones por proveedor...",
                () => mutations.generateSupplierRequisitions.mutateAsync(requisition.id),
                "Requisiciones por proveedor generadas.",
              )}
              onSubmit={(buyerUserId) => run(
                "Enviando requisición a Compras...",
                () => mutations.submit.mutateAsync({ id: requisition.id, buyerUserId }),
                "Requisición enviada a Compras.",
              )}
              onApproveCost={() => run(
                "Aprobando variación de costo...",
                () => mutations.approveCostVariance.mutateAsync(requisition.id),
                "Variación de costo aprobada.",
              )}
              canBuy={canBuy}
              localPurchaseWithoutErpCodeEnabled={capabilities.data?.localPurchaseWithoutErpCodeEnabled ?? false}
              canApproveCost={canApproveCost}
              buyers={buyers.data || []}
              buyersLoading={buyers.isPending}
              buyersError={buyers.isError}
              onAssign={(buyerUserId) => run(
                "Asignando comprador...",
                () => mutations.assign.mutateAsync({ id: requisition.id, buyerUserId }),
                "Comprador asignado.",
              )}
              onDelete={role === "ADMIN" ? () => { setDeleteConfirmation(""); setDeleteOpen(true); } : undefined}
            />
          )}
        </section>
      )}

      <Dialog open={deleteOpen && role === "ADMIN" && Boolean(requisition)} onClose={mutations.deletePermanently.isPending ? undefined : () => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Eliminar requisición de compra</DialogTitle>
        <DialogContent dividers className="space-y-4">
          <Alert severity="warning">Esta acción elimina la requisición, sus partidas, propuestas, documentos por proveedor y archivos exclusivos de Compras. No elimina la cotización, los datos de compra capturados por el vendedor ni los archivos ligados a la cotización. No está disponible si ya existe un pedido ERP o archivo de pedido generado.</Alert>
          <p className="text-sm text-slate-700">Para confirmar, escribe el folio <strong>{requisition?.requisitionNumber}</strong>.</p>
          <TextField fullWidth size="small" label="Folio de la requisición" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={mutations.deletePermanently.isPending} autoComplete="off" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={mutations.deletePermanently.isPending}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => void deleteRequisition()} disabled={mutations.deletePermanently.isPending || deleteConfirmation !== requisition?.requisitionNumber}>Eliminar definitivamente</Button>
        </DialogActions>
      </Dialog>

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
      {sellerProcurementItem && sourceQuote.data && (
        <SellerProcurementPrequoteModal
          item={sellerProcurementItem}
          clientDraftId={sourceQuote.data.quoteDraftId}
          quoteCurrency={sourceQuote.data.currency}
          quoteExchangeRate={sourceQuote.data.exchangeRate}
          onClose={() => { if (!updateProcurementReference.isPending) setSellerProcurementItemId(null); }}
          onSave={(input) => saveSellerProcurementReference(sellerProcurementItem.id, input)}
        />
      )}
      {showSellerBulkProcurement && sourceQuote.data && sellerProcurementItems.length > 0 && (
        <SellerProcurementBulkPrequoteModal
          items={sellerProcurementItems}
          clientDraftId={sourceQuote.data.quoteDraftId}
          quoteExchangeRate={sourceQuote.data.exchangeRate}
          onClose={() => { if (!updateProcurementReference.isPending) setShowSellerBulkProcurement(false); }}
          onSave={saveSellerBulkProcurement}
        />
      )}
      {showBuyerBulkOffers && requisition && (
        <Suspense fallback={<Dialog open><DialogTitle>Cargando captura por lotes...</DialogTitle></Dialog>}>
          <PurchaseOffersBatchModal
            key={editingBuyerQuoteId || "new"}
            requisition={requisition}
            editingSupplierQuoteId={editingBuyerQuoteId}
            onClose={() => { setShowBuyerBulkOffers(false); setEditingBuyerQuoteId(null); }}
            onSaved={() => { void detail.refetch(); void requisitionAttachments.refetch(); }}
          />
        </Suspense>
      )}
      {requisition && offerItem && currentOfferForm && (
        <OfferModal
          key={offerItem.id}
          requisition={requisition}
          item={offerItem}
          form={currentOfferForm}
          setForm={setCurrentOfferForm}
          suppliers={suppliers.data || []}
          brands={brandCatalog.data || []}
          origins={(restrictionCatalog.data || []).filter((option) => option.code !== "NO_RESTRICTION")}
          restrictionOptions={restrictionCatalog.data || []}
          deliveryTimes={deliveryTimeCatalog.data || []}
          attachments={(requisitionAttachments.data || []).filter((file) => file.category === "SELLER_SUPPLIER_QUOTE"
            ? Boolean(offerItem.quoteClientItemId && file.clientItemIds.includes(offerItem.quoteClientItemId))
            : file.category === "PURCHASE_SUPPLIER_PROPOSAL" && file.purchaseOfferIds.some((offerId) => offerItem.offers.some((offer) => offer.id === offerId)))}
          attachmentsLoading={requisitionAttachments.isLoading}
          busyAttachmentId={busyAttachmentId}
          onDownloadAttachment={(file) => { void downloadAttachment(file); }}
          onDeleteAttachment={(file) => { void deleteAttachment(file); }}
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
  itemId,
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
  onBulkSellerReference,
  onBulkBuyerOffers,
  onEditSupplierReference,
  onBack,
  onOpenItem,
  onBackToRequisition,
  onEdit,
  onSaveDocument,
  onSaveSupplierCode,
  onLinkErp,
  onOffer,
  onSelect,
  onAllocate,
  onFinalizePrices,
  onGenerate,
  onSubmit,
  onApproveCost,
  canBuy,
  localPurchaseWithoutErpCodeEnabled,
  canApproveCost,
  buyers,
  buyersLoading,
  buyersError,
  onAssign,
  onDelete,
}: {
  requisition: PurchaseRequisition;
  itemId?: string;
  role: string;
  currentUserId: string;
  selectedCosts: Record<Currency, number>;
  busy: boolean;
  attachments: FileAttachment[];
  attachmentsLoading: boolean;
  attachmentItemLabels: Record<string, string>;
  attachmentOfferLabels: Record<string, string>;
  busyAttachmentId: string | null;
  onDownloadAttachment: (file: FileAttachment) => void;
  onDeleteAttachment: (file: FileAttachment) => void;
  onAttachOffers: () => void;
  onBulkSellerReference: () => void;
  onBulkBuyerOffers: () => void;
  onEditSupplierReference: (supplierQuoteId: string) => void;
  onBack: () => void;
  onOpenItem: (item: RequisitionItem) => void;
  onBackToRequisition: () => void;
  onEdit: (item: RequisitionItem) => void;
  onSaveDocument: (input: UpdateRequisitionDocumentInput) => Promise<boolean>;
  onSaveSupplierCode: (itemId: string, offerId: string, code: string | null) => Promise<boolean>;
  onLinkErp: (item: RequisitionItem) => void;
  onOffer: (item: RequisitionItem) => void;
  onSelect: (itemId: string, offerId: string) => Promise<boolean>;
  onAllocate: (itemId: string, allocations: Array<{ offerId: string; qty: number }>) => Promise<boolean>;
  onFinalizePrices: () => Promise<boolean>;
  onGenerate: () => Promise<boolean>;
  onSubmit: (buyerUserId: string) => Promise<boolean>;
  onApproveCost: () => Promise<boolean>;
  canBuy: boolean;
  localPurchaseWithoutErpCodeEnabled: boolean;
  canApproveCost: boolean;
  buyers: ProcurementUser[];
  buyersLoading: boolean;
  buyersError: boolean;
  onAssign: (buyerUserId: string) => Promise<boolean>;
  onDelete?: () => void;
}) => {
  const sellerDraft = role === "SELLER" && requisition.status === "DRAFT";
  const hasOffers = requisition.items.some((item) => item.offers.length > 0);
  const purchasingQuotes = [...new Map(requisition.items.flatMap((item) => item.offers
    .filter((offer) => offer.source === "PURCHASING" && offer.supplierQuoteId)
    .map((offer) => [offer.supplierQuoteId!, offer] as const))).entries()].map(([id, offer]) => ({
      id, offer,
      lines: requisition.items.flatMap((item) => item.offers
        .filter((entry) => entry.source === "PURCHASING" && entry.supplierQuoteId === id)
        .map((entry) => ({ item, offer: entry }))),
    }));
  const localReadyForSupplierDocument = (item: RequisitionItem) => localPurchaseWithoutErpCodeEnabled
    && item.source === "LOCAL_NEW"
    && !item.erpCode?.trim()
    && item.status === "PENDING_ERP_CODE";
  const supplierDocumentsReady = requisition.items.length > 0
    && requisition.items.every((item) => item.status === "READY" || localReadyForSupplierDocument(item))
    && requisition.items.every((item) => item.offers.some((offer) => offer.isSelected))
    && (["READY_FOR_ORDER", "COMPLETED"].includes(requisition.status)
      || (requisition.status === "PARTIALLY_QUOTED" && requisition.items.some(localReadyForSupplierDocument)));
  const [attachmentView, setAttachmentView] = useState<{
    type: "ALL" | "SELLER_ITEM";
    clientItemId?: string;
    position?: number;
  } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const visibleAttachments = attachmentView?.type === "SELLER_ITEM"
    ? attachments.filter((file) => file.category === "SELLER_SUPPLIER_QUOTE"
      && Boolean(attachmentView.clientItemId)
      && file.clientItemIds.includes(attachmentView.clientItemId!))
    : attachments;
  const attachmentModalTitle = attachmentView?.type === "SELLER_ITEM"
    ? `Archivos cotizados por el vendedor · Partida ${attachmentView.position}`
    : `Expediente de ${requisition.requisitionNumber}`;
  if (itemId) {
    const item = requisition.items.find((entry) => entry.id === itemId);
    if (!item) return <div className="p-6 text-sm text-slate-600">No se encontró esta partida. <button type="button" onClick={onBackToRequisition} className="font-semibold text-blue-700 hover:underline">Volver a la requisición</button></div>;
    return <RequisitionItemPage
      requisition={requisition}
      item={item}
      role={role}
      currentUserId={currentUserId}
      canBuy={canBuy}
      busy={busy}
      localPurchaseWithoutErpCodeEnabled={localPurchaseWithoutErpCodeEnabled}
      attachments={attachments}
      attachmentsLoading={attachmentsLoading}
      attachmentItemLabels={attachmentItemLabels}
      attachmentOfferLabels={attachmentOfferLabels}
      busyAttachmentId={busyAttachmentId}
      onDownloadAttachment={onDownloadAttachment}
      onDeleteAttachment={onDeleteAttachment}
      onBack={onBackToRequisition}
      onEdit={onEdit}
      onLinkErp={onLinkErp}
      onOffer={onOffer}
      onSelect={onSelect}
      onAllocate={onAllocate}
    />;
  }
  return (
    <div className="flex h-full min-h-[650px] flex-col">
      <header className="border-b border-slate-200 px-5 py-4">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-slate-600 hover:text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><ChevronLeft className="h-4 w-4" />Volver a requisiciones</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">{requisition.requisitionNumber}</h2>
              <StatusBadge status={requisition.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{requisition.customerName}</p>
            <p className="mt-1 text-sm font-medium text-amber-800">Proveedor: {requisitionSupplierSummary(requisition.items, requisition.supplierName)}</p>
            <p className="mt-1 text-xs text-slate-500">{requisition.branchName} · Solicitó {requisition.requestedBy.fullName}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <NavLink to={`/quotes/${requisition.quoteId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
              Ver {requisition.quoteNumber}<ExternalLink className="h-3.5 w-3.5" />
            </NavLink>
            <button type="button" onClick={() => setAttachmentView({ type: "ALL" })} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Paperclip className="h-3.5 w-3.5" />Expediente ({attachments.length})
            </button>
            {sellerDraft && requisition.items.length > 1 && (
              <button type="button" onClick={onBulkSellerReference} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                <PackageCheck className="h-3.5 w-3.5" />Completar compra en lote
              </button>
            )}
            {canBuy && requisition.items.length > 1 && !["DRAFT", "COMPLETED", "CANCELLED"].includes(requisition.status) && (
              <button type="button" onClick={onBulkBuyerOffers} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50">
                <PackageCheck className="h-3.5 w-3.5" />Completar propuestas en lote
              </button>
            )}
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
            {onDelete && (
              <button type="button" onClick={onDelete} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />Eliminar requisición
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <Info label="Comprador" value={requisition.assignedBuyer?.fullName || "Sin asignar"} />
          <Info label="Destino" value={requisition.deliveryState || "Definido por partida"} />
          <Info label="Partidas" value={String(requisition.items.length)} />
          <Info label="Compra seleccionada" value={selectedCosts.MXN || selectedCosts.USD ? [selectedCosts.MXN && money(selectedCosts.MXN, "MXN"), selectedCosts.USD && money(selectedCosts.USD, "USD")].filter(Boolean).join(" · ") : "Pendiente"} />
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {requisition.quoteStatus === "APPROVED" && requisition.items.some((item) => item.source === "LOCAL_NEW" && !item.erpCode?.trim()) && (
          <Alert severity="warning">
            El cliente aprobó la cotización. Compras debe dar de alta en Proscai los productos locales y vincular sus códigos antes de generar el TXT del pedido.
          </Alert>
        )}
        <RequisitionPaperCard
          requisition={requisition}
          canEditDocument={(role === "SELLER" && sellerDraft) || (canBuy && !["COMPLETED", "CANCELLED"].includes(requisition.status))}
          busy={busy}
          onSaveDocument={onSaveDocument}
          canEditOfferCode={(canBuy || sellerDraft) && !requisition.supplierRequisitions?.length}
          role={role}
          onSaveSupplierCode={onSaveSupplierCode}
          onOpenItem={onOpenItem}
        />
        {purchasingQuotes.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Referencias de proveedores registradas por Compras</h3>
          <p className="mt-1 text-xs text-slate-500">Cada referencia reúne partidas de un proveedor y una moneda. Una propuesta registrada no se adjudica automáticamente.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {purchasingQuotes.map(({ id, offer, lines }) => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-slate-900">{offer.supplier.name} · {offer.currency}</p>
                <p className="mt-1 text-slate-600">{lines.length} partida(s) · {offer.supplierQuote?.reference || "Sin folio del proveedor"}</p>
                <p className="mt-1 text-slate-500">{lines.filter(({ offer: line }) => line.isSelected).length} adjudicada(s)</p>
              </div>
              {canBuy && !requisition.supplierRequisitions?.length && !["DRAFT", "COMPLETED", "CANCELLED"].includes(requisition.status) && <Button size="small" variant="outlined" disabled={busy} onClick={() => onEditSupplierReference(id)}>Editar referencia</Button>}
            </div>)}
          </div>
        </section>}
        {requisition.supplierRequisitions?.length ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Requisiciones finales por proveedor y moneda</h3>
            <p className="mt-1 text-xs text-slate-500">Cada documento conserva la moneda de compra. La moneda de la cotización al cliente es independiente.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {requisition.supplierRequisitions.map((document) => (
                <div key={document.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                  <p className="font-semibold text-slate-900">{document.number} · {document.supplierName}</p>
                  <p className="mt-1 text-slate-600">{document.lines.length} partidas · {document.currency} · {money(document.lines.reduce((sum, line) => sum + line.total, 0), document.currency)}</p>
                  <button type="button" className="mt-2 font-semibold text-blue-700 hover:underline" onClick={() => void downloadSupplierRequisition(requisition, document).catch((error) => notifier.error(error instanceof Error ? error.message : "No se pudo descargar el PDF."))}>Descargar PDF</button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
        <p className="text-xs text-slate-500">
          {requisition.quoteStatus !== "APPROVED" && requisition.status !== "DRAFT"
            ? "Consulta de precios: Compras puede cotizar, pero el pedido espera la aprobación del cliente."
            : requisition.status === "READY_FOR_ORDER"
            ? "La cotización ya puede generar el pedido ERP."
            : requisition.status === "DRAFT"
              ? "Completa los datos requeridos y envía la requisición a Compras."
              : requisition.supplierRequisitions?.length && requisition.items.some(localReadyForSupplierDocument)
                ? "La compra al proveedor ya fue emitida. El TXT ERP sigue pendiente hasta vincular los códigos locales."
              : supplierDocumentsReady
                ? "Compras puede emitir la requisición al proveedor; el TXT ERP sigue pendiente hasta vincular los códigos locales."
              : "El pedido se habilita cuando todas las partidas estén listas."}
        </p>
        {sellerDraft && (
          <button type="button" disabled={busy} onClick={() => { setSelectedBuyerId(""); setSubmitOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" />Enviar a Compras
          </button>
        )}
        {canBuy && ["DRAFT", "PENDING", "CHANGES_REQUESTED"].includes(requisition.quoteStatus)
          && !["DRAFT", "CANCELLED", "COMPLETED"].includes(requisition.status) && (
          <Button variant="contained" size="small" disabled={busy} onClick={() => setFinalizeOpen(true)}>
            Aplicar costos y avisar al vendedor
          </Button>
        )}
        {canApproveCost && requisition.status === "COST_REVIEW" && (
          <button type="button" disabled={busy} onClick={() => void onApproveCost()} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <BadgeDollarSign className="h-4 w-4" />Aprobar mayor costo
          </button>
        )}
        {canBuy && requisition.quoteStatus === "APPROVED" && supplierDocumentsReady && !requisition.supplierRequisitions?.length && (
          <button type="button" disabled={busy} onClick={() => void onGenerate()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Generar requisiciones por proveedor</button>
        )}
      </footer>

      <Dialog open={finalizeOpen} onClose={busy ? undefined : () => setFinalizeOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Aplicar costos de Compras</DialogTitle>
        <DialogContent dividers>
          <p className="text-sm text-slate-600">
            Se revisarán todas las requisiciones de {requisition.quoteNumber}. Las partidas con una sola propuesta se adjudicarán automáticamente;
            cuando existan varias, debes elegir una antes de continuar. Los costos pasarán a la cotización y se avisará una sola vez al vendedor.
            Los productos locales no se darán de alta en Proscai hasta que el cliente acepte. El vendedor revisará el recargo y el precio de venta en la cotización.
          </p>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{requisition.items.filter((item) => item.status !== "CANCELLED").map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-2"><p className="text-xs font-semibold">#{item.position} {item.erpCode || "Producto local"}</p><p className="truncate text-[11px] text-slate-500">{item.customerDescription || item.description}</p></div>)}</div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeOpen(false)} disabled={busy}>Cancelar</Button>
          <Button variant="contained" disabled={busy} onClick={() => {
            void onFinalizePrices().then((saved) => { if (saved) setFinalizeOpen(false); });
          }}>
            Confirmar y avisar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={submitOpen && sellerDraft} onClose={busy ? undefined : () => setSubmitOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enviar requisición a Compras</DialogTitle>
        <DialogContent dividers className="space-y-4">
          <p className="text-sm text-slate-600">Selecciona al responsable de Compras de {requisition.branchName}. La requisición quedará asignada al enviarla.</p>
          {buyersLoading ? <p className="text-sm text-slate-500">Cargando responsables...</p> : null}
          {buyersError ? <Alert severity="error">No se pudieron cargar los responsables de esta sucursal. Inténtalo de nuevo.</Alert> : null}
          {!buyersLoading && !buyersError && buyers.length === 0 ? <Alert severity="warning">No hay un usuario activo de Compras en esta sucursal. Solicita al administrador que asigne uno.</Alert> : null}
          {buyers.length > 0 ? (
            <TextField select fullWidth size="small" label="Responsable de Compras" value={selectedBuyerId} onChange={(event) => setSelectedBuyerId(event.target.value)} disabled={busy}>
              <MenuItem value="">Seleccionar responsable</MenuItem>
              {buyers.map((buyer) => <MenuItem key={buyer.id} value={buyer.id}>{buyer.fullName}</MenuItem>)}
            </TextField>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitOpen(false)} disabled={busy}>Cancelar</Button>
          <Button variant="contained" disabled={busy || buyersLoading || buyersError || !selectedBuyerId} onClick={() => void onSubmit(selectedBuyerId).then((saved) => { if (saved) setSubmitOpen(false); })}>Enviar a Compras</Button>
        </DialogActions>
      </Dialog>

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
        requestedDescription: item.customerDescription || item.description,
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
        <div className="sm:col-span-2">
          <TechnicalDataEditor
            value={form}
            onChange={(technicalData) => setForm((state) => state && ({ ...state, ...technicalData }))}
            onSuggest={() => void suggestTechnical()}
            suggesting={suggestingTechnical}
          />
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Atributo adicional</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Úsalo solo si el dato técnico no existe en los catálogos.</p>
          <div className="mt-3 flex gap-2"><input value={newTechnicalKey} onChange={(event) => setNewTechnicalKey(event.target.value)} placeholder="Nuevo campo" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs" /><input value={newTechnicalValue} onChange={(event) => setNewTechnicalValue(event.target.value)} placeholder="Valor" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs" /><button type="button" onClick={addTechnicalAttribute} className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950">Agregar</button></div>
          </div>
        </div>
        <Field label={item.quotationOwner === "SELLER" ? "Costo unitario del vendedor *" : "Costo de referencia (opcional)"} type="number" value={form.sellerUnitCost} onChange={(sellerUnitCost) => setForm((state) => state && ({ ...state, sellerUnitCost }))} />
        <Select label="Moneda *" value={form.sellerCurrency} onChange={(sellerCurrency) => setForm((state) => state && ({ ...state, sellerCurrency: sellerCurrency as Currency }))} options={[["MXN", "MXN"], ["USD", "USD"]]} />
        <Select label="Origen del costo *" value={form.sellerCostSource} onChange={(sellerCostSource) => setForm((state) => state && ({ ...state, sellerCostSource: sellerCostSource as ItemForm["sellerCostSource"] }))} options={[["ERP_COST", "Costo ERP"], ["SELLER_SUPPLIER_QUOTE", "Cotización del vendedor"], ["PRICE_LIST", "Lista de precios"], ["ESTIMATED", "Estimado"]]} />
        <Select label="Marca cotizada" value={form.sellerBrand} onChange={(sellerBrand) => setForm((state) => state && ({ ...state, sellerBrand }))} options={[["", "Seleccionar"], ...brands.map((option) => [catalogValue(option), option.label] as [string, string])]} />
        <Select label={item.quotationOwner === "SELLER" ? "Tiempo de entrega *" : "Tiempo de entrega (pendiente de Compras)"} value={form.sellerDeliveryTime} onChange={(sellerDeliveryTime) => setForm((state) => state && ({ ...state, sellerDeliveryTime }))} options={[["", "Seleccionar"], ...deliveryTimes.map((option) => [catalogValue(option), option.label] as [string, string])]} />
        <Select label="Estado de entrega *" value={form.deliveryPlace} onChange={(deliveryPlace) => setForm((state) => state && ({ ...state, deliveryPlace }))} options={[["", "Seleccionar"], ...deliveryStates.map((option) => [catalogValue(option), option.label] as [string, string])]} />
        <fieldset className="rounded-lg border border-slate-200 p-3 sm:col-span-2"><legend className="px-1 text-xs font-semibold text-slate-600">Restricción de origen</legend><div className="flex flex-wrap gap-2">{restrictions.map((option) => { const value = catalogValue(option); const selected = form.originRestrictions.includes(value); return <button key={option.id} type="button" onClick={() => toggleRestriction(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-300 bg-white text-slate-600"}`}>{option.label}</button>; })}</div></fieldset>
      </div>
      <ModalActions busy={busy} onClose={onClose} label="Guardar partida" />
    </form>
  </Modal>
  );
};

const OfferModal = ({ requisition, item, form, setForm, suppliers, brands, origins, restrictionOptions, deliveryTimes, attachments, attachmentsLoading, busyAttachmentId, onDownloadAttachment, onDeleteAttachment, busy, attachmentFile, onAttachmentFile, onNewSupplier, onClose, onSubmit }: {
  requisition: PurchaseRequisition;
  item: RequisitionItem;
  form: OfferForm;
  setForm: React.Dispatch<React.SetStateAction<OfferForm | null>>;
  suppliers: Supplier[];
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  restrictionOptions: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  attachments: FileAttachment[];
  attachmentsLoading: boolean;
  busyAttachmentId: string | null;
  onDownloadAttachment: (file: FileAttachment) => void;
  onDeleteAttachment: (file: FileAttachment) => void;
  busy: boolean;
  attachmentFile: File | null;
  onAttachmentFile: (file: File | null) => void;
  onNewSupplier: (initialValues?: Partial<SaveSupplierInput>) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent, technical: TechnicalDataFormValue, restrictions: string[]) => void;
}) => {
  const [technical, setTechnical] = useState<TechnicalDataFormValue>({
    standard: item.standard || "",
    diameter: item.diameter || "",
    thickness: item.thickness || "",
    bore: item.bore || "",
    technicalFamily: item.technicalFamily || "OTHER",
    technicalAttributes: item.technicalAttributes || {},
  });
  const [restrictions, setRestrictions] = useState(item.originRestrictions);
  const [suggestingTechnical, setSuggestingTechnical] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const suggestTechnical = async () => {
    setSuggestingTechnical(true);
    try {
      const suggestion = await TechnicalDataService.suggest({
        requestedDescription: item.customerDescription || item.description,
        supplierDescription: form.supplierDescription.trim() || undefined,
        existingAttributes: technical.technicalAttributes,
      });
      const attributes = Object.fromEntries(suggestion.attributes.map((attribute) => [attribute.key, attribute.value]));
      setTechnical((current) => ({
        ...current,
        technicalFamily: suggestion.family,
        technicalAttributes: { ...current.technicalAttributes, ...attributes },
        standard: attributes.STANDARD || current.standard,
        diameter: attributes.NOMINAL_DIAMETER || current.diameter,
        thickness: attributes.THICKNESS || attributes.SCHEDULE || current.thickness,
        bore: attributes.BORE || current.bore,
      }));
      notifier.success(`IA sugirió ${suggestion.attributes.length} dato(s) técnicos. Revisa antes de guardar.`);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudieron sugerir los datos técnicos.");
    } finally {
      setSuggestingTechnical(false);
    }
  };
  return <>
  <SupplierOfferModal
    mode="PURCHASING"
    purchasingContext={{ requisition, item }}
    technical={technical}
    onTechnicalChange={setTechnical}
    onSuggestTechnical={() => void suggestTechnical()}
    suggestingTechnical={suggestingTechnical}
    restrictions={restrictions}
    restrictionOptions={restrictionOptions}
    onRestrictionsChange={setRestrictions}
    itemDescription={item.customerDescription || item.description}
    value={form}
    onChange={(value) => setForm(value)}
    suppliers={suppliers}
    brands={brands}
    origins={origins}
    deliveryTimes={deliveryTimes}
    busy={busy || suggestingTechnical}
    attachmentFile={attachmentFile}
    onAttachmentFile={onAttachmentFile}
    onNewSupplier={onNewSupplier}
    onClose={onClose}
    onSubmit={(event) => onSubmit(event, technical, restrictions)}
    existingAttachments={<AttachmentsPanel files={attachments} loading={attachmentsLoading} title="Cotizaciones del proveedor de esta partida" busyFileId={busyAttachmentId} canDelete onPreview={setPreviewFile} onDownload={onDownloadAttachment} onDelete={onDeleteAttachment} />}
  />
  {previewFile && <PdfAttachmentViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />}
  </>;
};

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
const Empty = ({ icon, text, large = false }: { icon: React.ReactNode; text: string; large?: boolean }) => <div className={`flex flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 ${large ? "min-h-[650px]" : "px-6 py-16"}`}><span className="text-slate-400">{icon}</span>{text}</div>;
