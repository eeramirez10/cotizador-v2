import { Loader2, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { MEASUREMENT_UNIT_OPTIONS, MEASUREMENT_UNIT_VALUES } from "../../modules/products/constants/measurement-units";
import { type LocalProduct, type UpdateLocalProductInput } from "../../modules/products/services/local-products.service";
import { useDeleteLocalProduct, useLocalProducts, useUpdateLocalProduct } from "../../queries/products/use-local-products";
import { notifier } from "../../shared/notifications/notifier";

const PAGE_SIZE = 20;

interface ProductFormState {
  id: string | null;
  code: string;
  ean: string;
  description: string;
  unit: string;
  currency: "MXN" | "USD";
  averageCost: string;
  lastCost: string;
  stock: string;
  isActive: boolean;
}

const EMPTY_FORM: ProductFormState = {
  id: null,
  code: "",
  ean: "",
  description: "",
  unit: "",
  currency: "USD",
  averageCost: "",
  lastCost: "",
  stock: "",
  isActive: true,
};

const toNumberOrNull = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const mapProductToForm = (product: LocalProduct): ProductFormState => ({
  id: product.id,
  code: product.code || "",
  ean: product.ean || "",
  description: product.description,
  unit: product.unit,
  currency: product.currency,
  averageCost:
    typeof product.averageCost === "number" && Number.isFinite(product.averageCost)
      ? String(product.averageCost)
      : "",
  lastCost:
    typeof product.lastCost === "number" && Number.isFinite(product.lastCost)
      ? String(product.lastCost)
      : "",
  stock:
    typeof product.stock === "number" && Number.isFinite(product.stock)
      ? String(product.stock)
      : "",
  isActive: product.isActive,
});

const formatCurrency = (value: number | null, currency: "MXN" | "USD") => {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

export const ProductsPage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [openEditModal, setOpenEditModal] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isFetching, refetch } = useLocalProducts({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    status: statusFilter,
  });
  const updateMutation = useUpdateLocalProduct();
  const deleteMutation = useDeleteLocalProduct();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const products = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const canSubmit = Boolean(form.id) && !updateMutation.isPending;
  const unitOptions = useMemo(() => {
    if (!form.unit.trim()) return MEASUREMENT_UNIT_OPTIONS;
    if (MEASUREMENT_UNIT_VALUES.includes(form.unit.trim().toUpperCase() as (typeof MEASUREMENT_UNIT_VALUES)[number])) {
      return MEASUREMENT_UNIT_OPTIONS;
    }

    return [{ value: form.unit.trim().toUpperCase(), label: `${form.unit.trim().toUpperCase()} - Actual` }, ...MEASUREMENT_UNIT_OPTIONS];
  }, [form.unit]);

  const resetForm = () => setForm(EMPTY_FORM);
  const closeEditModal = () => {
    if (updateMutation.isPending) return;
    setOpenEditModal(false);
    resetForm();
  };
  const openEditProductModal = (product: LocalProduct) => {
    setForm(mapProductToForm(product));
    setOpenEditModal(true);
  };

  const validateForm = (): string | null => {
    if (!form.id) return "Selecciona un producto para editar.";
    if (!form.description.trim()) return "La descripción es obligatoria.";
    if (!form.unit.trim()) return "La unidad es obligatoria.";
    if (!MEASUREMENT_UNIT_VALUES.includes(form.unit.trim().toUpperCase() as (typeof MEASUREMENT_UNIT_VALUES)[number])) {
      return "La unidad debe seleccionarse del listado.";
    }

    const averageCost = toNumberOrNull(form.averageCost);
    if (typeof averageCost === "number" && (!Number.isFinite(averageCost) || averageCost < 0)) {
      return "Costo promedio inválido.";
    }

    const lastCost = toNumberOrNull(form.lastCost);
    if (typeof lastCost === "number" && (!Number.isFinite(lastCost) || lastCost < 0)) {
      return "Último costo inválido.";
    }

    const stock = toNumberOrNull(form.stock);
    if (typeof stock === "number" && (!Number.isFinite(stock) || stock < 0)) {
      return "Stock inválido.";
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      notifier.warning(error);
      return;
    }

    const input: UpdateLocalProductInput = {
      code: form.code.trim() || null,
      ean: form.ean.trim() || null,
      description: form.description.trim(),
      unit: form.unit.trim().toUpperCase(),
      currency: form.currency,
      averageCost: toNumberOrNull(form.averageCost),
      lastCost: toNumberOrNull(form.lastCost),
      stock: toNumberOrNull(form.stock),
      isActive: form.isActive,
    };

    try {
      await updateMutation.mutateAsync({
        productId: form.id!,
        input,
      });
      notifier.success("Producto local actualizado.");
      await refetch();
      closeEditModal();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "No se pudo actualizar el producto.";
      notifier.error(message);
    }
  };

  const handleDelete = async (product: LocalProduct) => {
    const confirmed = window.confirm(
      `¿Eliminar producto local?\n\n${product.description}\n\nEsta acción lo ocultará del listado activo.`
    );

    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(product.id);
      if (form.id === product.id) {
        setOpenEditModal(false);
        resetForm();
      }
      notifier.success("Producto local eliminado.");
      await refetch();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el producto.";
      notifier.error(message);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Productos locales</h2>
            <p className="text-xs text-gray-500">Listado de productos temporales creados por vendedores.</p>
          </div>

          <button
            onClick={() => {
              void refetch();
            }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por descripción, EAN, código..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            className="w-[180px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </div>

        <div className="overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Moneda</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Costo prom.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Últ. costo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stock</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Sucursal</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isFetching && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-gray-500">
                    Cargando productos...
                  </td>
                </tr>
              )}

              {!isFetching && products.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-gray-500">
                    No hay productos locales para mostrar.
                  </td>
                </tr>
              )}

              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-700">{product.code || "-"}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{product.ean || "-"}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{product.description}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{product.unit}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700">{product.currency}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {formatCurrency(product.averageCost, product.currency)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {formatCurrency(product.lastCost, product.currency)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {typeof product.stock === "number" ? product.stock : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{product.branch?.name || "-"}</td>
                  <td className="px-3 py-2">
                    {product.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Activo</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">Inactivo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEditProductModal(product)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(product);
                      }}
                      disabled={deleteMutation.isPending}
                      className="ml-2 inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <span>
            Página {page} de {Math.max(1, totalPages)} - Total {total} productos
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {openEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeEditModal}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar modal de edición"
          />

          <div className="relative w-full max-w-2xl rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Editar producto local</h2>
                <p className="text-xs text-gray-500">
                  Actualiza la información del producto seleccionado.
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Editando: <strong>{form.description || "Producto local"}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={updateMutation.isPending}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="px-4 py-3" onSubmit={handleSubmit}>
              <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                <Input
                  label="Código interno"
                  value={form.code}
                  onChange={(value) => setForm((prev) => ({ ...prev, code: value }))}
                />
                <Input
                  label="EAN / Clave"
                  value={form.ean}
                  onChange={(value) => setForm((prev) => ({ ...prev, ean: value }))}
                />
                <Input
                  label="Descripción"
                  value={form.description}
                  onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Unidad</label>
                  <select
                    value={form.unit}
                    onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
                  >
                    <option value="">Selecciona una unidad</option>
                    {unitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, currency: event.target.value as "MXN" | "USD" }))
                    }
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
                  >
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>

                <Input
                  label="Costo promedio"
                  type="number"
                  value={form.averageCost}
                  onChange={(value) => setForm((prev) => ({ ...prev, averageCost: value }))}
                />
                <Input
                  label="Último costo"
                  type="number"
                  value={form.lastCost}
                  onChange={(value) => setForm((prev) => ({ ...prev, lastCost: value }))}
                />
                <Input
                  label="Stock"
                  type="number"
                  value={form.stock}
                  onChange={(value) => setForm((prev) => ({ ...prev, stock: value }))}
                />

                <label className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Producto activo
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={updateMutation.isPending}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}

const Input = ({ label, value, onChange, type = "text" }: InputProps) => {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
      />
    </div>
  );
};
