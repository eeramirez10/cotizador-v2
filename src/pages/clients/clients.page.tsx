import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ClientInput } from "../../modules/clients/types/client.types";
import { useAuthStore } from "../../store/auth/auth.store";
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
  const user = useAuthStore((state) => state.user);
  const clients = useClientsStore((state) => state.clients);
  const seedClients = useClientsStore((state) => state.seedClients);
  const addClient = useClientsStore((state) => state.addClient);
  const updateClient = useClientsStore((state) => state.updateClient);
  const deleteClient = useClientsStore((state) => state.deleteClient);

  const [form, setForm] = useState<ClientInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    seedClients();
  }, [seedClients]);

  const title = editingId ? "Editar cliente" : "Nuevo cliente";

  const submitLabel = editingId ? "Actualizar cliente" : "Crear cliente";

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [clients]);

  const actorName = `${user?.name ?? ""} ${user?.lastname ?? ""}`.trim() || "Usuario";
  const actor = {
    userId: user?.id ?? null,
    fullName: actorName,
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const validate = () => {
    if (!form.name.trim()) return "El nombre es obligatorio";
    if (!form.lastname.trim()) return "El apellido es obligatorio";
    if (!form.whatsappPhone.trim()) return "El WhatsApp es obligatorio";
    if (!form.email.trim()) return "El correo es obligatorio";
    if (!form.rfc.trim()) return "El RFC es obligatorio";
    if (!form.companyName.trim()) return "La empresa es obligatoria";
    return null;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const error = validate();
    if (error) {
      window.alert(error);
      return;
    }

    if (editingId) {
      updateClient(editingId, form, actor);
      window.alert("Cliente actualizado.");
      resetForm();
      return;
    }

    addClient(form, actor);
    window.alert("Cliente creado.");
    resetForm();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <p className="mb-4 text-xs text-gray-500">Datos obligatorios para cotizar y enviar por WhatsApp/correo.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
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

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
            >
              <UserPlus className="h-4 w-4" />
              {submitLabel}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Clientes</h2>
        <p className="mb-4 text-xs text-gray-500">Seleccionables en el cotizador para ligar datos de contacto.</p>

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
              {sortedClients.length === 0 && (
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
                        onClick={() => {
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
                        }}
                        className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                        aria-label="Editar cliente"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => {
                          const allowDelete = window.confirm("¿Eliminar cliente?");
                          if (allowDelete) deleteClient(client.id);
                        }}
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
