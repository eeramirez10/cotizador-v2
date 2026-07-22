import { AlertTriangle, CheckCircle2, Loader2, PackageSearch, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  LocalProductsService,
  type SimilarLocalProductCandidate,
} from "../../../modules/products/services/local-products.service";

interface LocalProductDedupModalProps {
  open: boolean;
  description: string;
  unit: string;
  onClose: () => void;
  onReuse: (candidate: SimilarLocalProductCandidate) => void;
  onCreateNew: () => void;
}

export const LocalProductDedupModal = ({
  open,
  description,
  unit,
  onClose,
  onReuse,
  onCreateNew,
}: LocalProductDedupModalProps) => {
  const [loading, setLoading] = useState(false);
  const [semanticAvailable, setSemanticAvailable] = useState(true);
  const [items, setItems] = useState<SimilarLocalProductCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasExactMatch = useMemo(() => items.some((item) => item.matchType === "EXACT"), [items]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);

    void LocalProductsService.searchSimilar({ description, unit })
      .then((result) => {
        if (cancelled) return;
        setSemanticAvailable(result.semanticAvailable);
        setItems(result.items);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setSemanticAvailable(false);
        setError(requestError instanceof Error ? requestError.message : "No se pudo consultar el catálogo local.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [description, open, unit]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="local-dedup-title">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-amber-700">
              <PackageSearch className="h-5 w-5" />
              <h2 id="local-dedup-title" className="text-base font-semibold">Revisar productos locales similares</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">Evita duplicar productos que otro vendedor ya registró.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Cerrar búsqueda de productos similares">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Producto solicitado</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{description}</p>
            <p className="mt-1 text-xs text-gray-600">Unidad: {unit}</p>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
              <Loader2 className="mb-3 h-7 w-7 animate-spin text-blue-600" />
              Analizando similitudes con IA...
            </div>
          )}

          {!loading && (!semanticAvailable || error) && (
            <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error || "La búsqueda semántica no está disponible. Puedes continuar, pero revisa manualmente antes de crear."}</p>
            </div>
          )}

          {!loading && semanticAvailable && !error && items.length === 0 && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-gray-700">No encontramos productos locales similares.</p>
              <p className="mt-1 text-xs text-gray-500">Puedes crear un producto local nuevo.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coincidencias encontradas</p>
              {items.map((candidate) => (
                <article key={candidate.product.id} className={`rounded-lg border p-4 ${candidate.matchType === "EXACT" ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white"}`}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${candidate.matchType === "EXACT" ? "bg-emerald-200 text-emerald-800" : "bg-blue-100 text-blue-700"}`}>
                          {candidate.matchType === "EXACT" ? "Coincidencia exacta" : `${candidate.similarityPercent}% similar`}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-500">{candidate.product.unit}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-gray-800">{candidate.product.description}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Origen: {candidate.product.branch?.name || "Catálogo general"}
                      </p>
                    </div>
                    <button type="button" onClick={() => onReuse(candidate)} className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                      Usar existente
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white">
            Cancelar
          </button>
          {!hasExactMatch && (
            <button type="button" onClick={onCreateNew} disabled={loading} className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
              Crear producto nuevo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
