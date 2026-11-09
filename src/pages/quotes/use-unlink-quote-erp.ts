import { useMemo, useState } from "react";
import type { PurchaseRequisition } from "../../modules/procurement/services/purchase-requisitions.service";
import { canUnlinkQuoteErpProduct } from "../../modules/quotes/utils/quote-erp-link";
import { notifier } from "../../shared/notifications/notifier";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";
import type { ManualQuoteDraft, ManualQuoteItem } from "../../store/quote/manual-quote.store";

interface UnlinkRequest {
  draftId: string;
  quoteId: string | null;
  itemId: string;
  erpCode: string;
  ean: string;
}

export const useUnlinkQuoteErp = ({ draft, requisitions, checkingRequisitions, requisitionsError, disabled, onUnlinked }: {
  draft: ManualQuoteDraft;
  requisitions: PurchaseRequisition[];
  checkingRequisitions: boolean;
  requisitionsError: boolean;
  disabled: boolean;
  onUnlinked: (id: string) => void;
}) => {
  const [request, setRequest] = useState<UnlinkRequest | null>(null);
  const protectedIds = useMemo(() => new Set(requisitions.flatMap((requisition) => requisition.items.flatMap((item) =>
    item.quoteClientItemId ? [item.quoteItemId, item.quoteClientItemId] : [item.quoteItemId]))), [requisitions]);
  const requestItem = request?.draftId === draft.id && request.quoteId === draft.savedQuoteId
    ? draft.items.find((item) => item.id === request.itemId) ?? null : null;

  const canCheckPurchasing = (id: string) => {
    if (checkingRequisitions || requisitionsError) {
      notifier.warning("No se pudo comprobar la solicitud de Compras. Espera o recarga antes de desvincular.");
      return false;
    }
    if (protectedIds.has(id)) {
      notifier.warning("Esta partida ya está incluida en una requisición. Revisa la solicitud con Compras antes de cambiar el producto.");
      return false;
    }
    return true;
  };
  const requestUnlink = (item: ManualQuoteItem) => {
    if (disabled || !canUnlinkQuoteErpProduct(draft, item) || !canCheckPurchasing(item.id)) return;
    setRequest({ draftId: draft.id, quoteId: draft.savedQuoteId, itemId: item.id, erpCode: item.erpCode, ean: item.ean });
  };
  const confirmUnlink = () => {
    if (disabled || !request) return;
    const current = useManualQuoteStore.getState();
    const item = current.draft.items.find((item) => item.id === request.itemId);
    if (!item || current.draft.id !== request.draftId || current.draft.savedQuoteId !== request.quoteId
      || item.erpCode !== request.erpCode || item.ean !== request.ean || !canUnlinkQuoteErpProduct(current.draft, item)) {
      setRequest(null);
      notifier.warning("La partida cambió. Revisa el producto antes de desvincular.");
      return;
    }
    if (!canCheckPurchasing(item.id)) return;
    current.unlinkErpProductFromItem(item.id);
    onUnlinked(item.id);
    setRequest(null);
    notifier.success("Producto ERP desvinculado. Revisa la partida y guarda la cotización para aplicar el cambio.");
  };

  return {
    canUnlink: (item: ManualQuoteItem) => canUnlinkQuoteErpProduct(draft, item),
    requestUnlink, confirmUnlink, requestItem,
    close: () => setRequest(null),
  };
};
