import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { getBranchNameByCode, resolveBranchCode } from "../../../modules/branches/branch.utils";
import { ErpProductsService } from "../../../modules/products/services/erp-products.service";
import type { AiSimilarProductSuggestion } from "../../../modules/ai/types/ai-similar-product.types";
import type { ErpProduct } from "../../../modules/products/types/erp-product.types";
import { useAiSimilarProductSearch } from "../../../queries/products/use-ai-similar-product-search";
import { useErpProductSearch } from "../../../queries/products/use-erp-product-search";
import { notifier } from "../../notifications/notifier";
import { useAuthStore } from "../../../store/auth/auth.store";

interface AddErpProductsModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: ErpProduct) => void;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  customerDescription?: string;
  customerUnit?: string;
}

type SearchMode = "erp" | "ai";
const AI_SEARCH_COOLDOWN_MS = 20_000;

const confidenceBadgeClass = (confidence: AiSimilarProductSuggestion["confidence"]): string => {
  if (confidence === "high") return "bg-emerald-100 text-emerald-700";
  if (confidence === "medium") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

export const AddErpProductsModal = ({
  open,
  onClose,
  onSelect,
  title = "Agregar productos desde ERP",
  subtitle = "Busca por EAN, código o descripción y agrega partidas a la cotización.",
  actionLabel = "Agregar",
  customerDescription = "",
  customerUnit = "",
}: AddErpProductsModalProps) => {
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<SearchMode>("erp");
  const [verifyingSuggestionKey, setVerifyingSuggestionKey] = useState<string | null>(null);
  const [didInitializeOpenState, setDidInitializeOpenState] = useState(false);
  const [aiNextAllowedAtMs, setAiNextAllowedAtMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const previousAiFetchingRef = useRef(false);
  const debouncedTerm = useDebouncedValue(term, 400);
  const user = useAuthStore((state) => state.user);
  const normalizedCustomerDescription = customerDescription.trim();
  const normalizedCustomerUnit = customerUnit.trim();
  const hasCustomerContext = normalizedCustomerDescription.length > 0 || normalizedCustomerUnit.length > 0;

  useEffect(() => {
    if (!open) {
      setTerm("");
      setMode("erp");
      setDidInitializeOpenState(false);
      setAiNextAllowedAtMs(0);
      previousAiFetchingRef.current = false;
      return;
    }

    if (didInitializeOpenState) return;

    if (hasCustomerContext) {
      setMode("ai");
      if (normalizedCustomerDescription) {
        setTerm(normalizedCustomerDescription);
      }
    } else {
      setMode("erp");
    }

    setDidInitializeOpenState(true);
  }, [didInitializeOpenState, hasCustomerContext, normalizedCustomerDescription, open]);

  const branchId = resolveBranchCode(user?.erpBranchCode, user?.branch?.code, user?.branch?.name);
  const enabledErpSearch = open && mode === "erp" && !!branchId && debouncedTerm.trim().length > 0;
  const aiCooldownRemainingMs = Math.max(0, aiNextAllowedAtMs - nowMs);
  const enabledAiSearch =
    open &&
    mode === "ai" &&
    !!branchId &&
    debouncedTerm.trim().length > 0 &&
    aiCooldownRemainingMs === 0;

  const erpSearch = useErpProductSearch(debouncedTerm, branchId, enabledErpSearch);
  const aiSearch = useAiSimilarProductSearch(debouncedTerm, branchId, enabledAiSearch);

  useEffect(() => {
    const isFetching = aiSearch.isFetching;
    const wasFetching = previousAiFetchingRef.current;
    previousAiFetchingRef.current = isFetching;

    if (!open || mode !== "ai") return;
    if (isFetching && !wasFetching) {
      setNowMs(Date.now());
      setAiNextAllowedAtMs(Date.now() + AI_SEARCH_COOLDOWN_MS);
    }
  }, [aiSearch.isFetching, mode, open]);

  useEffect(() => {
    if (!open || mode !== "ai") return;
    if (aiCooldownRemainingMs <= 0) return;

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [aiCooldownRemainingMs, mode, open]);

  const isLoading = mode === "ai" ? aiSearch.isLoading : erpSearch.isLoading;
  const isError = mode === "ai" ? aiSearch.isError : erpSearch.isError;
  const error = mode === "ai" ? aiSearch.error : erpSearch.error;
  const erpData = erpSearch.data ?? [];
  const aiData = aiSearch.data ?? [];
  const sortedErpData = useMemo(
    () => [...erpData].sort((a, b) => compareByEan(a.ean, b.ean) || compareByText(a.code, b.code)),
    [erpData],
  );
  const sortedAiData = useMemo(
    () =>
      [...aiData].sort(
        (a, b) =>
          b.finalSimilarity - a.finalSimilarity ||
          compareByText(a.branchProductCode, b.branchProductCode) ||
          compareByEan(a.ean, b.ean) ||
          compareByText(a.productId, b.productId),
      ),
    [aiData],
  );
  const rowsCount = mode === "ai" ? sortedAiData.length : sortedErpData.length;
  const colSpan = mode === "ai" ? 11 : 9;
  const currentBranchName = getBranchNameByCode(branchId);

  const modeSubtitle = useMemo(() => {
    if (mode === "erp") {
      return "Búsqueda directa por EAN, código o descripción del ERP (todas las sucursales).";
    }

    return "Búsqueda semántica con IA usando descripción del cliente y similitud.";
  }, [mode]);

  if (!open) return null;

  const handleSelectAiSuggestion = async (suggestion: AiSimilarProductSuggestion): Promise<void> => {
    const rowKey = `${suggestion.ean}-${suggestion.branchProductCode}-${suggestion.productId}`;
    setVerifyingSuggestionKey(rowKey);

    try {
      if (suggestion.branchProduct) {
        const resolvedCode = suggestion.resolvedBranchCode || suggestion.branchProduct.branchCode || "";
        if (branchId && resolvedCode && resolvedCode !== branchId) {
          notifier.warning(`No puedes agregar productos de ${getBranchNameByCode(resolvedCode)} en esta cotización.`);
          return;
        }
        onSelect(suggestion.branchProduct);
        return;
      }

      if (!branchId) {
        notifier.warning("No se pudo validar ERP porque la sucursal no está definida.");
        return;
      }

      const byEan = await ErpProductsService.searchByTerm(suggestion.ean, branchId);
      const normalizedSuggestionEan = suggestion.ean.trim().toUpperCase();
      const exact = byEan.find((product) => product.ean.trim().toUpperCase() === normalizedSuggestionEan);
      const resolved = exact ?? byEan[0] ?? null;

      if (!resolved) {
        notifier.warning(`No existe en ERP ${getBranchNameByCode(branchId)} para EAN ${suggestion.ean}.`);
        return;
      }

      if (branchId && resolved.branchCode && resolved.branchCode !== branchId) {
        notifier.warning(`No puedes agregar productos de ${getBranchNameByCode(resolved.branchCode)} en esta cotización.`);
        return;
      }

      onSelect(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo validar producto en ERP.";
      notifier.error(message);
    } finally {
      setVerifyingSuggestionKey((current) => (current === rowKey ? null : current));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-6xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>

          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {hasCustomerContext && (
            <div className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Pedido cliente</p>
              <p className="mt-1 text-xs text-indigo-900">{normalizedCustomerDescription || "Sin descripcion del cliente."}</p>
              <p className="mt-1 text-[11px] text-indigo-700">UM cliente: {normalizedCustomerUnit || "-"}</p>
            </div>
          )}

          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("erp")}
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                mode === "erp"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              ERP
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("ai");
                if (!term.trim() && normalizedCustomerDescription) {
                  setTerm(normalizedCustomerDescription);
                }
              }}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-semibold ${
                mode === "ai"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> IA
            </button>
            <p className="text-xs text-gray-500">{modeSubtitle}</p>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={mode === "ai" ? "Ej. codo ranurado victaulic 4 pulg" : "Ej. TSC480 o TUBO ACERO"}
            />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Sucursal usuario: {branchId ? currentBranchName : "No definida"}
            </p>
            {mode === "ai" && hasCustomerContext && (
              <button
                type="button"
                onClick={() => setTerm(normalizedCustomerDescription)}
                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Usar descripción cliente
              </button>
            )}
          </div>

          {mode === "ai" && aiCooldownRemainingMs > 0 && (
            <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Límite IA activo. Nueva búsqueda disponible en {Math.ceil(aiCooldownRemainingMs / 1000)}s.
            </p>
          )}

          {!branchId && (
            <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              No se pudo determinar el código de sucursal del usuario. Inicia sesión de nuevo o valida tus datos.
            </p>
          )}

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción ERP</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Moneda</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Costo ERP</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Sucursal</th>
                  {mode === "ai" && (
                    <>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Similitud</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Confianza</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={colSpan}>
                      <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "ai" ? "Buscando sugerencias con IA..." : "Consultando productos en ERP..."}
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && debouncedTerm.trim().length > 0 && rowsCount === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={colSpan}>
                      {mode === "ai"
                        ? "No se encontraron sugerencias IA para esa descripción."
                        : "No se encontraron productos para la búsqueda."}
                    </td>
                  </tr>
                )}

                {!isLoading && debouncedTerm.trim().length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={colSpan}>
                      {mode === "ai"
                        ? "Captura una descripción para buscar coincidencias semánticas en el catálogo."
                        : "Captura un EAN, código o descripción para consultar el ERP."}
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-red-600" colSpan={colSpan}>
                      {error instanceof Error ? error.message : "No se pudo consultar la búsqueda de productos."}
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  mode === "erp" &&
                  sortedErpData.map((product) => {
                    const productBranchCode = product.branchCode ?? "";
                    const productBranchName = product.branchName || getBranchNameByCode(productBranchCode);
                    const isSelectableInUserBranch = !!branchId && productBranchCode === branchId;

                    return (
                      <tr key={`${product.branchCode}-${product.code}-${product.ean}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product.code}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">{product.ean}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">{product.description}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">{product.unit}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product.costCurrency}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">${product.costUsd.toFixed(2)}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product.stock}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                            {productBranchName}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => onSelect(product)}
                            disabled={!isSelectableInUserBranch}
                            className={`rounded-md px-3 py-1 text-xs font-semibold ${
                              isSelectableInUserBranch
                                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                                : "cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-500"
                            }`}
                            title={
                              isSelectableInUserBranch
                                ? "Agregar producto"
                                : `No puedes agregar productos de ${productBranchName}`
                            }
                          >
                            {isSelectableInUserBranch ? actionLabel : "Otra sucursal"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                {!isLoading &&
                  mode === "ai" &&
                  sortedAiData.map((suggestion) => {
                    const product = suggestion.branchProduct;
                    const suggestionBranchCode = suggestion.resolvedBranchCode || product?.branchCode || "";
                    const suggestionBranchName = getBranchNameByCode(suggestionBranchCode);
                    const isSameUserBranch = !!branchId && !!suggestionBranchCode && suggestionBranchCode === branchId;
                    const rowKey = `${suggestion.ean}-${suggestion.branchProductCode}-${suggestion.productId}`;
                    const isVerifying = verifyingSuggestionKey === rowKey;
                    const canSelect = !isVerifying && (!product || isSameUserBranch);

                    return (
                      <tr key={`${suggestion.ean}-${suggestion.branchProductCode}-${suggestion.productId}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product?.code || suggestion.branchProductCode || "-"}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">{suggestion.ean}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          <p>{product?.description || suggestion.description}</p>
                          {suggestion.reasons.length > 0 && (
                            <p className="mt-1 text-[10px] text-indigo-600">{suggestion.reasons.slice(0, 2).join(" · ")}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">{product?.unit || "-"}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product?.costCurrency || "-"}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">{product ? `$${product.costUsd.toFixed(2)}` : "-"}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product?.stock ?? "-"}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {suggestionBranchCode ? (
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                isSameUserBranch ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {suggestionBranchName}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          <p>Final: {suggestion.finalSimilarityPercent.toFixed(2)}%</p>
                          <p className="text-[10px] text-gray-500">Vector: {suggestion.semanticSimilarityPercent.toFixed(2)}%</p>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${confidenceBadgeClass(suggestion.confidence)}`}>
                            {suggestion.confidence.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => {
                              void handleSelectAiSuggestion(suggestion);
                            }}
                            disabled={!canSelect}
                            className={`rounded-md px-3 py-1 text-xs font-semibold ${
                              canSelect
                                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                                : "cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-500"
                            }`}
                          >
                            {isVerifying ? "Validando..." : product ? (isSameUserBranch ? actionLabel : "Otra sucursal") : "Validar ERP"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const compareByText = (left: string, right: string): number =>
  left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });

const compareByEan = (left: string, right: string): number => compareByText(left.trim(), right.trim());
