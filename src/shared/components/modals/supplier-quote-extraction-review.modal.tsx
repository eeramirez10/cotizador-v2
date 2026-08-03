import { AlertTriangle, CheckCircle2, FileSearch, X } from "lucide-react";
import type { ExtractedSupplierQuoteItem, SupplierQuoteExtractionResult } from "../../../modules/procurement/services/supplier-quote-extraction.service";

interface Props {
  result: SupplierQuoteExtractionResult;
  onApply: (item: ExtractedSupplierQuoteItem) => void;
  onClose: () => void;
}

const money = (value: number | null, currency: string | null) => value === null
  ? "—"
  : new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(value);

export const SupplierQuoteExtractionReviewModal = ({ result, onApply, onClose }: Props) => (
  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="supplier-extraction-review-title">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex gap-3">
          <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><FileSearch className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Revisión obligatoria</p>
            <h2 id="supplier-extraction-review-title" className="mt-1 text-lg font-bold text-slate-950">Datos detectados en la cotización</h2>
            <p className="mt-1 text-xs text-slate-500">Selecciona la partida que corresponde al material actual. La IA no guardará datos automáticamente.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
      </header>

      <div className="overflow-y-auto p-5">
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Proveedor" value={result.supplier.name || "No identificado"} />
          <Info label="Referencia" value={result.header.reference || "No identificada"} />
          <Info label="Fecha" value={result.header.quoteDate || "No identificada"} />
          <Info label="Moneda" value={result.header.currency || "Revisar"} />
          <Info label="Vigencia" value={result.header.validUntil || "No identificada"} />
          <Info label="Condiciones de pago" value={result.header.paymentTerms || "No identificadas"} />
          <Info label="Entrega" value={result.header.deliveryTerms || "No identificada"} />
          <Info label="Total documento" value={money(result.totals.total, result.header.currency)} />
        </section>

        {result.warnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Advertencias de validación</p>
            <ul className="mt-2 space-y-1">{result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[980px] w-full text-left text-xs">
            <thead className="bg-slate-900 text-white"><tr><th className="px-3 py-3">Part.</th><th className="px-3 py-3">Código</th><th className="px-3 py-3">Descripción proveedor</th><th className="px-3 py-3 text-right">Cant.</th><th className="px-3 py-3">UM</th><th className="px-3 py-3 text-right">Lista</th><th className="px-3 py-3 text-right">Desc.</th><th className="px-3 py-3 text-right">Neto</th><th className="px-3 py-3">Confianza</th><th className="px-3 py-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {result.items.map((item, index) => (
                <tr key={`${item.lineNumber || index}-${item.description}`} className={item.requiresReview ? "bg-amber-50/50" : "bg-white"}>
                  <td className="px-3 py-3 font-semibold text-slate-600">{item.lineNumber || index + 1}</td>
                  <td className="px-3 py-3 text-slate-600">{item.supplierProductCode || "—"}</td>
                  <td className="max-w-md px-3 py-3"><p className="font-semibold text-slate-900">{item.description}</p>{item.evidence && <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">Fuente: {item.evidence}</p>}</td>
                  <td className="px-3 py-3 text-right">{item.quantity ?? "—"}</td>
                  <td className="px-3 py-3">{item.unit || "—"}</td>
                  <td className="px-3 py-3 text-right">{money(item.listUnitPrice, result.header.currency)}</td>
                  <td className="px-3 py-3 text-right">{item.discountPct === null ? "—" : `${item.discountPct}%`}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(item.netUnitPrice, result.header.currency)}</td>
                  <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${item.requiresReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{item.requiresReview ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{Math.round(item.confidence * 100)}%</span></td>
                  <td className="px-3 py-3 text-right"><button type="button" onClick={() => onApply(item)} className="rounded-lg bg-amber-400 px-3 py-2 font-bold text-slate-950 hover:bg-amber-300">Aplicar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No se detectaron partidas. Revisa el archivo o captura la propuesta manualmente.</p>}
        </div>
      </div>
    </div>
  </div>
);

const Info = ({ label, value }: { label: string; value: string }) => <div><p className="font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>;
