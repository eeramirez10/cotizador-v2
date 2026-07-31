import type { ManualQuoteItem, QuoteCurrency } from "../../../store/quote/manual-quote.store";

interface ExcelImportedQuoteItemsTableProps {
  items: ManualQuoteItem[];
  quoteCurrency: QuoteCurrency;
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
}: ExcelImportedQuoteItemsTableProps) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Partidas importadas desde Excel</p>
          <p className="text-xs text-slate-500">Importes capturados por el vendedor, sin conversión por tipo de cambio.</p>
        </div>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          Moneda fija: {quoteCurrency}
        </span>
      </div>
      <div className="max-h-[55vh] overflow-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              {[
                "Descripción",
                "UM",
                "Cantidad",
                `Precio unitario ${quoteCurrency}`,
                `Importe ${quoteCurrency}`,
                "Tiempo entrega",
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
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay partidas importadas desde Excel.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const sourceUnitPrice = item.sourceUnitPrice ?? item.unitPrice;
              const sourceSubtotal = sourceUnitPrice * item.qty;

              return (
                <tr key={item.id} className="align-top hover:bg-amber-50/30">
                  <td className="min-w-72 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{item.customerDescription || item.erpDescription || "Sin descripción"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.unit || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.qty}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">{money(sourceUnitPrice, quoteCurrency)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{money(sourceSubtotal, quoteCurrency)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.deliveryTime || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
