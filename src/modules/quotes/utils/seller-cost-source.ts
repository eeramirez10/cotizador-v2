import type { SellerCostSource } from "../../../store/quote/manual-quote.store";

type SellerCostSourceInput = {
  sellerCostSource?: SellerCostSource | null;
  sellerQuotedUnitCost?: number | null;
  erpCode?: string | null;
};

const LABELS: Record<SellerCostSource, string> = {
  ERP_COST: "Costo ERP",
  SELLER_SUPPLIER_QUOTE: "Cotización de proveedor",
  PRICE_LIST: "Lista de precios",
  ESTIMATED: "Estimación manual",
};

export const resolveSellerCostSource = (item: SellerCostSourceInput): SellerCostSource | null => {
  const hasUpdatedCost = (item.sellerQuotedUnitCost ?? 0) > 0;
  if (hasUpdatedCost) return item.sellerCostSource ?? "ESTIMATED";
  if (item.erpCode?.trim()) return "ERP_COST";
  return null;
};

export const sellerCostSourceLabel = (source: SellerCostSource | null | undefined): string =>
  source ? LABELS[source] : "Sin origen registrado";

export const sellerCostSourceClassName = (source: SellerCostSource): string => {
  if (source === "ERP_COST") return "bg-blue-50 text-blue-700";
  if (source === "SELLER_SUPPLIER_QUOTE") return "bg-emerald-50 text-emerald-700";
  if (source === "PRICE_LIST") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-600";
};
