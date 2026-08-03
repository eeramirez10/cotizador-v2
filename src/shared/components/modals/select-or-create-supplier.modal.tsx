import { Loader2, MessageCircle, Plus, Search, Store, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { ErpSupplier, SaveSupplierContactInput, SaveSupplierInput, Supplier } from "../../../modules/procurement/services/purchase-requisitions.service";
import { useErpSupplierSearch, usePurchaseRequisitionMutations, useSuppliers } from "../../../queries/procurement/use-purchase-requisitions";
import { notifier } from "../../notifications/notifier";

type SupplierForm = Omit<SaveSupplierInput, "scope" | "contacts"> & {
  scope: "" | SaveSupplierInput["scope"];
  contacts: SaveSupplierContactInput[];
};

const EMPTY_SUPPLIER: SupplierForm = {
  name: "",
  scope: "",
  taxId: "",
  state: "",
  country: "MÉXICO",
  contactName: "",
  contactPosition: "",
  creditTerms: "",
  currency: null,
  notes: "",
  email: "",
  phone: "",
  contacts: [],
  allowPotentialDuplicate: false,
};

export const SelectOrCreateSupplierModal = ({ onClose, onSelect, initialValues, initialMode = "ERP" }: {
  onClose: () => void;
  onSelect: (supplier: Supplier) => void;
  initialValues?: Partial<SaveSupplierInput>;
  initialMode?: "ERP" | "LOCAL";
}) => {
  const [mode, setMode] = useState<"ERP" | "LOCAL">(initialMode);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState<SupplierForm>(() => ({
    ...EMPTY_SUPPLIER,
    ...initialValues,
    scope: initialValues?.scope || "",
    contacts: initialContacts(initialValues),
  }));
  const debouncedTerm = useDebouncedValue(term, 400);
  const erpSearch = useErpSupplierSearch(debouncedTerm, mode === "ERP");
  const mutations = usePurchaseRequisitionMutations();
  const localSuppliers = useSuppliers(mode === "LOCAL", { includeInactive: true });
  const busy = mutations.createSupplier.isPending || mutations.syncErpSupplier.isPending;
  const potentialDuplicates = useMemo(() => {
    const canonical = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const name = canonical(form.name);
    const emails = form.contacts.filter((contact) => contact.channel === "EMAIL").map((contact) => contact.value.trim().toLowerCase()).filter(Boolean);
    const phones = form.contacts.filter((contact) => contact.channel === "PHONE").map((contact) => contact.value.replace(/\D/g, "")).filter(Boolean);
    if (!name && emails.length === 0 && phones.length === 0) return [];
    return (localSuppliers.data || []).filter((supplier) =>
      (name && canonical(supplier.name) === name)
      || emails.some((email) => [supplier.email, ...(supplier.contacts || []).filter((contact) => contact.channel === "EMAIL").map((contact) => contact.value)].some((value) => value?.trim().toLowerCase() === email))
      || phones.some((phone) => [supplier.phone, supplier.mobile, ...(supplier.contacts || []).filter((contact) => contact.channel === "PHONE").map((contact) => contact.value)].some((value) => value?.replace(/\D/g, "") === phone)),
    ).slice(0, 5);
  }, [form.contacts, form.name, localSuppliers.data]);

  const selectErp = async (supplier: ErpSupplier) => {
    if (busy) return;
    const toast = notifier.loading(`Vinculando ${supplier.code}...`);
    try {
      const synced = await mutations.syncErpSupplier.mutateAsync(supplier.code);
      if (toast !== undefined) notifier.update(toast, "success", "Proveedor ERP vinculado y seleccionado.");
      else notifier.success("Proveedor ERP vinculado y seleccionado.");
      onSelect(synced);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo vincular el proveedor ERP.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    }
  };

  const createLocal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return notifier.warning("El nombre del proveedor es obligatorio.");
    if (!form.scope) return notifier.warning("Selecciona si el proveedor es nacional o internacional.");
    if (potentialDuplicates.length > 0 && !form.allowPotentialDuplicate) {
      notifier.warning("Revisa los proveedores coincidentes o confirma que realmente necesitas crear otro.");
      return;
    }
    const toast = notifier.loading("Creando proveedor local...");
    try {
      const contacts = form.contacts.filter((contact) => contact.value.trim());
      const primaryEmail = contacts.find((contact) => contact.channel === "EMAIL" && contact.isPrimary)?.value
        || contacts.find((contact) => contact.channel === "EMAIL")?.value || null;
      const primaryPhone = contacts.find((contact) => contact.channel === "PHONE" && contact.isPrimary)?.value
        || contacts.find((contact) => contact.channel === "PHONE")?.value || null;
      const primaryContact = contacts.find((contact) => contact.isPrimary && contact.contactName)
        || contacts.find((contact) => contact.contactName);
      const created = await mutations.createSupplier.mutateAsync({
        ...form,
        scope: form.scope,
        contacts,
        contactName: primaryContact?.contactName || null,
        contactPosition: primaryContact?.contactPosition || null,
        email: primaryEmail,
        phone: primaryPhone,
      });
      if (toast !== undefined) notifier.update(toast, "success", "Proveedor local creado y seleccionado.");
      else notifier.success("Proveedor local creado y seleccionado.");
      onSelect(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el proveedor.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-labelledby="supplier-selector-title">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Proveedor cotizado</p>
            <h2 id="supplier-selector-title" className="mt-1 text-lg font-bold text-slate-950">Seleccionar o crear proveedor</h2>
            <p className="mt-1 text-xs text-slate-500">Busca el proveedor oficial en ERP o registra uno local.</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-slate-200 px-5 pt-4">
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
            <button type="button" disabled={busy} onClick={() => setMode("ERP")} className={`rounded-md px-4 py-2 text-xs font-semibold ${mode === "ERP" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white"}`}>Buscar en ERP</button>
            <button type="button" disabled={busy} onClick={() => setMode("LOCAL")} className={`rounded-md px-4 py-2 text-xs font-semibold ${mode === "LOCAL" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white"}`}>Crear local</button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {mode === "ERP" ? (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={term} onChange={(event) => setTerm(event.target.value)} disabled={busy} autoFocus placeholder="Código, razón social, RFC o contacto..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200">
                {(erpSearch.isLoading || erpSearch.isFetching) && <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Consultando ERP...</div>}
                {!erpSearch.isLoading && !erpSearch.isFetching && erpSearch.error && <p className="p-6 text-center text-sm text-rose-600">{erpSearch.error instanceof Error ? erpSearch.error.message : "No se pudo consultar el ERP."}</p>}
                {!erpSearch.isLoading && !erpSearch.isFetching && !erpSearch.error && !term.trim() && <p className="p-8 text-center text-sm text-slate-500">Escribe para buscar proveedores del ERP.</p>}
                {!erpSearch.isLoading && !erpSearch.isFetching && !erpSearch.error && term.trim() && !(erpSearch.data || []).length && <p className="p-8 text-center text-sm text-slate-500">No se encontraron proveedores.</p>}
                {!erpSearch.isLoading && !erpSearch.isFetching && (erpSearch.data || []).map((supplier) => {
                  const contact = supplier.contacts[0];
                  return (
                    <div key={supplier.code} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{supplier.code}</span><p className="text-sm font-bold text-slate-900">{supplier.name}</p></div>
                        <p className="mt-1 text-xs text-slate-500">RFC: {supplier.taxId || "-"} · {supplier.state || "Sin estado"} · {supplier.currency}</p>
                        {contact && <p className="mt-1 text-xs text-slate-500">{contact.name || "Sin contacto"}{contact.position ? ` · ${contact.position}` : ""} · {contact.email || contact.mobile || contact.phone || "Sin datos"}</p>}
                      </div>
                      <button type="button" disabled={busy} onClick={() => void selectErp(supplier)} className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">Vincular y seleccionar</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={createLocal}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre *" value={form.name} onChange={(name) => setForm((state) => ({ ...state, name }))} />
                <Field label="RFC" value={form.taxId || ""} onChange={(taxId) => setForm((state) => ({ ...state, taxId }))} />
                <label className="text-xs font-semibold text-slate-600">Tipo *<select value={form.scope} onChange={(event) => setForm((state) => ({ ...state, scope: event.target.value as SupplierForm["scope"] }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"><option value="" disabled>Seleccionar tipo...</option><option value="NATIONAL">Nacional</option><option value="INTERNATIONAL">Internacional</option></select></label>
                <Field label="Estado" value={form.state || ""} onChange={(state) => setForm((current) => ({ ...current, state }))} />
                <Field label="País" value={form.country || ""} onChange={(country) => setForm((state) => ({ ...state, country }))} />
                <Field label="Condiciones de crédito" value={form.creditTerms || ""} onChange={(creditTerms) => setForm((state) => ({ ...state, creditTerms }))} />
                <label className="text-xs font-semibold text-slate-600">Moneda
                  <select value={form.currency || ""} onChange={(event) => setForm((state) => ({ ...state, currency: event.target.value ? event.target.value as "MXN" | "USD" : null }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                    <option value="">Sin definir</option>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Notas
                  <textarea value={form.notes || ""} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} rows={3} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                </label>
              </div>
              <SupplierContactsEditor contacts={form.contacts} onChange={(contacts) => setForm((state) => ({ ...state, contacts }))} />
              {potentialDuplicates.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Posibles proveedores duplicados</p>
                  <div className="mt-2 space-y-2">
                    {potentialDuplicates.map((supplier) => (
                      <div key={supplier.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                        <div><p className="text-sm font-semibold text-slate-900">{supplier.name}</p><p className="text-[11px] text-slate-500">{supplier.email || supplier.phone || supplier.taxId || "Sin contacto"}</p></div>
                        <button type="button" onClick={() => onSelect(supplier)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Usar existente</button>
                      </div>
                    ))}
                  </div>
                  <label className="mt-3 flex items-start gap-2 text-xs font-medium text-amber-900">
                    <input type="checkbox" checked={Boolean(form.allowPotentialDuplicate)} onChange={(event) => setForm((state) => ({ ...state, allowPotentialDuplicate: event.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-amber-400" />
                    Confirmo que es un proveedor diferente y deseo crearlo de todos modos.
                  </label>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}Crear y seleccionar</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, type = "text", onChange }: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) => (
  <label className="text-xs font-semibold text-slate-600">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>
);

const initialContacts = (initialValues?: Partial<SaveSupplierInput>): SaveSupplierContactInput[] => {
  if (initialValues?.contacts?.length) {
    const fallbackKeys = new Map<string, string>();
    return initialValues.contacts.map((contact, index) => {
      const personSignature = `${contact.contactName || "contact"}:${contact.contactPosition || ""}`.toLowerCase();
      const contactKey = contact.contactKey || fallbackKeys.get(personSignature) || `legacy-${index + 1}`;
      fallbackKeys.set(personSignature, contactKey);
      return { ...contact, contactKey };
    });
  }
  return personToContacts({
    key: nextContactKey(),
    name: initialValues?.contactName || "",
    position: initialValues?.contactPosition || "",
    email: initialValues?.email || "",
    phone: initialValues?.phone || "",
    phoneKind: "UNKNOWN",
    extension: "",
    isWhatsApp: false,
    label: "",
    isPrimary: true,
  });
};

interface SupplierContactPersonForm {
  key: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  phoneKind: "LANDLINE" | "MOBILE" | "UNKNOWN";
  extension: string;
  isWhatsApp: boolean;
  label: string;
  isPrimary: boolean;
}

let contactSequence = 0;
const nextContactKey = () => `contact-${Date.now().toString(36)}-${(++contactSequence).toString(36)}`;

const emptyContactPerson = (isPrimary: boolean): SupplierContactPersonForm => ({
  key: nextContactKey(),
  name: "",
  position: "",
  email: "",
  phone: "",
  phoneKind: "UNKNOWN",
  extension: "",
  isWhatsApp: false,
  label: "",
  isPrimary,
});

const personToContacts = (person: SupplierContactPersonForm): SaveSupplierContactInput[] => [
  {
    contactKey: person.key,
    channel: "EMAIL",
    value: person.email,
    phoneKind: null,
    extension: null,
    isWhatsApp: false,
    contactName: person.name || null,
    contactPosition: person.position || null,
    label: person.label || null,
    isPrimary: person.isPrimary,
  },
  {
    contactKey: person.key,
    channel: "PHONE",
    value: person.phone,
    phoneKind: person.phoneKind,
    extension: person.extension || null,
    isWhatsApp: person.isWhatsApp,
    contactName: person.name || null,
    contactPosition: person.position || null,
    label: person.label || null,
    isPrimary: person.isPrimary,
  },
];

export const groupSupplierContacts = (contacts: SaveSupplierContactInput[]): SupplierContactPersonForm[] => {
  const people: SupplierContactPersonForm[] = [];
  contacts.forEach((contact, index) => {
    const baseKey = contact.contactKey || `legacy-${index + 1}`;
    let person = people.find((candidate) => candidate.key === baseKey);
    if (person && ((contact.channel === "EMAIL" && person.email) || (contact.channel === "PHONE" && person.phone))) {
      person = undefined;
    }
    if (!person) {
      person = {
        ...emptyContactPerson(false),
        key: people.some((candidate) => candidate.key === baseKey) ? `${baseKey}-${index + 1}` : baseKey,
        name: contact.contactName || "",
        position: contact.contactPosition || "",
        label: contact.label || "",
        isPrimary: Boolean(contact.isPrimary),
      };
      people.push(person);
    }
    person.name ||= contact.contactName || "";
    person.position ||= contact.contactPosition || "";
    person.label ||= contact.label || "";
    person.isPrimary ||= Boolean(contact.isPrimary);
    if (contact.channel === "EMAIL") person.email = contact.value;
    if (contact.channel === "PHONE") {
      person.phone = contact.value;
      person.phoneKind = contact.phoneKind || "UNKNOWN";
      person.extension = contact.extension || "";
      person.isWhatsApp = contact.isWhatsApp;
    }
  });
  return people.length > 0 ? people : [emptyContactPerson(true)];
};

export const SupplierContactsEditor = ({ contacts, onChange }: {
  contacts: SaveSupplierContactInput[];
  onChange: (contacts: SaveSupplierContactInput[]) => void;
}) => {
  const people = groupSupplierContacts(contacts);
  const commit = (nextPeople: SupplierContactPersonForm[]) => onChange(nextPeople.flatMap(personToContacts));
  const update = (index: number, data: Partial<SupplierContactPersonForm>) => commit(people.map((person, current) => current === index ? { ...person, ...data } : person));
  const setPrimary = (index: number) => commit(people.map((person, current) => ({ ...person, isPrimary: current === index })));
  const remove = (index: number) => {
    const nextPeople = people.filter((_, current) => current !== index);
    if (nextPeople.length === 0) return commit([emptyContactPerson(true)]);
    if (!nextPeople.some((person) => person.isPrimary)) nextPeople[0] = { ...nextPeople[0]!, isPrimary: true };
    commit(nextPeople);
  };
  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Contactos del proveedor</p><p className="mt-1 text-[11px] text-slate-500">Registra a cada persona con su correo y teléfono. El primer contacto aparece por defecto.</p></div>
        <button type="button" onClick={() => commit([...people, emptyContactPerson(false)])} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"><Plus className="h-3.5 w-3.5" />Agregar otro contacto</button>
      </div>
      <div className="mt-3 space-y-3">
        {people.map((person, index) => (
          <div key={person.key} className={`rounded-xl border p-4 ${person.isPrimary ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-slate-50"}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><p className="text-xs font-bold text-slate-800">Contacto {index + 1}</p>{person.isPrimary && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-900">PRINCIPAL</span>}</div>
              <button type="button" onClick={() => remove(index)} disabled={people.length === 1} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Eliminar contacto ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-4">Nombre<input value={person.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Nombre de la persona" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" /></label>
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-4">Puesto<input value={person.position} onChange={(event) => update(index, { position: event.target.value })} placeholder="Compras, ventas, dirección..." className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" /></label>
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-4">Área o etiqueta<input value={person.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Oficina, cotizaciones..." className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" /></label>
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-5">Correo<input type="email" value={person.email} onChange={(event) => update(index, { email: event.target.value })} placeholder="correo@proveedor.com" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" /></label>
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-3">Teléfono<input type="tel" value={person.phone} onChange={(event) => update(index, { phone: event.target.value })} placeholder="+52 55 1234 5678" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" /></label>
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-2">Tipo<select value={person.phoneKind} onChange={(event) => update(index, { phoneKind: event.target.value as SupplierContactPersonForm["phoneKind"] })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-normal"><option value="UNKNOWN">Sin definir</option><option value="LANDLINE">Fijo / local</option><option value="MOBILE">Celular</option></select></label>
              <label className="text-[11px] font-semibold text-slate-600 lg:col-span-2">Extensión<input inputMode="numeric" value={person.extension} onChange={(event) => update(index, { extension: event.target.value.replace(/\D/g, "").slice(0, 10) })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" /></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-5 border-t border-slate-200 pt-3">
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700"><input type="radio" name="supplier-primary-contact" checked={person.isPrimary} onChange={() => setPrimary(index)} />Contacto principal</label>
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-700"><input type="checkbox" checked={person.isWhatsApp} disabled={!person.phone.trim()} onChange={(event) => update(index, { isWhatsApp: event.target.checked })} /><MessageCircle className="h-3.5 w-3.5" />Este teléfono tiene WhatsApp</label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
