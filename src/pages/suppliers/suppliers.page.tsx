import {
  Building2,
  CheckCircle2,
  CircleOff,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Store,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type {
  SaveSupplierContactInput,
  SaveSupplierInput,
  Supplier,
} from "../../modules/procurement/services/purchase-requisitions.service";
import {
  usePurchaseRequisitionMutations,
  useSuppliers,
} from "../../queries/procurement/use-purchase-requisitions";
import {
  SelectOrCreateSupplierModal,
  SupplierContactsEditor,
  groupSupplierContacts,
} from "../../shared/components/modals/select-or-create-supplier.modal";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

type SourceFilter = "ALL" | Supplier["source"];
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type ScopeFilter = "ALL" | Supplier["scope"];

interface SupplierFormState {
  name: string;
  scope: Supplier["scope"];
  taxId: string;
  state: string;
  country: string;
  contactName: string;
  contactPosition: string;
  creditTerms: string;
  currency: "" | "MXN" | "USD";
  notes: string;
  contacts: SaveSupplierContactInput[];
}

const EMPTY_FORM: SupplierFormState = {
  name: "",
  scope: "NATIONAL",
  taxId: "",
  state: "",
  country: "MÉXICO",
  contactName: "",
  contactPosition: "",
  creditTerms: "",
  currency: "",
  notes: "",
  contacts: [],
};

const supplierContacts = (supplier: Supplier): SaveSupplierContactInput[] => {
  if (supplier.contacts?.length) {
    return supplier.contacts.map((contact) => ({
      contactKey: contact.contactKey,
      channel: contact.channel,
      value: contact.value,
      phoneKind: contact.phoneKind,
      extension: contact.extension,
      isWhatsApp: contact.isWhatsApp,
      contactName: contact.contactName,
      contactPosition: contact.contactPosition,
      label: contact.label,
      isPrimary: contact.isPrimary,
    }));
  }
  const legacyContactKey = `legacy-primary-${supplier.id}`;
  return [
    ...(supplier.email ? [{ contactKey: legacyContactKey, channel: "EMAIL" as const, value: supplier.email, phoneKind: null, extension: null, isWhatsApp: false, contactName: supplier.contactName, contactPosition: supplier.contactPosition, label: null, isPrimary: true }] : []),
    ...(supplier.phone ? [{ contactKey: legacyContactKey, channel: "PHONE" as const, value: supplier.phone, phoneKind: "UNKNOWN" as const, extension: supplier.phoneExtension, isWhatsApp: false, contactName: supplier.contactName, contactPosition: supplier.contactPosition, label: null, isPrimary: true }] : []),
  ];
};

const supplierToForm = (supplier: Supplier): SupplierFormState => ({
  name: supplier.name,
  scope: supplier.scope,
  taxId: supplier.taxId || "",
  state: supplier.state || "",
  country: supplier.country || (supplier.scope === "NATIONAL" ? "MÉXICO" : ""),
  contactName: supplier.contactName || "",
  contactPosition: supplier.contactPosition || "",
  creditTerms: supplier.creditTerms || "",
  currency: supplier.currency || "",
  notes: supplier.notes || "",
  contacts: supplierContacts(supplier),
});

const primaryContact = (supplier: Supplier, channel: "EMAIL" | "PHONE") =>
  supplier.contacts?.find((contact) => contact.channel === channel && contact.isPrimary)
  || supplier.contacts?.find((contact) => contact.channel === channel);

export const SuppliersPage = () => {
  const actor = useAuthStore((state) => state.user);
  const role = (actor?.role || "").trim().toLowerCase();
  const canManage = role === "admin" || role === "purchasing";
  const canCreate = canManage || role === "seller";
  const canRefreshErp = canCreate;

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Supplier | null>(null);

  const debouncedSearch = useDebouncedValue(search, 350);
  const suppliersQuery = useSuppliers(true, { search: debouncedSearch, includeInactive: true });
  const mutations = usePurchaseRequisitionMutations();
  const suppliers = suppliersQuery.data || [];

  useEffect(() => {
    if (suppliersQuery.error) {
      notifier.error(suppliersQuery.error instanceof Error ? suppliersQuery.error.message : "No se pudieron cargar los proveedores.");
    }
  }, [suppliersQuery.error]);

  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) =>
    (sourceFilter === "ALL" || supplier.source === sourceFilter)
    && (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? supplier.isActive : !supplier.isActive))
    && (scopeFilter === "ALL" || supplier.scope === scopeFilter)
  ), [scopeFilter, sourceFilter, statusFilter, suppliers]);

  const metrics = useMemo(() => ({
    total: suppliers.length,
    local: suppliers.filter((supplier) => supplier.source === "LOCAL").length,
    erp: suppliers.filter((supplier) => supplier.source === "ERP").length,
    inactive: suppliers.filter((supplier) => !supplier.isActive).length,
  }), [suppliers]);

  const openSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setForm(supplierToForm(supplier));
  };

  const closeSupplier = () => {
    if (mutations.updateSupplier.isPending || mutations.syncErpSupplier.isPending) return;
    setSelectedSupplier(null);
    setForm(EMPTY_FORM);
  };

  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSupplier || selectedSupplier.source !== "LOCAL" || !canManage) return;
    if (!form.name.trim()) return notifier.warning("El nombre del proveedor es obligatorio.");
    if (!form.country.trim()) return notifier.warning("El país es obligatorio.");
    const contacts = form.contacts.filter((contact) => contact.value.trim());
    const primaryContact = contacts.find((contact) => contact.isPrimary && contact.contactName)
      || contacts.find((contact) => contact.contactName);
    const input: SaveSupplierInput = {
      name: form.name.trim(),
      scope: form.scope,
      taxId: form.taxId.trim() || null,
      state: form.state.trim() || null,
      country: form.country.trim(),
      contactName: primaryContact?.contactName?.trim() || null,
      contactPosition: primaryContact?.contactPosition?.trim() || null,
      creditTerms: form.creditTerms.trim() || null,
      currency: form.currency || null,
      notes: form.notes.trim() || null,
      contacts,
    };
    const toast = notifier.loading("Actualizando proveedor...");
    try {
      await mutations.updateSupplier.mutateAsync({ supplierId: selectedSupplier.id, input });
      if (toast !== undefined) notifier.update(toast, "success", "Proveedor actualizado.");
      else notifier.success("Proveedor actualizado.");
      setSelectedSupplier(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el proveedor.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    }
  };

  const refreshErpSupplier = async (supplier: Supplier) => {
    if (!supplier.erpCode || !canRefreshErp) return;
    const toast = notifier.loading(`Actualizando ${supplier.erpCode} desde ERP...`);
    try {
      const updated = await mutations.syncErpSupplier.mutateAsync(supplier.erpCode);
      if (toast !== undefined) notifier.update(toast, "success", "Proveedor actualizado desde ERP.");
      else notifier.success("Proveedor actualizado desde ERP.");
      if (selectedSupplier?.id === supplier.id) {
        setSelectedSupplier(updated);
        setForm(supplierToForm(updated));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar desde ERP.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    }
  };

  const changeSupplierStatus = async () => {
    if (!statusTarget || !canManage) return;
    const nextStatus = !statusTarget.isActive;
    const toast = notifier.loading(nextStatus ? "Activando proveedor..." : "Desactivando proveedor...");
    try {
      const updated = await mutations.setSupplierActive.mutateAsync({ supplierId: statusTarget.id, isActive: nextStatus });
      if (toast !== undefined) notifier.update(toast, "success", nextStatus ? "Proveedor activado." : "Proveedor desactivado.");
      else notifier.success(nextStatus ? "Proveedor activado." : "Proveedor desactivado.");
      if (selectedSupplier?.id === updated.id) {
        setSelectedSupplier(updated);
        setForm(supplierToForm(updated));
      }
      setStatusTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cambiar el estado del proveedor.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 px-5 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Compras y abastecimiento</p>
              <h1 className="mt-1 text-2xl font-bold">Proveedores</h1>
              <p className="mt-1 text-sm text-slate-300">Directorio consolidado de proveedores locales y sincronizados desde ERP.</p>
            </div>
            {canCreate && <button type="button" onClick={() => setNewSupplierOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"><Plus className="h-4 w-4" />Nuevo proveedor</button>}
          </div>
        </div>

        <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total registrados" value={metrics.total} icon={<Building2 className="h-4 w-4" />} />
          <Metric label="Proveedores ERP" value={metrics.erp} icon={<RefreshCw className="h-4 w-4" />} />
          <Metric label="Proveedores locales" value={metrics.local} icon={<Store className="h-4 w-4" />} />
          <Metric label="Inactivos" value={metrics.inactive} icon={<CircleOff className="h-4 w-4" />} />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, código ERP, RFC, contacto, correo o teléfono..." className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </label>
          <Filter value={sourceFilter} onChange={(value) => setSourceFilter(value as SourceFilter)} options={[["ALL", "Todos los orígenes"], ["ERP", "ERP"], ["LOCAL", "Locales"]]} />
          <Filter value={scopeFilter} onChange={(value) => setScopeFilter(value as ScopeFilter)} options={[["ALL", "Nacional e internacional"], ["NATIONAL", "Nacionales"], ["INTERNATIONAL", "Internacionales"]]} />
          <Filter value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[["ALL", "Todos los estados"], ["ACTIVE", "Activos"], ["INACTIVE", "Inactivos"]]} />
          <button type="button" onClick={() => void suppliersQuery.refetch()} disabled={suppliersQuery.isFetching} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${suppliersQuery.isFetching ? "animate-spin" : ""}`} />Actualizar</button>
        </div>

        <div className="max-h-[calc(100vh-340px)] min-h-80 overflow-auto">
          <table className="min-w-[1100px] w-full divide-y divide-slate-200">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                {["Proveedor", "Origen", "Tipo", "Contacto principal", "Ubicación", "Condiciones", "Estado", "Acciones"].map((label) => <th key={label} className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 ${label === "Acciones" ? "text-right" : ""}`}>{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {suppliersQuery.isLoading && <TableMessage message="Cargando proveedores..." loading />}
              {!suppliersQuery.isLoading && filteredSuppliers.length === 0 && <TableMessage message="No hay proveedores que coincidan con los filtros." />}
              {filteredSuppliers.map((supplier) => {
                const email = primaryContact(supplier, "EMAIL")?.value || supplier.email;
                const phone = primaryContact(supplier, "PHONE")?.normalizedValue || supplier.phone || supplier.mobile;
                return (
                  <tr key={supplier.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-3">
                      <p className="max-w-72 truncate text-sm font-bold text-slate-900">{supplier.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{supplier.erpCode ? `Código ERP: ${supplier.erpCode}` : supplier.taxId ? `RFC: ${supplier.taxId}` : "Sin código ERP"}</p>
                    </td>
                    <td className="px-4 py-3"><SourceBadge source={supplier.source} /></td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{supplier.scope === "NATIONAL" ? "Nacional" : "Internacional"}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-800">{supplier.contactName || "Sin contacto"}</p>
                      {email && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Mail className="h-3 w-3" />{email}</p>}
                      {phone && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Phone className="h-3 w-3" />{phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600"><p>{supplier.state || "-"}</p><p className="mt-1 text-[11px] text-slate-400">{supplier.country || "-"}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600"><p>{supplier.creditTerms || "Sin crédito definido"}</p><p className="mt-1 text-[11px] text-slate-400">{supplier.currency || "Sin moneda"}</p></td>
                    <td className="px-4 py-3"><StatusBadge active={supplier.isActive} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => openSupplier(supplier)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100" title={supplier.source === "LOCAL" && canManage ? "Editar" : "Ver detalle"}>{supplier.source === "LOCAL" && canManage ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                        {supplier.source === "ERP" && canRefreshErp && <button type="button" onClick={() => void refreshErpSupplier(supplier)} disabled={mutations.syncErpSupplier.isPending} className="rounded-md border border-blue-300 p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50" title="Actualizar desde ERP"><RefreshCw className="h-4 w-4" /></button>}
                        {canManage && <button type="button" onClick={() => setStatusTarget(supplier)} className={`rounded-md border p-1.5 ${supplier.isActive ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`} title={supplier.isActive ? "Desactivar" : "Activar"}>{supplier.isActive ? <CircleOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores.</div>
      </section>

      {newSupplierOpen && <SelectOrCreateSupplierModal
        onClose={() => setNewSupplierOpen(false)}
        onSelect={(supplier) => {
          setNewSupplierOpen(false);
          openSupplier(supplier);
        }}
      />}

      {selectedSupplier && <SupplierDetailModal
        supplier={selectedSupplier}
        form={form}
        setForm={setForm}
        editable={selectedSupplier.source === "LOCAL" && canManage}
        busy={mutations.updateSupplier.isPending || mutations.syncErpSupplier.isPending}
        onClose={closeSupplier}
        onSubmit={saveSupplier}
        onRefresh={() => void refreshErpSupplier(selectedSupplier)}
        canRefresh={selectedSupplier.source === "ERP" && canRefreshErp}
      />}

      {statusTarget && <ConfirmStatusModal
        supplier={statusTarget}
        busy={mutations.setSupplierActive.isPending}
        onClose={() => !mutations.setSupplierActive.isPending && setStatusTarget(null)}
        onConfirm={() => void changeSupplierStatus()}
      />}
    </div>
  );
};

const Metric = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => <div className="bg-white px-5 py-4"><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{icon}{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;

const Filter = ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) => <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-amber-500">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;

const SourceBadge = ({ source }: { source: Supplier["source"] }) => <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${source === "ERP" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{source}</span>;
const StatusBadge = ({ active }: { active: boolean }) => <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{active ? "ACTIVO" : "INACTIVO"}</span>;

const TableMessage = ({ message, loading = false }: { message: string; loading?: boolean }) => <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">{loading && <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />}{message}</td></tr>;

const SupplierDetailModal = ({ supplier, form, setForm, editable, busy, onClose, onSubmit, onRefresh, canRefresh }: {
  supplier: Supplier;
  form: SupplierFormState;
  setForm: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  editable: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  canRefresh: boolean;
}) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="supplier-detail-title">
    <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex gap-3">
          <span className="rounded-xl bg-amber-100 p-2 text-amber-800"><Truck className="h-5 w-5" /></span>
          <div><div className="flex flex-wrap items-center gap-2"><h2 id="supplier-detail-title" className="text-lg font-bold text-slate-950">{editable ? "Editar proveedor" : "Detalle del proveedor"}</h2><SourceBadge source={supplier.source} /><StatusBadge active={supplier.isActive} /></div><p className="mt-1 text-xs text-slate-500">{supplier.erpCode ? `Código ERP ${supplier.erpCode}` : "Proveedor registrado localmente"}</p></div>
        </div>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Nombre *" value={form.name} disabled={!editable} onChange={(name) => setForm((current) => ({ ...current, name }))} wide />
            <label className="text-xs font-semibold text-slate-600">Tipo<select value={form.scope} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value as Supplier["scope"] }))} className={fieldClass}><option value="NATIONAL">Nacional</option><option value="INTERNATIONAL">Internacional</option></select></label>
            <FormField label="RFC" value={form.taxId} disabled={!editable} onChange={(taxId) => setForm((current) => ({ ...current, taxId: taxId.toUpperCase() }))} />
            <FormField label="País *" value={form.country} disabled={!editable} onChange={(country) => setForm((current) => ({ ...current, country }))} />
            <FormField label="Estado" value={form.state} disabled={!editable} onChange={(state) => setForm((current) => ({ ...current, state }))} />
            <FormField label="Condiciones de crédito" value={form.creditTerms} disabled={!editable} onChange={(creditTerms) => setForm((current) => ({ ...current, creditTerms }))} />
            <label className="text-xs font-semibold text-slate-600">Moneda<select value={form.currency} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as SupplierFormState["currency"] }))} className={fieldClass}><option value="">Sin definir</option><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-3">Notas<textarea value={form.notes} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} maxLength={2000} className={fieldClass} /></label>
          </div>
          {editable ? <SupplierContactsEditor contacts={form.contacts} onChange={(contacts) => setForm((current) => ({ ...current, contacts }))} /> : <ReadOnlyContacts supplier={supplier} />}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cerrar</button>
          {canRefresh && <button type="button" onClick={onRefresh} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Actualizar desde ERP</button>}
          {editable && <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</button>}
        </footer>
      </form>
    </div>
  </div>
);

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-500";
const FormField = ({ label, value, onChange, disabled, wide = false }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; wide?: boolean }) => <label className={`text-xs font-semibold text-slate-600 ${wide ? "sm:col-span-2" : ""}`}>{label}<input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={fieldClass} /></label>;

const ReadOnlyContacts = ({ supplier }: { supplier: Supplier }) => {
  const people = groupSupplierContacts(supplierContacts(supplier));
  const hasContactData = people.some((person) => person.name || person.position || person.email || person.landlinePhone || person.whatsAppPhone);
  return <section className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Contactos del proveedor</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{!hasContactData && <p className="text-xs text-slate-500">Sin contactos registrados.</p>}{hasContactData && people.map((person) => <div key={person.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold text-slate-900">{person.name || "Contacto sin nombre"}</p><p className="mt-1 text-[11px] text-slate-500">{[person.position, person.label].filter(Boolean).join(" · ") || "Sin puesto definido"}</p></div>{person.isPrimary && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-900">PRINCIPAL</span>}</div>{person.email && <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-700"><Mail className="h-3.5 w-3.5 text-blue-600" />{person.email}</p>}{person.landlinePhone && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-700"><Phone className="h-3.5 w-3.5 text-slate-600" /><span className="font-semibold">Fijo:</span>{person.landlinePhone}{person.landlineExtension ? ` ext. ${person.landlineExtension}` : ""}</p>}{person.whatsAppPhone && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700"><MessageCircle className="h-3.5 w-3.5" /><span className="font-semibold">WhatsApp:</span>{person.whatsAppPhone}</p>}</div>)}</div></section>;
};

const ConfirmStatusModal = ({ supplier, busy, onClose, onConfirm }: { supplier: Supplier; busy: boolean; onClose: () => void; onConfirm: () => void }) => <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex gap-3"><span className={`rounded-xl p-2 ${supplier.isActive ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{supplier.isActive ? <CircleOff className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</span><div><h2 className="text-lg font-bold text-slate-950">{supplier.isActive ? "Desactivar proveedor" : "Activar proveedor"}</h2><p className="mt-2 text-sm text-slate-600">{supplier.isActive ? "El proveedor dejará de aparecer en selecciones activas, pero conservará su historial." : "El proveedor volverá a estar disponible para nuevas propuestas y requisiciones."}</p><p className="mt-3 text-sm font-bold text-slate-900">{supplier.name}</p></div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button><button type="button" onClick={onConfirm} disabled={busy} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ${supplier.isActive ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{supplier.isActive ? "Desactivar" : "Activar"}</button></div></div></div>;
