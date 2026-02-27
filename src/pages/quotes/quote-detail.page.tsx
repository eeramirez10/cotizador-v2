import { CheckCircle2, CircleSlash, Pencil, ShoppingCart } from "lucide-react";
import { NavLink, useNavigate, useParams } from "react-router";
import { useGenerateQuoteOrder, useQuoteDetail, useUpdateQuoteStatus } from "../../queries/quotes/use-quote-detail";

const statusClass: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  PENDIENTE: "bg-amber-100 text-amber-700",
  COTIZADA: "bg-emerald-100 text-emerald-700",
  CANCELADA: "bg-rose-100 text-rose-700",
};

const formatCurrency = (value: number, currency: "MXN" | "USD") => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

export const QuoteDetailPage = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading, refetch } = useQuoteDetail(quoteId);
  const updateStatus = useUpdateQuoteStatus();
  const generateOrder = useGenerateQuoteOrder();

  if (isLoading) {
    return <p className="text-sm text-gray-500">Cargando detalle de cotización...</p>;
  }

  if (!quote) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-600">No se encontró la cotización.</p>
        <NavLink to="/quotes" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800">
          Volver a cotizaciones
        </NavLink>
      </div>
    );
  }

  const badgeClass = statusClass[quote.status] ?? "bg-gray-100 text-gray-700";

  const handleCancelQuote = async () => {
    const confirmCancel = window.confirm("¿Seguro que quieres cancelar esta cotización?");
    if (!confirmCancel) return;

    const result = await updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "CANCELADA" });
    if (!result) {
      window.alert("No se pudo cancelar la cotización.");
      return;
    }

    await refetch();
  };

  const handleMarkQuoted = async () => {
    const result = await updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "COTIZADA" });
    if (!result) {
      window.alert("No se pudo actualizar el estatus.");
      return;
    }

    await refetch();
  };

  const handleGenerateOrder = async () => {
    const result = await generateOrder.mutateAsync({ quoteId: quote.quoteId });
    window.alert(result.message);
    await refetch();
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Cotización #{quote.quoteId.replace("COT-", "")}</h2>
          <p className="text-xs text-gray-500">Creada: {new Date(quote.createdAt).toLocaleString("es-MX")}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{quote.status}</span>

          <button
            onClick={() => navigate(`/quotes/manual?quoteId=${quote.quoteId}`)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>

          {quote.status === "COTIZADA" && (
            <button
              onClick={handleGenerateOrder}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ShoppingCart className="h-4 w-4" />
              Generar pedido
            </button>
          )}

          {(quote.status === "BORRADOR" || quote.status === "PENDIENTE") && (
            <button
              onClick={handleMarkQuoted}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar cotizada
            </button>
          )}

          {quote.status !== "CANCELADA" && (
            <button
              onClick={handleCancelQuote}
              className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <CircleSlash className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Vendedor</p>
          <p className="text-sm text-gray-700">{quote.createdByName || "-"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Sucursal</p>
          <p className="text-sm text-gray-700">{quote.branchName || "-"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Moneda</p>
          <p className="text-sm text-gray-700">{quote.currency}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Tipo de cambio</p>
          <p className="text-sm text-gray-700">{quote.exchangeRate}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Cliente</p>
          <p className="text-sm text-gray-700">
            {quote.client ? `${quote.client.name} ${quote.client.lastname}` : "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">WhatsApp</p>
          <p className="text-sm text-gray-700">{quote.client?.whatsappPhone ?? "-"}</p>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código ERP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stock</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Entrega</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Cantidad</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Costo ERP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Margen</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Precio</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Subtotal</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {quote.items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700">{item.erpCode}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.ean}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.erpDescription}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.unit}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.stock}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.deliveryTime}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.qty}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(item.costUsd, item.costCurrency || "USD")}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.marginPct}%</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(item.unitPrice, quote.currency)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-emerald-700">{formatCurrency(item.subtotal, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-sm text-gray-700">
            <span>IVA ({(quote.taxRate * 100).toFixed(0)}%)</span>
            <span>{formatCurrency(quote.tax, quote.currency)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(quote.total, quote.currency)}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
