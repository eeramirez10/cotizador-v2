import { normalizeMeasurementUnit } from "../../products/constants/measurement-units";
import type { ManualQuoteDraft, ManualQuoteItem } from "../../../store/quote/manual-quote.store";

export const canUnlinkQuoteErpProduct = (
  draft: Pick<ManualQuoteDraft, "status" | "captureMethod">,
  item: Pick<ManualQuoteItem, "erpCode" | "importedFromExcel">,
): boolean => draft.captureMethod === "SYSTEM" && !item.importedFromExcel && Boolean(item.erpCode.trim())
  && ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"].includes(draft.status);

export const clearQuoteErpLink = (item: ManualQuoteItem): ManualQuoteItem => {
  const description = item.customerDescription.trim() ? item.customerDescription : item.erpDescription;
  const customerUnit = item.customerUnit.trim();
  const hasSupplierCost = (item.sellerQuotedUnitCost ?? 0) > 0;
  return {
    ...item,
    localProductId: null,
    erpCode: "",
    ean: "",
    erpDescription: "",
    customerDescription: description,
    customerDescriptionOriginal: item.customerDescriptionOriginal || description,
    unit: normalizeMeasurementUnit(customerUnit) ?? (customerUnit || normalizeMeasurementUnit(item.unit) || item.unit),
    stock: 0,
    costUsd: 0,
    costCurrency: "MXN",
    erpSaleCurrency: null,
    sellerCostSource: hasSupplierCost
      ? item.sellerCostSource && item.sellerCostSource !== "ERP_COST" ? item.sellerCostSource
        : item.sellerSupplierId ? "SELLER_SUPPLIER_QUOTE" : "ESTIMATED"
      : null,
    deliveryTime: item.sellerSupplierDeliveryTime.trim() || "Por definir",
    effectiveCostAtQuote: undefined,
    isBelowEffectiveCost: undefined,
    effectiveCostVariance: undefined,
    effectiveCostVariancePct: undefined,
    effectiveCostEvaluatedAt: null,
    effectiveCostEvaluatedByUser: null,
    sourceRequiresReview: true,
    requiresReview: true,
  };
};
