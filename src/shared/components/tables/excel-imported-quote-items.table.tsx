import { MessageSquare, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ManualQuoteItem, QuoteCurrency } from "../../../store/quote/manual-quote.store";
import { convertQuoteAmount } from "../../../modules/quotes/utils/quote-currency";

interface ExcelImportedQuoteItemsTableProps {
  items: ManualQuoteItem[];
  quoteCurrency: QuoteCurrency;
  exchangeRate: number;
  onQtyChange: (itemId: string, qty: number) => void;
  onSourcePriceChange: (itemId: string, price: number) => void;
  onSourceCurrencyChange: (itemId: string, currency: QuoteCurrency) => void;
  onAllSourceCurrencyChange: (currency: QuoteCurrency) => void;
  onDeliveryTimeChange: (itemId: string, deliveryTime: string) => void;
  onComment: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}

const money = (amount: number, currency: QuoteCurrency): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

export const ExcelImportedQuoteItemsTable = ({
  items,
  quoteCurrency,
  exchangeRate,
  onQtyChange,
  onSourcePriceChange,
  onSourceCurrencyChange,
  onAllSourceCurrencyChange,
  onDeliveryTimeChange,
  onComment,
  onRemove,
}: ExcelImportedQuoteItemsTableProps) => {
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const globalSourceCurrency = useMemo<QuoteCurrency | "MIXED">(() => {
    const importedItems = items.filter((item) => item.importedFromExcel);
    if (importedItems.length === 0) return "MIXED";

    const firstCurrency = importedItems[0].sourceCurrency || "MXN";
    return importedItems.every((item) => (item.sourceCurrency || "MXN") === firstCurrency) ? firstCurrency : "MIXED";
  }, [items]);

  const commitQty = (item: ManualQuoteItem, raw: string) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onQtyChange(item.id, Math.max(0, parsed));
    setQtyDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  };

  const commitPrice = (item: ManualQuoteItem, raw: string) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onSourcePriceChange(item.id, Math.max(0, parsed));
    setPriceDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  };

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Partidas importadas desde Excel</p>
          <p className="text-xs text-slate-500">La moneda se conserva por partida y puedes aplicarla en bloque.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Aplicar moneda a todas
          <select
            value={globalSourceCurrency}
            onChange={(event) => {
              const currency = event.target.value as QuoteCurrency;
              if (currency === "MXN" || currency === "USD") onAllSourceCurrencyChange(currency);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            aria-label="Aplicar moneda a todas las partidas importadas"
          >
            <option value="MIXED" disabled>
              Mixta
            </option>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {[
              "Descripción",
              "UM",
              "Cantidad",
              "Precio unitario",
              "Moneda",
              "Importe original",
              `Importe ${quoteCurrency}`,
              "Tiempo entrega",
              "Acciones",
            ].map((label) => (
              <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                No hay partidas importadas desde Excel.
              </td>
            </tr>
          )}
          {items.map((item) => {
            const sourceCurrency = item.sourceCurrency || "MXN";
            const sourceUnitPrice = item.sourceUnitPrice ?? item.unitPrice;
            const sourceSubtotal = sourceUnitPrice * item.qty;
            const convertedSubtotal = convertQuoteAmount(sourceSubtotal, sourceCurrency, quoteCurrency, exchangeRate);

            return (
              <tr key={item.id} className="align-top hover:bg-amber-50/30">
                <td className="min-w-72 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{item.customerDescription || item.erpDescription || "Sin descripción"}</p>
                  <span className="mt-1 inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">EXCEL</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{item.unit || "-"}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={qtyDrafts[item.id] ?? String(item.qty)}
                    onChange={(event) => setQtyDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    onBlur={(event) => commitQty(item, event.currentTarget.value)}
                    onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceDrafts[item.id] ?? String(sourceUnitPrice)}
                    onChange={(event) => setPriceDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    onBlur={(event) => commitPrice(item, event.currentTarget.value)}
                    onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                    className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={sourceCurrency}
                    onChange={(event) => onSourceCurrencyChange(item.id, event.target.value as QuoteCurrency)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700"
                    aria-label={`Moneda de ${item.customerDescription || item.id}`}
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-700">{money(sourceSubtotal, sourceCurrency)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{money(convertedSubtotal, quoteCurrency)}</td>
                <td className="px-4 py-3">
                  <input
                    value={item.deliveryTime}
                    onChange={(event) => onDeliveryTimeChange(item.id, event.target.value)}
                    placeholder="Ej. 3-5 días"
                    className="w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onComment(item.id)}
                      className="rounded-lg border border-indigo-300 p-2 text-indigo-700 hover:bg-indigo-50"
                      title="Comentario por partida"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
                      title="Eliminar partida"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
