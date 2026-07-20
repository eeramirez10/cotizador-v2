import { CheckCircle2, Eye, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";
import {
  QuotesService,
  type QuoteApprovalReturnReason,
} from "../../modules/quotes/services/quotes.service";
import { useQuotes } from "../../queries/quotes/quotes-queries";
import { notifier } from "../../shared/notifications/notifier";

const RETURN_REASONS: Array<{ value: QuoteApprovalReturnReason; label: string }> = [
  { value: "MARGIN_TOO_LOW", label: "Margen insuficiente" },
  { value: "PRICE_BELOW_POLICY", label: "Precio fuera de política" },
  { value: "INCORRECT_COST", label: "Costo incorrecto" },
  { value: "INCORRECT_PRICE", label: "Precio vendedor incorrecto" },
  { value: "MISSING_INFORMATION", label: "Información incompleta" },
  { value: "COMMERCIAL_TERMS", label: "Condiciones comerciales" },
  { value: "DELIVERY_TIME", label: "Tiempo de entrega" },
  { value: "OTHER", label: "Otro" },
];

export const QuoteApprovalsPage = () => {
  const { data, isFetching, refetch } = useQuotes({ page: 1, pageSize: 100, status: "PENDING_APPROVAL" });
  const [actionQuoteId, setActionQuoteId] = useState<string | null>(null);
  const [returnQuoteId, setReturnQuoteId] = useState<string | null>(null);
  const [reason, setReason] = useState<QuoteApprovalReturnReason | "">("");
  const [comment, setComment] = useState("");

  const approve = async (quoteId: string) => {
    const toastId = notifier.loading("Aprobando cotización...");
    try {
      setActionQuoteId(quoteId);
      const ok = await QuotesService.updateStatus(quoteId, "COTIZADA");
      if (!ok) throw new Error("No se pudo aprobar la cotización.");
      if (toastId !== undefined) notifier.update(toastId, "success", "Cotización autorizada y marcada como COTIZADA.");
      else notifier.success("Cotización autorizada y marcada como COTIZADA.");
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo aprobar.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setActionQuoteId(null);
    }
  };

  const requestChanges = async () => {
    if (!returnQuoteId || !reason) return;
    if (reason === "OTHER" && !comment.trim()) {
      notifier.warning("Describe el motivo de devolución.");
      return;
    }

    const toastId = notifier.loading("Devolviendo cotización al vendedor...");
    try {
      setActionQuoteId(returnQuoteId);
      const ok = await QuotesService.updateStatus(
        returnQuoteId,
        "CAMBIOS_SOLICITADOS",
        undefined,
        undefined,
        { reason, comment: comment.trim() || undefined }
      );
      if (!ok) throw new Error("No se pudo devolver la cotización.");
      if (toastId !== undefined) notifier.update(toastId, "success", "Cotización devuelta para corrección.");
      else notifier.success("Cotización devuelta para corrección.");
      setReturnQuoteId(null);
      setReason("");
      setComment("");
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo devolver.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setActionQuoteId(null);
    }
  };

  const quotes = data?.items ?? [];

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Cotizaciones pendientes de aprobación</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">Revisa precios, costos y márgenes antes de autorizar el envío al cliente.</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{data?.total ?? 0} pendientes</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Folio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Vendedor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Sucursal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isFetching && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Cargando cotizaciones...</td></tr>}
            {!isFetching && quotes.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">No hay cotizaciones pendientes de aprobación.</td></tr>}
            {!isFetching && quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{quote.quoteNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{quote.customer?.company || `${quote.customer?.name || ""} ${quote.customer?.lastname || ""}`.trim() || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{quote.createdByName || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{quote.branch || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{quote.createdAt}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <NavLink to={`/quotes/${quote.id}`} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Eye className="h-3.5 w-3.5" /> Revisar</NavLink>
                    <button onClick={() => void approve(quote.id)} disabled={Boolean(actionQuoteId)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Aprobar</button>
                    <button onClick={() => setReturnQuoteId(quote.id)} disabled={Boolean(actionQuoteId)} className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> No aprobar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {returnQuoteId && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold text-gray-900">Solicitar cambios</h3><p className="mt-1 text-sm text-gray-500">El vendedor podrá corregirla y enviarla nuevamente.</p></div>
              <button onClick={() => setReturnQuoteId(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <label className="mt-5 block text-xs font-semibold uppercase text-gray-500">Motivo *</label>
            <select value={reason} onChange={(event) => setReason(event.target.value as QuoteApprovalReturnReason | "")} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="">Selecciona un motivo...</option>{RETURN_REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <label className="mt-4 block text-xs font-semibold uppercase text-gray-500">Comentario {reason === "OTHER" ? "*" : "(opcional)"}</label>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={500} className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Explica qué debe corregir el vendedor..." />
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setReturnQuoteId(null)} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700">Cancelar</button><button onClick={() => void requestChanges()} disabled={!reason || Boolean(actionQuoteId)} className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Solicitar cambios</button></div>
          </div>
        </div>
      )}
    </section>
  );
};
