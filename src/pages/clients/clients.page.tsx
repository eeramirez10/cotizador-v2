import { AxiosError } from "axios";
import {
  Building2,
  CircleOff,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Search,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Client, ClientInput } from "../../modules/clients/types/client.types";
import type { CustomerContactInput } from "../../modules/clients/types/customer-contact.types";
import { emptyCustomerContact } from "../../modules/clients/utils/customer-contact-form";
import { CustomerContactsEditor } from "../../shared/components/forms/customer-contacts.editor";
import { notifier } from "../../shared/notifications/notifier";
import { isValidEmail, isValidPhoneNumber } from "../../shared/utils/contact-validation";
import { useAuthStore } from "../../store/auth/auth.store";
import { useClientsStore } from "../../store/clients/clients.store";

type SourceFilter = "ALL" | "LOCAL" | "ERP";

const EMPTY_FORM: ClientInput = {
  name: "",
  lastname: "",
  whatsappPhone: "",
  email: "",
  rfc: "",
  companyName: "",
  phone: "",
  taxRegime: "",
  billingStreet: "",
  billingExteriorNumber: "",
  billingInteriorNumber: "",
  billingNeighborhood: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountry: "MÉXICO",
  profileStatus: "PROSPECT",
  notes: "",
  contacts: [emptyCustomerContact(true)],
};

const contactsFromClient = (client: Client): CustomerContactInput[] => {
  if (client.contacts?.length) {
    return client.contacts.map((contact) => ({
      name: contact.name,
      jobTitle: contact.jobTitle,
      label: contact.label,
      email: contact.email,
      phone: contact.phone,
      phoneExtension: contact.phoneExtension,
      mobile: contact.mobile,
      isPrimary: contact.isPrimary,
    }));
  }

  if (client.email || client.phone || client.whatsappPhone) {
    return [{
      name: `${client.name} ${client.lastname}`.trim() || "Contacto principal",
      jobTitle: "",
      label: "Contacto principal",
      email: client.email,
      phone: client.phone || "",
      phoneExtension: "",
      mobile: client.whatsappPhone,
      isPrimary: true,
    }];
  }

  return [emptyCustomerContact(true)];
};

const clientToForm = (client: Client): ClientInput => ({
  source: client.source,
  externalId: client.externalId,
  externalSystem: client.externalSystem,
  code: client.code,
  name: client.name,
  lastname: client.lastname,
  whatsappPhone: client.whatsappPhone,
  email: client.email,
  rfc: client.rfc,
  companyName: client.companyName,
  phone: client.phone || "",
  taxRegime: client.taxRegime || "",
  billingStreet: client.billingStreet || "",
  billingExteriorNumber: client.billingExteriorNumber || "",
  billingInteriorNumber: client.billingInteriorNumber || "",
  billingNeighborhood: client.billingNeighborhood || "",
  billingCity: client.billingCity || "",
  billingState: client.billingState || "",
  billingPostalCode: client.billingPostalCode || "",
  billingCountry: client.billingCountry || "MÉXICO",
  profileStatus: client.profileStatus || "PROSPECT",
  notes: client.notes || "",
  contacts: contactsFromClient(client),
});

const primaryContact = (client: Client) =>
  client.contacts?.find((contact) => contact.isPrimary)
  || client.contacts?.find((contact) => contact.email || contact.mobile)
  || client.contacts?.[0];

export const ClientsPage = () => {
  const actor = useAuthStore((state) => state.user);
  const role = (actor?.role || "").trim().toLowerCase();
  const canDelete = role === "admin" || role === "manager";

  const clients = useClientsStore((state) => state.clients);
  const loading = useClientsStore((state) => state.loading);
  const loadClients = useClientsStore((state) => state.loadClients);
  const addClient = useClientsStore((state) => state.addClient);
  const updateClient = useClientsStore((state) => state.updateClient);
  const deleteClient = useClientsStore((state) => state.deleteClient);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadClients().catch((error) => {
      notifier.error(error instanceof Error ? error.message : "No se pudieron cargar los clientes.");
    });
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (sourceFilter !== "ALL" && client.source !== sourceFilter) return false;
      if (!term) return true;
      return [
        client.companyName,
        client.name,
        client.lastname,
        client.rfc,
        client.code,
        client.email,
        client.whatsappPhone,
        client.phone,
        ...(client.contacts || []).flatMap((contact) => [
          contact.name,
          contact.email || "",
          contact.phone || "",
          contact.mobile || "",
        ]),
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [clients, search, sourceFilter]);

  const metrics = useMemo(() => ({
    total: clients.length,
    erp: clients.filter((client) => client.source === "ERP").length,
    local: clients.filter((client) => client.source !== "ERP").length,
    contactable: clients.filter((client) => Boolean(client.email || client.whatsappPhone || client.contacts?.some((contact) => contact.email || contact.mobile))).length,
  }), [clients]);

  const openCreate = () => {
    setSelectedClient({ id: "", source: "LOCAL" } as Client);
    setForm({ ...EMPTY_FORM, contacts: [emptyCustomerContact(true)] });
  };

  const openClient = (client: Client) => {
    setSelectedClient(client);
    setForm(clientToForm(client));
  };

  const closeClient = () => {
    if (saving) return;
    setSelectedClient(null);
    setForm(EMPTY_FORM);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return "El nombre es obligatorio.";
    if (!form.lastname.trim()) return "El apellido es obligatorio.";

    const contacts = form.contacts || [];
    if (contacts.length === 0) return "Agrega al menos un contacto.";
    for (let index = 0; index < contacts.length; index += 1) {
      const contact = contacts[index];
      if (!contact.name.trim()) return `El nombre del contacto ${index + 1} es obligatorio.`;
      if (!contact.email?.trim() && !contact.phone?.trim() && !contact.mobile?.trim()) {
        return `Captura al menos un medio para el contacto ${index + 1}.`;
      }
      if (contact.email?.trim() && !isValidEmail(contact.email)) {
        return `El correo del contacto ${index + 1} no es válido.`;
      }
      if (contact.phone?.trim() && !isValidPhoneNumber(contact.phone)) {
        return `El teléfono fijo del contacto ${index + 1} no es válido.`;
      }
      if (contact.mobile?.trim() && !isValidPhoneNumber(contact.mobile)) {
        return `El WhatsApp del contacto ${index + 1} no es válido.`;
      }
    }

    if (!contacts.some((contact) => contact.email?.trim() || contact.mobile?.trim())) {
      return "El cliente debe tener al menos un correo o WhatsApp para enviar cotizaciones.";
    }
    return null;
  };

  const saveClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClient || selectedClient.source === "ERP") return;
    const validationError = validate();
    if (validationError) return notifier.warning(validationError);

    const contacts = (form.contacts || []).map((contact, index) => ({
      ...contact,
      name: contact.name.trim(),
      jobTitle: contact.jobTitle?.trim() || null,
      label: contact.label?.trim() || null,
      email: contact.email?.trim().toLowerCase() || null,
      phone: contact.phone?.trim() || null,
      phoneExtension: contact.phoneExtension?.trim() || null,
      mobile: contact.mobile?.trim() || null,
      isPrimary: contact.isPrimary || (index === 0 && !(form.contacts || []).some((entry) => entry.isPrimary)),
    }));
    const deliveryContact = contacts.find((contact) => contact.isPrimary && (contact.email || contact.mobile))
      || contacts.find((contact) => contact.email || contact.mobile)!;
    const input: ClientInput = {
      ...form,
      email: deliveryContact.email || "",
      phone: deliveryContact.phone || "",
      whatsappPhone: deliveryContact.mobile || "",
      contacts,
    };

    const toast = notifier.loading(selectedClient.id ? "Actualizando cliente..." : "Creando cliente...");
    try {
      setSaving(true);
      if (selectedClient.id) await updateClient(selectedClient.id, input);
      else await addClient(input);
      if (toast !== undefined) notifier.update(toast, "success", selectedClient.id ? "Cliente actualizado." : "Cliente creado.");
      else notifier.success(selectedClient.id ? "Cliente actualizado." : "Cliente creado.");
      setSelectedClient(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      const message = error instanceof AxiosError
        ? String(error.response?.data?.error || "No se pudo guardar el cliente.")
        : error instanceof Error ? error.message : "No se pudo guardar el cliente.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const toast = notifier.loading("Desactivando cliente...");
    try {
      setDeleting(true);
      await deleteClient(deleteTarget.id);
      if (toast !== undefined) notifier.update(toast, "success", "Cliente desactivado.");
      else notifier.success("Cliente desactivado.");
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo desactivar el cliente.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 px-5 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Ventas y relación comercial</p>
              <h1 className="mt-1 text-2xl font-bold">Clientes</h1>
              <p className="mt-1 text-sm text-slate-300">Directorio consolidado de clientes locales y sincronizados desde ERP.</p>
            </div>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300">
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </button>
          </div>
        </div>

        <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total registrados" value={metrics.total} icon={<Building2 className="h-4 w-4" />} />
          <Metric label="Clientes ERP" value={metrics.erp} icon={<Users className="h-4 w-4" />} />
          <Metric label="Clientes locales" value={metrics.local} icon={<Store className="h-4 w-4" />} />
          <Metric label="Con canal de envío" value={metrics.contactable} icon={<Mail className="h-4 w-4" />} />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por empresa, nombre, código, RFC, correo o teléfono..." className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </label>
          <Filter value={sourceFilter} onChange={(value) => setSourceFilter(value as SourceFilter)} />
        </div>

        <div className="max-h-[calc(100vh-340px)] min-h-80 overflow-auto">
          <table className="min-w-[1050px] w-full divide-y divide-slate-200">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                {["Cliente", "Origen", "Contacto principal", "Empresa / RFC", "Ubicación", "Canal de envío", "Creado por", "Acciones"].map((label) => (
                  <th key={label} className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 ${label === "Acciones" ? "text-right" : ""}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && <TableMessage message="Cargando clientes..." loading />}
              {!loading && filteredClients.length === 0 && <TableMessage message="No hay clientes que coincidan con los filtros." />}
              {filteredClients.map((client) => {
                const contact = primaryContact(client);
                const email = contact?.email || client.email;
                const whatsapp = contact?.mobile || client.whatsappPhone;
                return (
                  <tr key={client.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-3">
                      <p className="max-w-64 truncate text-sm font-bold text-slate-900">{client.companyName || `${client.name} ${client.lastname}`}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{client.code ? `Código ERP: ${client.code}` : `${client.name} ${client.lastname}`.trim()}</p>
                    </td>
                    <td className="px-4 py-3"><SourceBadge source={client.source || "LOCAL"} /></td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-800">{contact?.name || `${client.name} ${client.lastname}`.trim()}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{contact?.jobTitle || contact?.label || "Sin puesto definido"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600"><p>{client.companyName || "Particular"}</p><p className="mt-1 text-[11px] text-slate-400">{client.rfc || "Sin RFC"}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600"><p>{client.billingCity || "-"}</p><p className="mt-1 text-[11px] text-slate-400">{client.billingState || client.billingCountry || "-"}</p></td>
                    <td className="px-4 py-3">
                      {email && <p className="flex items-center gap-1 text-[11px] text-slate-600"><Mail className="h-3 w-3" />{email}</p>}
                      {whatsapp && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700"><MessageCircle className="h-3 w-3" />{whatsapp}</p>}
                      {!email && !whatsapp && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700">Sin canal de envío</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{client.createdByName || "Sistema"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => openClient(client)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100" title={client.source === "ERP" ? "Ver detalle" : "Editar cliente"}>
                          {client.source === "ERP" ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </button>
                        {canDelete && client.source !== "ERP" && (
                          <button type="button" onClick={() => setDeleteTarget(client)} className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50" title="Desactivar cliente">
                            <CircleOff className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">Mostrando {filteredClients.length} de {clients.length} clientes.</div>
      </section>

      {selectedClient && (
        <ClientModal
          client={selectedClient}
          form={form}
          setForm={setForm}
          editable={selectedClient.source !== "ERP"}
          saving={saving}
          onClose={closeClient}
          onSubmit={saveClient}
        />
      )}
      {deleteTarget && <DeleteClientModal client={deleteTarget} busy={deleting} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
    </div>
  );
};

const ClientModal = ({
  client,
  form,
  setForm,
  editable,
  saving,
  onClose,
  onSubmit,
}: {
  client: Client;
  form: ClientInput;
  setForm: React.Dispatch<React.SetStateAction<ClientInput>>;
  editable: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) => (
  <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
    <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">{client.id ? (editable ? "Editar cliente" : "Detalle ERP") : "Nuevo registro"}</p><h2 className="mt-1 text-xl font-bold">{form.companyName || `${form.name} ${form.lastname}`.trim() || "Nuevo cliente"}</h2></div>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </header>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <FormSection title="Datos generales" description="Identificación comercial y fiscal del cliente.">
            <FormField label="Nombre *" value={form.name} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <FormField label="Apellido *" value={form.lastname} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, lastname: value }))} />
            <FormField label="Empresa / razón social" value={form.companyName} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, companyName: value }))} wide />
            <FormField label="RFC" value={form.rfc} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, rfc: value.toUpperCase() }))} />
            <FormField label="Régimen fiscal" value={form.taxRegime || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, taxRegime: value }))} />
            {client.source === "ERP" && <FormField label="Código ERP" value={client.code || ""} disabled onChange={() => undefined} />}
          </FormSection>

          <FormSection title="Dirección fiscal" description="Datos segmentados para documentos fiscales y comerciales.">
            <FormField label="Calle" value={form.billingStreet || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingStreet: value }))} wide />
            <FormField label="Número exterior" value={form.billingExteriorNumber || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingExteriorNumber: value }))} />
            <FormField label="Número interior" value={form.billingInteriorNumber || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingInteriorNumber: value }))} />
            <FormField label="Colonia" value={form.billingNeighborhood || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingNeighborhood: value }))} />
            <FormField label="Ciudad / municipio" value={form.billingCity || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingCity: value }))} />
            <FormField label="Estado" value={form.billingState || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingState: value }))} />
            <FormField label="Código postal" value={form.billingPostalCode || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingPostalCode: value }))} />
            <FormField label="País" value={form.billingCountry || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, billingCountry: value }))} />
          </FormSection>

          <CustomerContactsEditor contacts={form.contacts || []} onChange={(contacts) => setForm((current) => ({ ...current, contacts }))} disabled={!editable} />

          <FormSection title="Notas internas" description="Información visible únicamente dentro del cotizador.">
            <label className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold text-slate-600">Notas<textarea value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} disabled={!editable} rows={3} className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100" /></label>
          </FormSection>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cerrar</button>
          {editable && <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{client.id ? "Guardar cambios" : "Crear cliente"}</button>}
        </footer>
      </form>
    </div>
  </div>
);

const FormSection = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-slate-200 p-4"><div className="mb-4"><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-[11px] text-slate-500">{description}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div></section>
);

const FormField = ({ label, value, onChange, disabled, wide = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; wide?: boolean }) => (
  <label className={`text-[11px] font-semibold text-slate-600 ${wide ? "lg:col-span-2" : ""}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-500" /></label>
);

const Metric = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <div className="bg-white px-5 py-4"><div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-[10px] font-bold uppercase tracking-wide">{label}</span></div><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>
);

const Filter = ({ value, onChange }: { value: SourceFilter; onChange: (value: string) => void }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-amber-500">
    <option value="ALL">Todos los orígenes</option><option value="ERP">ERP</option><option value="LOCAL">Locales</option>
  </select>
);

const SourceBadge = ({ source }: { source: "LOCAL" | "ERP" }) => <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${source === "ERP" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-900"}`}>{source}</span>;

const TableMessage = ({ message, loading = false }: { message: string; loading?: boolean }) => (
  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500"><span className="inline-flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{message}</span></td></tr>
);

const DeleteClientModal = ({ client, busy, onClose, onConfirm }: { client: Client; busy: boolean; onClose: () => void; onConfirm: () => void }) => (
  <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex gap-3"><span className="rounded-xl bg-rose-100 p-2 text-rose-700"><CircleOff className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-slate-950">Desactivar cliente</h2><p className="mt-2 text-sm text-slate-600">El cliente dejará de aparecer en nuevas selecciones, pero conservará su historial y cotizaciones.</p><p className="mt-3 text-sm font-bold text-slate-900">{client.companyName || `${client.name} ${client.lastname}`}</p></div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Desactivar</button></div></div></div>
);
