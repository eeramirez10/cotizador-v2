import type { ManualQuoteItem, QuoteCurrency } from "../../../store/quote/manual-quote.store";

interface ExcelImportedQuoteItemsTableProps {
  items: ManualQuoteItem[];
  quoteCurrency: QuoteCurrency;
  compact?: boolean;
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
  compact = false,
}: ExcelImportedQuoteItemsTableProps) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50 ${compact ? "gap-2 px-3 py-2" : "gap-3 px-4 py-3"}`}>
        <div>
          <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-800`}>Partidas importadas desde el formato del vendedor</p>
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-slate-500`}>Los importes se convierten desde la moneda original de cada partida a la moneda final.</p>
        </div>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          Moneda fija: {quoteCurrency}
        </span>
      </div>
      <div className={`${compact ? "max-h-[calc(100dvh-30rem)] min-h-64" : "max-h-[55vh]"} overflow-auto`}>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              {[
                "Descripción",
                "UM",
                "Cantidad",
                "Moneda origen",
                `Precio unitario ${quoteCurrency}`,
                `Importe ${quoteCurrency}`,
                "Tiempo entrega",
              ].map((label) => (
                <th key={label} className={`${compact ? "px-2 py-2 text-[9px]" : "px-4 py-3 text-[11px]"} text-left font-semibold uppercase tracking-wide text-slate-500`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay partidas importadas desde el formato del vendedor.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const sourceUnitPrice = item.sourceUnitPrice ?? item.unitPrice;
              const sourceCurrency = item.sourceCurrency ?? quoteCurrency;

              return (
                <tr key={item.id} className="align-top hover:bg-amber-50/30">
                  <td className={`${compact ? "min-w-56 px-2 py-1.5" : "min-w-72 px-4 py-3"}`}>
                    <p className={`${compact ? "line-clamp-2 text-[11px] leading-4" : "text-sm"} font-semibold text-slate-800`}>{item.customerDescription || item.erpDescription || "Sin descripción"}</p>
                  </td>
                  <td className={`${compact ? "px-2 py-1.5 text-[11px]" : "px-4 py-3 text-sm"} text-slate-700`}>{item.unit || "-"}</td>
                  <td className={`${compact ? "px-2 py-1.5 text-[11px]" : "px-4 py-3 text-sm"} text-slate-700`}>{item.qty}</td>
                  <td className={compact ? "px-2 py-1.5" : "px-4 py-3"}>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{sourceCurrency}</span>
                  </td>
                  <td className={`${compact ? "px-2 py-1.5 text-[11px]" : "px-4 py-3 text-sm"} font-semibold text-slate-700`}>
                    {money(item.unitPrice, quoteCurrency)}
                    {sourceCurrency !== quoteCurrency && <p className="mt-1 text-[10px] font-normal text-slate-500">Original: {money(sourceUnitPrice, sourceCurrency)}</p>}
                  </td>
                  <td className={`${compact ? "px-2 py-1.5 text-[11px]" : "px-4 py-3 text-sm"} font-semibold text-emerald-700`}>{money(item.subtotal, quoteCurrency)}</td>
                  <td className={`${compact ? "px-2 py-1.5 text-[11px]" : "px-4 py-3 text-sm"} text-slate-700`}>{item.deliveryTime || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
