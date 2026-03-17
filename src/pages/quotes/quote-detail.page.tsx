import { CheckCircle2, CircleSlash, FileText, Pencil, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { useGenerateQuoteOrder, useQuoteDetail, useUpdateQuoteStatus } from "../../queries/quotes/use-quote-detail";
import { notifier } from "../../shared/notifications/notifier";

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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

export const QuoteDetailPage = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [showCustomerOrderColumns, setShowCustomerOrderColumns] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

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
  const showCustomerExtractionColumns = quote.items.some(
    (item) => (item.customerDescription || "").trim().length > 0 || (item.customerUnit || "").trim().length > 0
  );
  const company = quote.client?.companyName?.trim() || "";
  const contactName = `${quote.client?.name || ""} ${quote.client?.lastname || ""}`.trim();
  const customerDisplayName = company || contactName || "Cliente sin nombre";
  const deliverySummary = Array.from(
    new Set(quote.items.map((item) => (item.deliveryTime || "").trim()).filter(Boolean))
  );

  const handleCancelQuote = async () => {
    const confirmCancel = window.confirm("¿Seguro que quieres cancelar esta cotización?");
    if (!confirmCancel) return;

    const result = await updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "CANCELADA" });
    if (!result) {
      notifier.error("No se pudo cancelar la cotización.");
      return;
    }

    notifier.success("Cotización cancelada.");
    await refetch();
  };

  const handleMarkQuoted = async () => {
    const result = await updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "COTIZADA" });
    if (!result) {
      notifier.error("No se pudo actualizar el estatus.");
      return;
    }

    notifier.success("Estatus actualizado a COTIZADA.");
    await refetch();
  };

  const handleGenerateOrder = async () => {
    const result = await generateOrder.mutateAsync({ quoteId: quote.quoteId });
    if (result.ok) {
      notifier.success(result.message);
    } else {
      notifier.error(result.message);
    }
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

          <button
            onClick={() => setShowPdfPreview(true)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Vista PDF
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
            {quote.client ? quote.client.companyName || `${quote.client.name} ${quote.client.lastname}`.trim() : "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">WhatsApp</p>
          <p className="text-sm text-gray-700">{quote.client?.whatsappPhone ?? "-"}</p>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-x-auto overflow-y-auto rounded-md border border-gray-200 bg-white">
        {showCustomerExtractionColumns && (
          <div className="flex justify-end border-b border-gray-200 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowCustomerOrderColumns((prev) => !prev)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {showCustomerOrderColumns ? "Ocultar pedido cliente" : "Mostrar pedido cliente"}
            </button>
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código ERP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Origen</th>
              {showCustomerExtractionColumns && showCustomerOrderColumns && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción cliente</th>
              )}
              {showCustomerExtractionColumns && showCustomerOrderColumns && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM cliente</th>
              )}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción ERP</th>
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
                <td className="px-3 py-2 text-xs font-semibold text-gray-700">{item.erpCode || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.ean || "-"}</td>
                <td className="px-3 py-2">
                  {item.erpCode ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold text-sky-700">ERP</span>
                  ) : item.localProductId ? (
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700">LOCAL_TEMP</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">SIN VINCULAR</span>
                  )}
                </td>
                {showCustomerExtractionColumns && showCustomerOrderColumns && (
                  <td className="px-3 py-2 text-xs text-gray-700">{item.customerDescription || "-"}</td>
                )}
                {showCustomerExtractionColumns && showCustomerOrderColumns && (
                  <td className="px-3 py-2 text-xs text-gray-700">{item.customerUnit || "-"}</td>
                )}
                <td className="px-3 py-2 text-xs text-gray-700">{item.erpDescription || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.unit || "-"}</td>
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

      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setShowPdfPreview(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar vista previa PDF"
          />

          <div className="relative max-h-[92vh] w-full max-w-[95vw] overflow-auto rounded-md border border-gray-200 bg-slate-100 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Vista previa PDF</h3>
                <p className="text-xs text-gray-500">Diseño carta antes de generar y enviar al cliente.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfPreview(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-200"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <article
              className="mx-auto bg-white text-gray-900 shadow-lg"
              style={{ width: "8.5in", minHeight: "11in", padding: "0.55in" }}
            >
              <header className="border-b border-gray-200 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img className="h-12" src="/img/logo-tuvansa.png" alt="Logo Tuvansa" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Cotización</p>
                      <h1 className="text-2xl font-semibold">Propuesta Comercial</h1>
                    </div>
                  </div>

                  <div className="space-y-1 text-right text-xs">
                    <p>
                      <span className="font-semibold">Folio:</span> {quote.quoteNumber || quote.quoteId}
                    </p>
                    <p>
                      <span className="font-semibold">Fecha emisión:</span> {formatDate(quote.updatedAt || quote.createdAt)}
                    </p>
                    <p>
                      <span className="font-semibold">Vigencia:</span> 15 días naturales
                    </p>
                    <p>
                      <span className="font-semibold">Moneda:</span> {quote.currency}
                    </p>
                  </div>
                </div>
              </header>

              <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Cliente</p>
                  <p className="mt-1 font-semibold">{customerDisplayName}</p>
                  <p className="text-xs text-gray-600">Contacto: {contactName || "-"}</p>
                  <p className="text-xs text-gray-600">Correo: {quote.client?.email || "-"}</p>
                  <p className="text-xs text-gray-600">WhatsApp: {quote.client?.whatsappPhone || "-"}</p>
                </div>

                <div className="rounded-md border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Datos comerciales</p>
                  <p className="mt-1 text-xs text-gray-700">
                    <span className="font-semibold">Vendedor:</span> {quote.createdByName || "-"}
                  </p>
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Sucursal:</span> {quote.branchName || "-"}
                  </p>
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Tipo de cambio:</span> {quote.exchangeRate}
                  </p>
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Tiempo de entrega:</span>{" "}
                    {deliverySummary.length > 0 ? deliverySummary.join(" / ") : "Por definir"}
                  </p>
                </div>
              </section>

              <section className="mt-4">
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Código</th>
                        <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Descripción</th>
                        <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">UM</th>
                        <th className="px-2 py-2 text-right font-semibold uppercase text-gray-500">Cantidad</th>
                        <th className="px-2 py-2 text-right font-semibold uppercase text-gray-500">Precio unit.</th>
                        <th className="px-2 py-2 text-right font-semibold uppercase text-gray-500">Importe</th>
                        <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Entrega</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white text-[10px] leading-4">
                      {quote.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-2 py-2 align-top font-semibold">{item.erpCode || "-"}</td>
                          <td className="px-2 py-2 align-top">
                            {item.erpDescription || item.customerDescription || "-"}
                          </td>
                          <td className="px-2 py-2 align-top">{item.unit || "-"}</td>
                          <td className="px-2 py-2 text-right align-top">{item.qty}</td>
                          <td className="px-2 py-2 text-right align-top">{formatCurrency(item.unitPrice, quote.currency)}</td>
                          <td className="px-2 py-2 text-right align-top font-semibold">
                            {formatCurrency(item.subtotal, quote.currency)}
                          </td>
                          <td className="px-2 py-2 align-top">{item.deliveryTime || "Por definir"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-4 flex justify-end">
                <div className="w-full max-w-[300px] space-y-1 rounded-md border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>IVA ({(quote.taxRate * 100).toFixed(0)}%)</span>
                    <span>{formatCurrency(quote.tax, quote.currency)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(quote.total, quote.currency)}</span>
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-md border border-gray-200 p-3">
                <p className="text-[11px] font-semibold uppercase text-gray-500">Condiciones comerciales</p>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-[10px] leading-4 text-gray-700">
                  <li>PRECIOS: UNITARIOS MAS IVA.</li>
                  <li>
                    COTIZACION: DOLARES PAGADEROS AL TIPO DE CAMBIO DEL DIARIO OFICIAL EL DIA DE LA OPERACION.
                  </li>
                  <li>CONDICIONES DE PAGO: 60% DE ANTICIPO RESTO CONTRA ENTREGA.</li>
                  <li>LUGAR DE ENTREGA: L.A.B. OBRA.</li>
                  <li>TIEMPO DE ENTREGA: EL MARCADO POR PARTIDA.</li>
                  <li>
                    EN CASO DE ACEPTACION, SU O.C. DEBE VENIR DEBIDAMENTE FIRMADA POR EL JEFE DE COMPRAS Y/O
                    REPRESENTANTE DE LA EMPRESA.
                  </li>
                  <li>MATERIALES COTIZADOS SUJETOS A PREVIA VENTA.</li>
                  <li>PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO.</li>
                  <li>NO SE ACEPTAN DEVOLUCIONES.</li>
                  <li>VIGENCIA 15 DIAS.</li>
                </ol>
              </section>

              <footer className="mt-6 border-t border-gray-200 pt-3 text-[11px] text-gray-500">
                <div className="flex items-center justify-between">
                  <p>Esta es una vista previa del diseño PDF de cotización.</p>
                  <p>Página 1/1</p>
                </div>
              </footer>
            </article>
          </div>
        </div>
      )}
    </section>
  );
};
