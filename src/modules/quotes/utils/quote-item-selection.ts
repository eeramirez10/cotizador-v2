import type { ManualQuoteDraft } from "../../../store/quote/manual-quote.store";

interface QuoteItemIdentity { id: string }

export const canRemoveQuoteItems = (draft: Pick<ManualQuoteDraft, "status" | "captureMethod">): boolean =>
  draft.captureMethod === "SYSTEM"
  && ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"].includes(draft.status);

export const selectedQuoteItemIds = (items: readonly QuoteItemIdentity[], selectedIds: readonly string[]): string[] => {
  const selected = new Set(selectedIds);
  return items.filter((item) => selected.has(item.id)).map((item) => item.id);
};

export const toggleQuoteItemSelection = (selectedIds: readonly string[], itemId: string, checked: boolean): string[] => {
  const selected = new Set(selectedIds);
  if (checked) selected.add(itemId);
  else selected.delete(itemId);
  return [...selected];
};

export const removeQuoteItems = <T extends QuoteItemIdentity>(items: T[], itemIds: readonly string[]): T[] => {
  const selected = new Set(itemIds);
  if (selected.size === 0) return items;
  const remaining = items.filter((item) => !selected.has(item.id));
  return remaining.length === items.length ? items : remaining;
};
