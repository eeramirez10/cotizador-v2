import { LockKeyhole, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomerContactsService } from "../../../modules/clients/services/customer-contacts.service";
import type {
  CustomerContact,
  CustomerContactInput,
} from "../../../modules/clients/types/customer-contact.types";
import { notifier } from "../../notifications/notifier";
import { isValidEmail, isValidPhoneNumber } from "../../utils/contact-validation";

interface CustomerContactsModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  customerLabel: string;
  onChanged?: () => void | Promise<void>;
  lockOldestContact?: boolean;
  selectionMode?: boolean;
  onSelectContact?: (contact: CustomerContact) => void;
}

const EMPTY_FORM: CustomerContactInput = {
  name: "",
  jobTitle: "",
  label: "",
  email: "",
  phone: "",
  phoneExtension: "",
  mobile: "",
  isPrimary: false,
};

export const CustomerContactsModal = ({
  open,
  onClose,
  customerId,
  customerLabel,
  onChanged,
  lockOldestContact = false,
  selectionMode = false,
  onSelectContact,
}: CustomerContactsModalProps) => {
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerContactInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<CustomerContact | null>(null);
  const lockedContactId = useMemo(() => {
    if (!lockOldestContact || contacts.length === 0) return null;
    return [...contacts].sort((left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )[0]?.id || null;
  }, [contacts, lockOldestContact]);

  useEffect(() => {
    if (!open || !customerId) return;
    setEditingContactId(null);
    setForm(EMPTY_FORM);
    setDeleteTarget(null);
    void loadContacts(customerId);
  }, [open, customerId]);

  const emitChanged = () => {
    if (!onChanged) return;
    void Promise.resolve(onChanged()).catch((error) => {
      notifier.error(error instanceof Error ? error.message : "El contacto se guardó, pero no se pudo actualizar el listado.");
    });
  };

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
      label: contact.label || "",
      email: contact.email || "",
      phone: contact.phone || "",
      phoneExtension: contact.phoneExtension || "",
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
    if (form.email?.trim() && !isValidEmail(form.email)) {
      notifier.warning("El correo no tiene un formato válido.");
      return;
    }
    if (form.phone?.trim() && !isValidPhoneNumber(form.phone)) {
      notifier.warning("El teléfono debe ser un número válido de 10 a 15 dígitos.");
      return;
    }
    if (form.mobile?.trim() && !isValidPhoneNumber(form.mobile)) {
      notifier.warning("El WhatsApp debe ser un número válido de 10 a 15 dígitos.");
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
      emitChanged();
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

    try {
      setSaving(true);
      await CustomerContactsService.remove(customerId, contactId);
      notifier.success("Contacto eliminado.");
      await loadContacts(customerId);
      if (editingContactId === contactId) resetForm();
      setDeleteTarget(null);
      emitChanged();
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
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar modal contactos"
      />

      <div className="relative w-full max-w-5xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              {selectionMode ? "Seleccionar contacto" : "Contactos del cliente"}
            </h3>
            <p className="text-xs text-gray-500">
              {customerLabel || "Cliente sin nombre"}
              {selectionMode ? " · El contacto elegido se anexará a la cotización." : ""}
            </p>
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

        <div className={`grid gap-4 p-4 ${selectionMode ? "grid-cols-1" : "lg:grid-cols-[1fr_320px]"}`}>
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
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">
                    {selectionMode ? "Seleccionar" : "Acciones"}
                  </th>
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
                      <td className="px-3 py-2 text-xs text-gray-700">
                        <span>{contact.name}</span>
                        {contact.id === lockedContactId && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                            <LockKeyhole className="h-2.5 w-2.5" />
                            ERP
                          </span>
                        )}
                      </td>
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
                        {selectionMode ? (
                          <button
                            type="button"
                            onClick={() => onSelectContact?.(contact)}
                            className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-emerald-600 hover:to-teal-700"
                          >
                            Elegir contacto
                          </button>
                        ) : contact.id === lockedContactId ? (
                          <span className="text-[10px] font-semibold text-slate-400">Solo lectura</span>
                        ) : (
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
                            onClick={() => setDeleteTarget(contact)}
                            disabled={saving}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </span>
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!selectionMode && <aside className="rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                label="Área o etiqueta"
                value={form.label || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, label: value }))}
              />
              <Input
                label="WhatsApp"
                type="tel"
                value={form.mobile || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
              />
              <Input
                label="Teléfono fijo"
                type="tel"
                value={form.phone || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
              />
              <Input
                label="Extensión"
                value={form.phoneExtension || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, phoneExtension: value.replace(/\D/g, "").slice(0, 10) }))}
              />
              <Input
                label="Correo"
                type="email"
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
          </aside>}
        </div>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h4 className="text-lg font-bold text-slate-950">Eliminar contacto</h4>
            <p className="mt-2 text-sm text-slate-600">El contacto dejará de estar disponible para nuevas cotizaciones.</p>
            <p className="mt-3 text-sm font-bold text-slate-900">{deleteTarget.name}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void handleDelete(deleteTarget.id)} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface InputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}

const Input = ({ label, type = "text", value, onChange }: InputProps) => (
  <div>
    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);
