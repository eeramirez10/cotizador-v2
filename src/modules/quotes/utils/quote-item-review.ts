export interface QuoteItemReviewSubject {
  localProductId?: string | null;
  erpCode?: string | null;
  ean?: string | null;
  erpDescription?: string | null;
  customerDescription?: string | null;
  qty: number;
  unit?: string | null;
  unitPrice?: number | null;
  deliveryTime?: string | null;
  importedFromExcel?: boolean;
  sourceRequiresReview?: boolean;
}

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const getQuoteItemReviewIssues = (item: QuoteItemReviewSubject): string[] => {
  const issues: string[] = [];

  if (item.importedFromExcel) {
    if (item.sourceRequiresReview) issues.push("La extracción contiene datos por confirmar");
    if (!hasText(item.customerDescription) && !hasText(item.erpDescription)) issues.push("Falta descripción");
    if (!Number.isFinite(item.qty) || item.qty <= 0) issues.push("La cantidad debe ser mayor a cero");
    if (!hasText(item.unit)) issues.push("Falta unidad de medida");
    if (!Number.isFinite(item.unitPrice) || Number(item.unitPrice) <= 0) issues.push("Falta precio vendedor");
    if (!hasText(item.deliveryTime)) issues.push("Falta tiempo de entrega");
    return issues;
  }

  const hasLocalProduct = hasText(item.localProductId);
  const hasErpProduct = !hasLocalProduct && (hasText(item.erpCode) || hasText(item.ean));

  if (!hasLocalProduct && !hasErpProduct) {
    issues.push("Falta vincular a ERP o producto local");
  }
  if (hasErpProduct && !hasText(item.erpDescription)) {
    issues.push("Falta descripción del producto ERP");
  }
  if (hasLocalProduct && !hasText(item.customerDescription) && !hasText(item.erpDescription)) {
    issues.push("Falta descripción del producto local");
  }
  if (!Number.isFinite(item.qty) || item.qty <= 0) issues.push("La cantidad debe ser mayor a cero");
  if (!hasText(item.unit)) issues.push("Falta unidad de medida");

  return issues;
};
