import { Mail, MessageCircle, Phone, Plus, Trash2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { CustomerContactInput } from "../../../modules/clients/types/customer-contact.types";
import { emptyCustomerContact } from "../../../modules/clients/utils/customer-contact-form";

interface CustomerContactsEditorProps {
  contacts: CustomerContactInput[];
  onChange: (contacts: CustomerContactInput[]) => void;
  disabled?: boolean;
}

export const CustomerContactsEditor = ({
  contacts,
  onChange,
  disabled = false,
}: CustomerContactsEditorProps) => {
  const people = contacts.length > 0 ? contacts : [emptyCustomerContact(true)];

  const commit = (next: CustomerContactInput[]) => {
    const normalized = next.length > 0 ? next : [emptyCustomerContact(true)];
    if (!normalized.some((contact) => contact.isPrimary)) normalized[0] = { ...normalized[0], isPrimary: true };
    onChange(normalized);
  };

  const update = (index: number, patch: Partial<CustomerContactInput>) => {
    commit(people.map((contact, currentIndex) => currentIndex === index ? { ...contact, ...patch } : contact));
  };

  const setPrimary = (index: number) => {
    commit(people.map((contact, currentIndex) => ({ ...contact, isPrimary: currentIndex === index })));
  };

  const remove = (index: number) => {
    commit(people.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Contactos del cliente</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Debe existir al menos un correo o WhatsApp válido para enviar la cotización.
          </p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => commit([...people, emptyCustomerContact(false)])} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">
            <Plus className="h-3.5 w-3.5" />
            Agregar otro contacto
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {people.map((contact, index) => (
          <article key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><UserRound className="h-4 w-4" /></span>
                <div>
                  <p className="text-xs font-bold text-slate-900">Contacto {index + 1}</p>
                  <p className="text-[10px] text-slate-500">{contact.isPrimary ? "Contacto principal" : "Contacto adicional"}</p>
                </div>
              </div>
              {!disabled && people.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50" title="Quitar contacto">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-12">
              <ContactField label="Nombre *" value={contact.name} disabled={disabled} onChange={(value) => update(index, { name: value })} className="lg:col-span-4" />
              <ContactField label="Puesto" value={contact.jobTitle || ""} disabled={disabled} onChange={(value) => update(index, { jobTitle: value })} className="lg:col-span-4" placeholder="Compras, dirección..." />
              <ContactField label="Área o etiqueta" value={contact.label || ""} disabled={disabled} onChange={(value) => update(index, { label: value })} className="lg:col-span-4" placeholder="Cotizaciones, pagos..." />
              <ContactField icon={<Mail className="h-3.5 w-3.5" />} label="Correo" type="email" value={contact.email || ""} disabled={disabled} onChange={(value) => update(index, { email: value })} className="lg:col-span-4" placeholder="correo@cliente.com" />
              <ContactField icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono fijo" type="tel" value={contact.phone || ""} disabled={disabled} onChange={(value) => update(index, { phone: value })} className="lg:col-span-3" placeholder="+52 55 1234 5678" />
              <ContactField label="Extensión" value={contact.phoneExtension || ""} disabled={disabled} onChange={(value) => update(index, { phoneExtension: value.replace(/\D/g, "").slice(0, 10) })} className="lg:col-span-2" />
              <ContactField icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600" />} label="WhatsApp" type="tel" value={contact.mobile || ""} disabled={disabled} onChange={(value) => update(index, { mobile: value })} className="lg:col-span-3" placeholder="+52 81 9876 5432" accent />
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                <input type="radio" name="customer-primary-contact" checked={Boolean(contact.isPrimary)} disabled={disabled} onChange={() => setPrimary(index)} />
                Contacto principal
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

interface ContactFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  accent?: boolean;
  icon?: ReactNode;
}

const ContactField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
  disabled,
  accent,
  icon,
}: ContactFieldProps) => (
  <label className={`text-[11px] font-semibold ${accent ? "text-emerald-700" : "text-slate-600"} ${className}`}>
    <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} className={`mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-xs font-normal text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-500 ${accent ? "border-emerald-300 focus:ring-2 focus:ring-emerald-100" : "border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"}`} />
  </label>
);
