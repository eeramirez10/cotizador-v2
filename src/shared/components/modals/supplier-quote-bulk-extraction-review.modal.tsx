import { AlertTriangle, ArrowRight, CheckCircle2, FileSearch, X } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ExtractedSupplierQuoteItem,
  SupplierQuoteExtractionResult,
} from "../../../modules/procurement/services/supplier-quote-extraction.service";
import type { ManualQuoteItem } from "../../../store/quote/manual-quote.store";
import { normalizeMeasurementUnit } from "../../../modules/products/constants/measurement-units";

export interface SupplierQuoteBulkMapping {
  systemItemId: string;
  extractedItemIndex: number;
}

interface Props {
  result: SupplierQuoteExtractionResult;
  items: ManualQuoteItem[];
  onApply: (mappings: SupplierQuoteBulkMapping[]) => void;
  onClose: () => void;
}

const canonical = (value: string | null | undefined): string => (value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]+/gi, " ")
  .trim()
  .toUpperCase();

const tokens = (value: string): Set<string> => new Set(
  canonical(value).split(" ").filter((token) => token.length > 1),
);

const score = (systemItem: ManualQuoteItem, extractedItem: ExtractedSupplierQuoteItem): number => {
  const systemCode = canonical(systemItem.erpCode || systemItem.ean);
  const extractedCodes = [extractedItem.supplierProductCode, ...extractedItem.alternateCodes].map(canonical).filter(Boolean);
  if (systemCode && extractedCodes.includes(systemCode)) return 10;

  const systemDescription = systemItem.erpDescription || systemItem.customerDescription;
  const systemTokens = tokens(systemDescription);
  const extractedTokens = tokens(extractedItem.description);
  const intersection = [...systemTokens].filter((token) => extractedTokens.has(token)).length;
  const union = new Set([...systemTokens, ...extractedTokens]).size || 1;
  let value = intersection / union;
  if (extractedItem.quantity !== null && Math.abs(extractedItem.quantity - systemItem.qty) < 0.0001) value += 0.18;
  const extractedUnit = normalizeMeasurementUnit(extractedItem.unit ?? extractedItem.unitOriginal);
  const systemUnit = normalizeMeasurementUnit(systemItem.unit || systemItem.customerUnit);
  if (extractedUnit && extractedUnit === systemUnit) value += 0.12;
  return value;
};

const automaticMappings = (
  systemItems: ManualQuoteItem[],
  extractedItems: ExtractedSupplierQuoteItem[],
): Record<string, string> => {
  const candidates = systemItems.flatMap((systemItem) => extractedItems.map((extractedItem, index) => ({
    systemItemId: systemItem.id,
    index,
    score: score(systemItem, extractedItem),
  }))).sort((left, right) => right.score - left.score);
  const usedSystem = new Set<string>();
  const usedExtracted = new Set<number>();
  const mappings: Record<string, string> = {};
  for (const candidate of candidates) {
    if (candidate.score < 0.12 || usedSystem.has(candidate.systemItemId) || usedExtracted.has(candidate.index)) continue;
    mappings[candidate.systemItemId] = String(candidate.index);
    usedSystem.add(candidate.systemItemId);
    usedExtracted.add(candidate.index);
  }
  return mappings;
};

const money = (value: number | null, currency: string | null): string => value === null
  ? "—"
  : new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(value);

export const SupplierQuoteBulkExtractionReviewModal = ({ result, items, onApply, onClose }: Props) => {
  const [mapping, setMapping] = useState<Record<string, string>>(() => automaticMappings(items, result.items));
  const duplicateIndexes = useMemo(() => {
    const values = Object.values(mapping).filter(Boolean);
    return new Set(values.filter((value, index) => values.indexOf(value) !== index));
  }, [mapping]);
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const apply = () => {
    if (duplicateIndexes.size > 0 || mappedCount === 0) return;
    onApply(Object.entries(mapping).flatMap(([systemItemId, extractedIndex]) => extractedIndex === ""
      ? []
      : [{ systemItemId, extractedItemIndex: Number(extractedIndex) }]),
    );
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-extraction-review-title">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><FileSearch className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Mapeo de partidas</p>
              <h2 id="bulk-extraction-review-title" className="mt-1 text-lg font-bold text-slate-950">Revisar cotización del proveedor</h2>
              <p className="mt-1 text-xs text-slate-500">La IA propone asociaciones, pero tú decides cuáles se aplican.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-5">
            <Info label="Proveedor" value={result.supplier.name || "No identificado"} />
            <Info label="Referencia" value={result.header.reference || "No identificada"} />
            <Info label="Moneda" value={result.header.currency || "Revisar"} />
            <Info label="Vigencia" value={result.header.validUntil || "No identificada"} />
            <Info label="Total" value={money(result.totals.total, result.header.currency)} />
          </section>

          {result.warnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Advertencias del documento</p>
              <ul className="mt-2 space-y-1">{result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-900 text-white"><tr><th className="px-3 py-3">Partida del sistema</th><th className="w-10 px-2 py-3"></th><th className="px-3 py-3">Partida detectada</th><th className="px-3 py-3 text-right">Cantidad</th><th className="px-3 py-3 text-right">Costo neto</th><th className="px-3 py-3">Confianza IA</th></tr></thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((systemItem, index) => {
                  const selectedValue = mapping[systemItem.id] ?? "";
                  const selectedIndex = selectedValue === "" ? null : Number(selectedValue);
                  const extracted = selectedIndex === null ? null : result.items[selectedIndex];
                  const duplicated = selectedValue !== "" && duplicateIndexes.has(selectedValue);
                  return (
                    <tr key={systemItem.id} className={duplicated ? "bg-rose-50" : extracted?.requiresReview ? "bg-amber-50/50" : "bg-white"}>
                      <td className="max-w-sm px-3 py-3"><p className="font-bold text-slate-900">#{index + 1} {systemItem.erpCode || "LOCAL"}</p><p className="mt-1 line-clamp-2 text-slate-600">{systemItem.erpDescription || systemItem.customerDescription}</p><p className="mt-1 text-[10px] text-slate-500">{systemItem.qty} {systemItem.unit || systemItem.customerUnit}</p></td>
                      <td className="px-2 py-3 text-slate-400"><ArrowRight className="h-4 w-4" /></td>
                      <td className="min-w-[360px] px-3 py-3">
                        <select value={selectedValue} onChange={(event) => setMapping((current) => ({ ...current, [systemItem.id]: event.target.value }))} className={`w-full rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:ring-2 ${duplicated ? "border-rose-400 focus:ring-rose-100" : "border-slate-300 focus:border-amber-500 focus:ring-amber-100"}`}>
                          <option value="">No aplicar a esta partida</option>
                          {result.items.map((item, itemIndex) => <option key={`${itemIndex}-${item.description}`} value={itemIndex}>#{item.lineNumber || itemIndex + 1} · {item.supplierProductCode ? `${item.supplierProductCode} · ` : ""}{item.description}</option>)}
                        </select>
                        {duplicated && <p className="mt-1 text-[10px] font-semibold text-rose-700">Esta partida del proveedor está asignada más de una vez.</p>}
                        {extracted?.evidence && <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">Fuente: {extracted.evidence}</p>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{extracted?.quantity ?? "—"} {extracted?.unit || extracted?.unitOriginal || ""}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900">{money(extracted?.netUnitPrice ?? null, result.header.currency)}</td>
                      <td className="px-3 py-3">{extracted ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${extracted.requiresReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{extracted.requiresReview ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{Math.round(extracted.confidence * 100)}%</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs text-slate-500">Se aplicarán {mappedCount} de {items.length} partidas seleccionadas.</p>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button><button type="button" onClick={apply} disabled={mappedCount === 0 || duplicateIndexes.size > 0} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">Aplicar mapeo</button></div>
        </footer>
      </div>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div><p className="font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>;
