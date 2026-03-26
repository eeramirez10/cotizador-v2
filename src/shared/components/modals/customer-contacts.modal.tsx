import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CustomerContactsService } from "../../../modules/clients/services/customer-contacts.service";
import type {
  CustomerContact,
  CustomerContactInput,
} from "../../../modules/clients/types/customer-contact.types";
import { notifier } from "../../notifications/notifier";

interface CustomerContactsModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  customerLabel: string;
}

const EMPTY_FORM: CustomerContactInput = {
  name: "",
  jobTitle: "",
  email: "",
  phone: "",
  mobile: "",
  isPrimary: false,
};

export const CustomerContactsModal = ({
  open,
  onClose,
  customerId,
  customerLabel,
}: CustomerContactsModalProps) => {
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerContactInput>(EMPTY_FORM);

  useEffect(() => {
    if (!open || !customerId) return;
    void loadContacts(customerId);
  }, [open, customerId]);

  const loadContacts = async (targetCustomerId: string) => {
    try {
      setLoading(true);
      const list = await CustomerContactsService.list(targetCustomerId);
      setContacts(list);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron cargar los contactos del cliente.";
      notifier.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingContactId(null);
    setForm(EMPTY_FORM);
  };

  const handleEdit = (contact: CustomerContact) => {
    setEditingContactId(contact.id);
    setForm({
      name: contact.name,
      jobTitle: contact.jobTitle || "",
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      isPrimary: contact.isPrimary,
    });
  };

  const handleSave = async () => {
    if (!customerId) return;

    const name = form.name?.trim() || "";
    if (!name) {
      notifier.warning("El nombre del contacto es obligatorio.");
      return;
    }

    const hasAnyChannel = Boolean(
      (form.email || "").trim() || (form.phone || "").trim() || (form.mobile || "").trim()
    );
    if (!hasAnyChannel) {
      notifier.warning("Captura al menos correo, teléfono o móvil.");
      return;
    }

    try {
      setSaving(true);

      if (editingContactId) {
        await CustomerContactsService.update(customerId, editingContactId, form);
        notifier.success("Contacto actualizado.");
      } else {
        await CustomerContactsService.create(customerId, form);
        notifier.success("Contacto agregado.");
      }

      await loadContacts(customerId);
      resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar el contacto.";
      notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!customerId) return;
    const confirmed = window.confirm("¿Eliminar este contacto?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await CustomerContactsService.remove(customerId, contactId);
      notifier.success("Contacto eliminado.");
      await loadContacts(customerId);
      if (editingContactId === contactId) resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo eliminar el contacto.";
      notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar modal contactos"
      />

      <div className="relative w-full max-w-5xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Contactos del cliente</h3>
            <p className="text-xs text-gray-500">{customerLabel || "Cliente sin nombre"}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Contacto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Cargo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">WhatsApp</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Teléfono</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Correo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Principal</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando contactos...
                      </span>
                    </td>
                  </tr>
                )}

                {!loading && contacts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                      No hay contactos registrados para este cliente.
                    </td>
                  </tr>
                )}

                {!loading &&
                  contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td className="px-3 py-2 text-xs text-gray-700">{contact.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{contact.jobTitle || "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{contact.mobile || "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{contact.phone || "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{contact.email || "-"}</td>
                      <td className="px-3 py-2 text-xs">
                        {contact.isPrimary ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Sí
                          </span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(contact)}
                            className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDelete(contact.id);
                            }}
                            disabled={saving}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <aside className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-gray-600">
                {editingContactId ? "Editar contacto" : "Agregar contacto"}
              </h4>
              {editingContactId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Input label="Nombre" value={form.name || ""} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
              <Input
                label="Cargo"
                value={form.jobTitle || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, jobTitle: value }))}
              />
              <Input
                label="WhatsApp"
                value={form.mobile || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
              />
              <Input
                label="Teléfono"
                value={form.phone || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
              />
              <Input
                label="Correo"
                value={form.email || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
              />

              <label className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.isPrimary)}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPrimary: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Contacto principal
              </label>

              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={saving || !customerId}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Guardando..." : editingContactId ? "Guardar cambios" : "Agregar contacto"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const Input = ({ label, value, onChange }: InputProps) => (
  <div>
    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

