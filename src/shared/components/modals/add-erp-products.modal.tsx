import { Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { ErpProduct } from "../../../modules/products/types/erp-product.types";
import { useErpProductSearch } from "../../../queries/products/use-erp-product-search";
import { useAuthStore } from "../../../store/auth/auth.store";

interface AddErpProductsModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: ErpProduct) => void;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
}

export const AddErpProductsModal = ({
  open,
  onClose,
  onSelect,
  title = "Agregar productos desde ERP",
  subtitle = "Busca por EAN exacto y agrega partidas a la cotización.",
  actionLabel = "Agregar",
}: AddErpProductsModalProps) => {
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, 300);
  const user = useAuthStore((state) => state.user);

  const branchId = resolveBranchCode(user?.branchId, user?.branch?.name);
  const enabledSearch = open && !!branchId && debouncedTerm.trim().length > 0;
  const { data, isLoading, isError, error } = useErpProductSearch(debouncedTerm, branchId, enabledSearch);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-5xl rounded-xl bg-white shadow-xl">
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
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej. TSC480"
            />
          </div>
          <p className="mb-2 text-xs text-gray-500">Sucursal consulta: {branchId || "No definida"}</p>

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
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={8}>
                      <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Consultando productos en ERP...
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && debouncedTerm.trim().length > 0 && data?.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={8}>
                      No se encontraron productos para la búsqueda.
                    </td>
                  </tr>
                )}

                {!isLoading && debouncedTerm.trim().length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={8}>
                      Captura un EAN para consultar el ERP.
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-red-600" colSpan={8}>
                      {error instanceof Error ? error.message : "No se pudo consultar ERP."}
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  data?.map((product) => (
                    <tr key={`${product.code}-${product.ean}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product.code}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">{product.ean}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">{product.description}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">{product.unit}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product.costCurrency}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">${product.costUsd.toFixed(2)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-gray-700">{product.stock}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => onSelect(product)}
                          className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1 text-xs font-semibold text-white hover:from-emerald-600 hover:to-teal-700"
                        >
                          {actionLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const normalizeBranchLabel = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const resolveBranchCode = (branchId?: string, branchName?: string): string => {
  const raw = (branchId || "").trim();
  if (/^\d{2}$/.test(raw)) return raw;

  const embeddedCode = raw.match(/\d{2}/)?.[0];
  if (embeddedCode) return embeddedCode;

  const normalizedName = normalizeBranchLabel(branchName || "");

  if (normalizedName.includes("mexico")) return "01";
  if (normalizedName.includes("monterrey")) return "02";
  if (normalizedName.includes("veracruz")) return "03";
  if (normalizedName.includes("mexicali")) return "04";
  if (normalizedName.includes("queretaro")) return "05";
  if (normalizedName.includes("cancun")) return "06";

  return "01";
};
