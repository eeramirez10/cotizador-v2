import type { RequisitionItem } from "../services/purchase-requisitions.service";

export const preferredRequisitionOffer = (item: RequisitionItem) =>
  item.offers.find((offer) => offer.isSelected)
  ?? item.offers.find((offer) => offer.source === "PURCHASING")
  ?? item.offers.find((offer) => offer.source === "SELLER")
  ?? null;

export const requisitionItemSupplierName = (item: RequisitionItem): string | null =>
  preferredRequisitionOffer(item)?.supplier.name?.trim() || item.sellerSupplierName?.trim() || null;

export const requisitionItemSupplierDescription = (item: RequisitionItem): string | null =>
  preferredRequisitionOffer(item)?.supplierDescription?.trim() || null;

export const requisitionSupplierSummary = (items: RequisitionItem[], fallbackName?: string | null): string => {
  const names = [...new Set(items.map(requisitionItemSupplierName).filter((name): name is string => Boolean(name)))];
  if (names.length === 0) return fallbackName || "Pendiente";
  const pending = items.some((item) => !requisitionItemSupplierName(item));
  if (names.length === 1) return pending ? `${names[0]} · Hay partidas sin proveedor` : names[0];
  return `${names.length} proveedores · Ver proveedor por partida${pending ? " · Hay partidas sin proveedor" : ""}`;
};
