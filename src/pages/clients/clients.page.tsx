import { Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ClientInput } from "../../modules/clients/types/client.types";
import { notifier } from "../../shared/notifications/notifier";
import { useClientsStore } from "../../store/clients/clients.store";

const EMPTY_FORM: ClientInput = {
  name: "",
  lastname: "",
  whatsappPhone: "",
  email: "",
  rfc: "",
  companyName: "",
  phone: "",
};

export const ClientsPage = () => {
  const clients = useClientsStore((state) => state.clients);
  const loading = useClientsStore((state) => state.loading);
  const loadClients = useClientsStore((state) => state.loadClients);
  const addClient = useClientsStore((state) => state.addClient);
  const updateClient = useClientsStore((state) => state.updateClient);
  const deleteClient = useClientsStore((state) => state.deleteClient);

  const [form, setForm] = useState<ClientInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openClientModal, setOpenClientModal] = useState(false);

  useEffect(() => {
    void loadClients().catch((error) => {
      const message = error instanceof Error ? error.message : "No se pudieron cargar los clientes.";
      notifier.error(message);
    });
  }, [loadClients]);

  const title = editingId ? "Editar cliente" : "Nuevo cliente";

  const submitLabel = editingId ? "Actualizar cliente" : "Crear cliente";

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [clients]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const closeClientModal = () => {
    if (saving) return;
    setOpenClientModal(false);
    resetForm();
  };

  const openCreateClientModal = () => {
    resetForm();
    setOpenClientModal(true);
  };

  const openEditClientModal = (client: {
    id: string;
    name: string;
    lastname: string;
    whatsappPhone: string;
    email: string;
    rfc: string;
    companyName: string;
    phone?: string | null;
  }) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      lastname: client.lastname,
      whatsappPhone: client.whatsappPhone,
      email: client.email,
      rfc: client.rfc,
      companyName: client.companyName,
      phone: client.phone ?? "",
    });
    setOpenClientModal(true);
  };

  const validate = () => {
    if (!form.name.trim()) return "El nombre es obligatorio";
    if (!form.lastname.trim()) return "El apellido es obligatorio";
    if (!form.whatsappPhone.trim()) return "El WhatsApp es obligatorio";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const error = validate();
    if (error) {
      notifier.warning(error);
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateClient(editingId, form);
        notifier.success("Cliente actualizado.");
      } else {
        await addClient(form);
        notifier.success("Cliente creado.");
      }

      setOpenClientModal(false);
      resetForm();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo guardar el cliente.";
      notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Clientes</h2>
            <p className="text-xs text-gray-500">Seleccionables en el cotizador para ligar datos de contacto.</p>
          </div>

          <button
            type="button"
            onClick={openCreateClientModal}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>

        <div className="overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Empresa</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">WhatsApp</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Correo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">RFC</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Creado por</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">
                    Cargando clientes...
                  </td>
                </tr>
              )}

              {!loading && sortedClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">
                    No hay clientes registrados.
                  </td>
                </tr>
              )}

              {sortedClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {client.name} {client.lastname}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{client.companyName}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{client.whatsappPhone}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{client.email}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{client.rfc}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{client.createdByName || "Sistema"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => openEditClientModal(client)}
                        className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                        aria-label="Editar cliente"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={async () => {
                          const allowDelete = window.confirm("¿Eliminar cliente?");
                          if (!allowDelete) return;

                          try {
                            setDeletingId(client.id);
                            await deleteClient(client.id);
                            if (editingId === client.id) {
                              setOpenClientModal(false);
                              resetForm();
                            }
                          } catch (deleteError) {
                            const message =
                              deleteError instanceof Error
                                ? deleteError.message
                                : "No se pudo eliminar el cliente.";
                            notifier.error(message);
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                        disabled={deletingId === client.id}
                        className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                        aria-label="Eliminar cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeClientModal}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar modal de cliente"
          />

          <div className="relative w-full max-w-xl rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                <p className="text-xs text-gray-500">Datos obligatorios para cotizar y enviar por WhatsApp/correo.</p>
              </div>

              <button
                type="button"
                onClick={closeClientModal}
                disabled={saving}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-4 py-3">
              <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                <Input
                  label="Nombre"
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                />

                <Input
                  label="Apellido"
                  value={form.lastname}
                  onChange={(value) => setForm((prev) => ({ ...prev, lastname: value }))}
                />

                <Input
                  label="WhatsApp"
                  value={form.whatsappPhone}
                  onChange={(value) => setForm((prev) => ({ ...prev, whatsappPhone: value }))}
                />

                <Input
                  label="Correo"
                  value={form.email}
                  onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                />

                <Input
                  label="RFC"
                  value={form.rfc}
                  onChange={(value) => setForm((prev) => ({ ...prev, rfc: value }))}
                />

                <Input
                  label="Empresa"
                  value={form.companyName}
                  onChange={(value) => setForm((prev) => ({ ...prev, companyName: value }))}
                />

                <Input
                  label="Teléfono alterno"
                  value={form.phone ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={closeClientModal}
                  disabled={saving}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" />
                  {saving ? "Guardando..." : submitLabel}
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
}

const Input = ({ label, value, onChange }: InputProps) => {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
      />
    </div>
  );
};
