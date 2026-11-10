import { useMemo, useState } from "react";
import { canRemoveQuoteItems, selectedQuoteItemIds, toggleQuoteItemSelection } from "../../modules/quotes/utils/quote-item-selection";
import { notifier } from "../../shared/notifications/notifier";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";
import type { ManualQuoteDraft, ManualQuoteItem } from "../../store/quote/manual-quote.store";

interface Selection { scope: string; ids: string[] }

export const useQuoteItemSelection = ({ draft, visibleItems, scope, disabled, onRemoved }: {
  draft: ManualQuoteDraft;
  visibleItems: ManualQuoteItem[];
  scope: string;
  disabled: boolean;
  onRemoved: (ids: string[]) => void;
}) => {
  const [selection, setSelection] = useState<Selection>({ scope: "", ids: [] });
  const [request, setRequest] = useState<Selection | null>(null);
  const canRemove = canRemoveQuoteItems(draft);
  const selectedIds = useMemo(
    () => canRemove && selection.scope === scope ? selectedQuoteItemIds(visibleItems, selection.ids) : [],
    [canRemove, scope, selection, visibleItems],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const itemsToRemove = useMemo(() => {
    if (!request || request.scope !== scope) return [];
    const ids = new Set(request.ids);
    return draft.items.filter((item) => ids.has(item.id));
  }, [draft.items, request, scope]);

  const toggleItem = (id: string, checked: boolean) => {
    if (disabled || !canRemove) return;
    setSelection((current) => ({ scope, ids: toggleQuoteItemSelection(
      current.scope === scope ? selectedQuoteItemIds(visibleItems, current.ids) : [], id, checked,
    ) }));
  };
  const selectVisible = (checked: boolean) => {
    if (disabled || !canRemove) return;
    setSelection({ scope, ids: checked ? visibleItems.map((item) => item.id) : [] });
  };
  const requestRemoval = () => {
    if (disabled || !canRemove || selectedIds.length === 0) return;
    setRequest({ scope, ids: [...selectedIds] });
  };
  const confirmRemoval = () => {
    if (disabled || !request) return;
    const current = useManualQuoteStore.getState();
    if (!canRemoveQuoteItems(current.draft) || current.draft.id !== draft.id || request.scope !== scope
      || selectedQuoteItemIds(current.draft.items, request.ids).length !== request.ids.length) {
      setRequest(null);
      notifier.warning("Las partidas cambiaron. Vuelve a seleccionarlas antes de eliminar.");
      return;
    }
    current.removeItems(request.ids);
    onRemoved(request.ids);
    setSelection({ scope, ids: [] });
    setRequest(null);
    notifier.success(`${request.ids.length === 1 ? "Partida eliminada" : `${request.ids.length} partidas eliminadas`}. Guarda la cotización para aplicar los cambios.`);
  };

  return {
    canRemove, selectedSet, count: selectedIds.length,
    allVisibleSelected: visibleItems.length > 0 && selectedIds.length === visibleItems.length,
    someVisibleSelected: selectedIds.length > 0 && selectedIds.length < visibleItems.length,
    toggleItem, selectVisible, requestRemoval, confirmRemoval,
    clearSelection: () => setSelection({ scope, ids: [] }),
    closeConfirmation: () => setRequest(null),
    confirmationOpen: Boolean(request && request.scope === scope),
    itemsToRemove,
  };
};
