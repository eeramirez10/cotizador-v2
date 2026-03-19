import { Building2, Loader2, Pencil, Power, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ManagedBranch } from "../../modules/branches/services/branches.service";
import {
  useBranchesList,
  useCreateBranch,
  useDeactivateBranch,
  useUpdateBranch,
} from "../../queries/branches/use-branches";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

interface BranchFormState {
  code: string;
  name: string;
  address: string;
}

const EMPTY_FORM: BranchFormState = {
  code: "",
  name: "",
  address: "",
};

export const BranchesPage = () => {
  const user = useAuthStore((state) => state.user);
  const role = (user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ManagedBranch | null>(null);
  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM);

  const branchesQuery = useBranchesList();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const deactivateMutation = useDeactivateBranch();

  const savePending = createMutation.isPending || updateMutation.isPending;
  const branches = branchesQuery.data || [];

  const filteredBranches = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return branches;

    return branches.filter((branch) =>
      [branch.code, branch.name, branch.address || ""].join(" ").toLowerCase().includes(normalized)
    );
  }, [branches, search]);

  const closeModal = () => {
    if (savePending) return;
    setOpenModal(false);
    setEditingBranch(null);
    setForm(EMPTY_FORM);
  };

  const openCreateModal = () => {
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setOpenModal(true);
  };

  const openEditModal = (branch: ManagedBranch) => {
    setEditingBranch(branch);
    setForm({
      code: branch.code,
      name: branch.name,
      address: branch.address || "",
    });
    setOpenModal(true);
  };

  const validate = (): string | null => {
    if (!form.code.trim()) return "El código de sucursal es obligatorio.";
    if (form.code.trim().length > 10) return "El código no debe exceder 10 caracteres.";
    if (!form.name.trim()) return "El nombre de sucursal es obligatorio.";
    if (form.name.trim().length > 120) return "El nombre no debe exceder 120 caracteres.";
    if (form.address.trim().length > 255) return "La dirección no debe exceder 255 caracteres.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      notifier.warning(validationError);
      return;
    }

    try {
      if (editingBranch) {
        await updateMutation.mutateAsync({
          branchId: editingBranch.id,
          input: {
            code: form.code,
            name: form.name,
            address: form.address || null,
          },
        });
        notifier.success("Sucursal actualizada.");
      } else {
        await createMutation.mutateAsync({
          code: form.code,
          name: form.name,
          address: form.address || null,
        });
        notifier.success("Sucursal creada.");
      }

      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la sucursal.";
      notifier.error(message);
    }
  };

  const handleDeactivate = async (branch: ManagedBranch) => {
    try {
      await deactivateMutation.mutateAsync(branch.id);
      notifier.success(`Sucursal ${branch.code} desactivada.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo desactivar la sucursal.";
      notifier.error(message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        Esta vista es solo para usuarios con rol Administrador.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="max-w-md">
            <h2 className="text-lg font-semibold text-gray-800">Sucursales</h2>
            <p className="text-xs text-gray-500">Catálogo de sucursales activas para usuarios y cotizaciones.</p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            <Building2 className="h-4 w-4" />
            Nueva sucursal
          </button>
        </div>

        <div className="mb-3 relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar por código, nombre o dirección..."
          />
        </div>

        <div className="overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Dirección</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Estatus</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {branchesQuery.isFetching && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">
                    Cargando sucursales...
                  </td>
                </tr>
              )}

              {!branchesQuery.isFetching && filteredBranches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">
                    No se encontraron sucursales.
                  </td>
                </tr>
              )}

              {filteredBranches.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700">{branch.code}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{branch.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{branch.address || "-"}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      Activa
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(branch)}
                        className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                        aria-label="Editar sucursal"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleDeactivate(branch);
                        }}
                        disabled={deactivateMutation.isPending}
                        className="rounded-md border border-rose-300 p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        aria-label="Desactivar sucursal"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeModal}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar modal de sucursal"
          />

          <div className="relative w-full max-w-xl rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingBranch ? "Editar sucursal" : "Nueva sucursal"}
                </h2>
                <p className="text-xs text-gray-500">Define código único, nombre y dirección opcional.</p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={savePending}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
              <Input
                label="Código"
                value={form.code}
                onChange={(value) => setForm((prev) => ({ ...prev, code: value.toUpperCase() }))}
                placeholder="Ej. 07"
              />

              <Input
                label="Nombre"
                value={form.name}
                onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="Ej. Puebla"
              />

              <Input
                label="Dirección (opcional)"
                value={form.address}
                onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
                placeholder="Ej. Av. Reforma 123"
              />

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={savePending}
                  className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savePending}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60"
                >
                  {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingBranch ? "Guardar cambios" : "Crear sucursal"}
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
  placeholder?: string;
}

const Input = ({ label, value, onChange, placeholder }: InputProps) => (
  <div>
    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);
