import { Building2, Loader2, Mail, MessageCircle, Search, Sparkles, Store, X } from "lucide-react";
import { useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { Client, ClientInput } from "../../../modules/clients/types/client.types";
import type { ErpCustomer } from "../../../modules/clients/types/erp-customer.types";
import { emptyCustomerContact } from "../../../modules/clients/utils/customer-contact-form";
import {
  erpCustomerHasDeliveryChannel,
  erpCustomerToClientInput,
} from "../../../modules/clients/utils/erp-customer-mapper";
import { useErpCustomerSearch } from "../../../queries/customers/use-erp-customer-search";
import { useClientsStore } from "../../../store/clients/clients.store";
import { CustomerContactsEditor } from "../forms/customer-contacts.editor";
import { notifier } from "../../notifications/notifier";
import { isValidEmail, isValidPhoneNumber } from "../../utils/contact-validation";
import { PartyTextCompletionModal } from "./party-text-completion.modal";
import { mergePartyIntoCustomer } from "../../../modules/ai/utils/party-data-form.mapper";

interface ErpCustomerOnboardingModalProps {
  onClose: () => void;
  onImported: (client: Client) => void;
  initialValues?: Partial<ClientInput>;
  initialMode?: "ERP" | "LOCAL";
}

const EMPTY_LOCAL_FORM: ClientInput = {
  name: "",
  lastname: "",
  companyName: "",
  rfc: "",
  email: "",
  phone: "",
  whatsappPhone: "",
  taxRegime: "",
  billingStreet: "",
  billingExteriorNumber: "",
  billingInteriorNumber: "",
  billingNeighborhood: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountry: "MÉXICO",
  notes: "",
  contacts: [emptyCustomerContact(true)],
};

export const ErpCustomerOnboardingModal = ({
  onClose,
  onImported,
  initialValues,
  initialMode = "ERP",
}: ErpCustomerOnboardingModalProps) => {
  const clients = useClientsStore((state) => state.clients);
  const addClient = useClientsStore((state) => state.addClient);
  const [mode, setMode] = useState<"ERP" | "LOCAL">(initialMode);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState<ClientInput>(() => ({
    ...EMPTY_LOCAL_FORM,
    ...initialValues,
    contacts: initialValues?.contacts?.length ? initialValues.contacts : EMPTY_LOCAL_FORM.contacts,
  }));
  const [textCompletionOpen, setTextCompletionOpen] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<ErpCustomer | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [saving, setSaving] = useState(false);
  const debouncedTerm = useDebouncedValue(term, 300);
  const enabled = mode === "ERP" && debouncedTerm.trim().length >= 2;
  const erpSearch = useErpCustomerSearch(debouncedTerm, enabled);

  const importCustomer = async (
    customer: ErpCustomer,
    contact?: { name: string; email: string; whatsapp: string }
  ) => {
    const toast = notifier.loading("Sincronizando cliente ERP...");
    try {
      setSaving(true);
      const saved = await addClient(erpCustomerToClientInput(customer, contact));
      if (toast !== undefined) notifier.update(toast, "success", "Cliente ERP vinculado y seleccionado.");
      else notifier.success("Cliente ERP vinculado y seleccionado.");
      onImported(saved);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "No se pudo sincronizar el cliente ERP.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  const selectCustomer = (customer: ErpCustomer) => {
    const existing = clients.find((client) =>
      client.source === "ERP"
      && client.externalId === customer.externalId
      && (client.email || client.whatsappPhone || client.contacts?.some((contact) => contact.email || contact.mobile))
    );
    if (existing && !erpCustomerHasDeliveryChannel(customer)) {
      notifier.info("Este cliente ya está sincronizado y cuenta con un canal de envío.");
      onImported(existing);
      return;
    }
    if (erpCustomerHasDeliveryChannel(customer)) {
      void importCustomer(customer);
      return;
    }
    setPendingCustomer(customer);
    setContactName(customer.displayName);
    setContactEmail("");
    setContactWhatsApp("");
  };

  const completeContact = () => {
    if (!pendingCustomer) return;
    const name = contactName.trim();
    const email = contactEmail.trim();
    const whatsapp = contactWhatsApp.trim();
    if (!name) return notifier.warning("El nombre del contacto es obligatorio.");
    if (!email && !whatsapp) return notifier.warning("Captura un correo o WhatsApp para anexar el cliente.");
    if (email && !isValidEmail(email)) return notifier.warning("El correo no tiene un formato válido.");
    if (whatsapp && !isValidPhoneNumber(whatsapp)) return notifier.warning("El WhatsApp debe contener entre 10 y 15 dígitos.");
    void importCustomer(pendingCustomer, { name, email, whatsapp });
  };

  const createLocal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return notifier.warning("El nombre es obligatorio.");
    if (!form.lastname.trim()) return notifier.warning("El apellido es obligatorio.");

    const contacts = form.contacts || [];
    if (contacts.length === 0) return notifier.warning("Agrega al menos un contacto.");
    for (let index = 0; index < contacts.length; index += 1) {
      const contact = contacts[index];
      if (!contact.name.trim()) return notifier.warning(`El nombre del contacto ${index + 1} es obligatorio.`);
      if (!contact.email?.trim() && !contact.phone?.trim() && !contact.mobile?.trim()) {
        return notifier.warning(`Captura al menos un medio para el contacto ${index + 1}.`);
      }
      if (contact.email?.trim() && !isValidEmail(contact.email)) {
        return notifier.warning(`El correo del contacto ${index + 1} no es válido.`);
      }
      if (contact.phone?.trim() && !isValidPhoneNumber(contact.phone)) {
        return notifier.warning(`El teléfono fijo del contacto ${index + 1} no es válido.`);
      }
      if (contact.mobile?.trim() && !isValidPhoneNumber(contact.mobile)) {
        return notifier.warning(`El WhatsApp del contacto ${index + 1} no es válido.`);
      }
    }
    if (!contacts.some((contact) => contact.email?.trim() || contact.mobile?.trim())) {
      return notifier.warning("El cliente debe tener al menos un correo o WhatsApp.");
    }

    const deliveryContact = contacts.find((contact) => contact.isPrimary && (contact.email?.trim() || contact.mobile?.trim()))
      || contacts.find((contact) => contact.email?.trim() || contact.mobile?.trim())!;
    const input: ClientInput = {
      ...form,
      email: deliveryContact.email?.trim() || "",
      phone: deliveryContact.phone?.trim() || "",
      whatsappPhone: deliveryContact.mobile?.trim() || "",
      contacts,
    };
    const toast = notifier.loading("Creando cliente local...");
    try {
      setSaving(true);
      const created = await addClient(input);
      if (toast !== undefined) notifier.update(toast, "success", "Cliente local creado y seleccionado.");
      else notifier.success("Cliente local creado y seleccionado.");
      onImported(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el cliente.";
      if (toast !== undefined) notifier.update(toast, "error", message);
      else notifier.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (<>
    <div className="fixed inset-0 z-[175] flex items-center justify-center bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-labelledby="customer-selector-title">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Cliente de cotización</p>
            <h2 id="customer-selector-title" className="mt-1 text-lg font-bold text-slate-950">Seleccionar o crear cliente</h2>
            <p className="mt-1 text-xs text-slate-500">Busca el cliente oficial en ERP o registra uno local.</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-slate-200 px-5 pt-4">
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
            <button type="button" disabled={saving} onClick={() => { setMode("ERP"); setPendingCustomer(null); }} className={`rounded-md px-4 py-2 text-xs font-semibold ${mode === "ERP" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white"}`}>Buscar en ERP</button>
            <button type="button" disabled={saving} onClick={() => { setMode("LOCAL"); setPendingCustomer(null); }} className={`rounded-md px-4 py-2 text-xs font-semibold ${mode === "LOCAL" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white"}`}>Crear local</button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {mode === "ERP" ? (
            pendingCustomer ? (
              <div>
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3"><span className="rounded-lg bg-white p-2 text-amber-700"><Building2 className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">{pendingCustomer.companyName || pendingCustomer.displayName}</p><p className="mt-1 text-xs text-slate-600">ERP no proporcionó correo ni WhatsApp. Completa uno para enviar cotizaciones.</p></div></div>
                </section>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre del contacto *" value={contactName} onChange={setContactName} wide />
                  <Field label="Correo" type="email" value={contactEmail} onChange={setContactEmail} icon={<Mail className="h-3.5 w-3.5" />} />
                  <Field label="WhatsApp" type="tel" value={contactWhatsApp} onChange={setContactWhatsApp} icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600" />} accent />
                </div>
                <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setPendingCustomer(null)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Regresar</button><button type="button" onClick={completeContact} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Vincular y seleccionar</button></div>
              </div>
            ) : (
              <div>
                <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={term} onChange={(event) => setTerm(event.target.value)} disabled={saving} autoFocus placeholder="Código, razón social, RFC o contacto..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></div>
                <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200">
                  {(erpSearch.isLoading || erpSearch.isFetching) && <StateMessage message="Consultando ERP..." loading />}
                  {!erpSearch.isLoading && !erpSearch.isFetching && erpSearch.error && <StateMessage message={erpSearch.error instanceof Error ? erpSearch.error.message : "No se pudo consultar el ERP."} error />}
                  {!erpSearch.isLoading && !erpSearch.isFetching && !erpSearch.error && !enabled && <StateMessage message="Escribe al menos 2 caracteres para buscar clientes del ERP." />}
                  {!erpSearch.isLoading && !erpSearch.isFetching && !erpSearch.error && enabled && !(erpSearch.data || []).length && <StateMessage message="No se encontraron clientes." />}
                  {!erpSearch.isLoading && !erpSearch.isFetching && (erpSearch.data || []).map((customer) => (
                    <div key={`${customer.externalId}-${customer.code}`} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{customer.code || "ERP"}</span><p className="text-sm font-bold text-slate-900">{customer.companyName || customer.displayName}</p></div>
                        <p className="mt-1 text-xs text-slate-500">RFC: {customer.taxId || "-"} · {customer.billingState || "Sin estado"}</p>
                        <p className="mt-1 text-xs text-slate-500">{customer.displayName} · {customer.email || customer.whatsapp || customer.phone || "Sin datos de contacto"}</p>
                      </div>
                      <button type="button" disabled={saving} onClick={() => selectCustomer(customer)} className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{erpCustomerHasDeliveryChannel(customer) ? "Vincular y seleccionar" : "Completar contacto"}</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <form onSubmit={createLocal}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div><p className="text-xs font-bold text-slate-900">¿Tienes los datos en un mensaje?</p><p className="mt-0.5 text-[11px] text-slate-600">Pega una firma, correo o WhatsApp y completa el formulario con IA.</p></div>
                <button type="button" onClick={() => setTextCompletionOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Sparkles className="h-4 w-4" />Completar con texto</button>
              </div>
              <SectionTitle title="Datos generales" description="Identificación comercial y fiscal." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre *" value={form.name} onChange={(name) => setForm((state) => ({ ...state, name }))} />
                <Field label="Apellido *" value={form.lastname} onChange={(lastname) => setForm((state) => ({ ...state, lastname }))} />
                <Field label="Empresa / razón social" value={form.companyName} onChange={(companyName) => setForm((state) => ({ ...state, companyName }))} wide />
                <Field label="RFC" value={form.rfc} onChange={(rfc) => setForm((state) => ({ ...state, rfc: rfc.toUpperCase() }))} />
                <Field label="Régimen fiscal" value={form.taxRegime || ""} onChange={(taxRegime) => setForm((state) => ({ ...state, taxRegime }))} />
              </div>

              <SectionTitle title="Dirección fiscal" description="Datos segmentados del domicilio." spaced />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Calle" value={form.billingStreet || ""} onChange={(billingStreet) => setForm((state) => ({ ...state, billingStreet }))} wide />
                <Field label="Número exterior" value={form.billingExteriorNumber || ""} onChange={(billingExteriorNumber) => setForm((state) => ({ ...state, billingExteriorNumber }))} />
                <Field label="Número interior" value={form.billingInteriorNumber || ""} onChange={(billingInteriorNumber) => setForm((state) => ({ ...state, billingInteriorNumber }))} />
                <Field label="Colonia" value={form.billingNeighborhood || ""} onChange={(billingNeighborhood) => setForm((state) => ({ ...state, billingNeighborhood }))} />
                <Field label="Ciudad / municipio" value={form.billingCity || ""} onChange={(billingCity) => setForm((state) => ({ ...state, billingCity }))} />
                <Field label="Estado" value={form.billingState || ""} onChange={(billingState) => setForm((state) => ({ ...state, billingState }))} />
                <Field label="Código postal" value={form.billingPostalCode || ""} onChange={(billingPostalCode) => setForm((state) => ({ ...state, billingPostalCode }))} />
                <Field label="País" value={form.billingCountry || ""} onChange={(billingCountry) => setForm((state) => ({ ...state, billingCountry }))} />
              </div>

              <div className="mt-5"><CustomerContactsEditor contacts={form.contacts || []} onChange={(contacts) => setForm((state) => ({ ...state, contacts }))} /></div>
              <label className="mt-5 block text-xs font-semibold text-slate-600">Notas<textarea value={form.notes || ""} onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))} rows={3} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>
              <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}Crear y seleccionar</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
    {textCompletionOpen && <PartyTextCompletionModal
      partyType="CUSTOMER"
      onClose={() => setTextCompletionOpen(false)}
      onApply={(party) => {
        setForm((current) => mergePartyIntoCustomer(current, party));
        setTextCompletionOpen(false);
        notifier.success("Datos del cliente aplicados. Revísalos antes de guardar.");
      }}
    />}
  </>);
};

const Field = ({ label, value, type = "text", onChange, wide = false, accent = false, icon }: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
  wide?: boolean;
  accent?: boolean;
  icon?: React.ReactNode;
}) => (
  <label className={`text-xs font-semibold ${accent ? "text-emerald-700" : "text-slate-600"} ${wide ? "sm:col-span-2" : ""}`}><span className="inline-flex items-center gap-1.5">{icon}{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-slate-900 outline-none ${accent ? "border-emerald-300 focus:ring-2 focus:ring-emerald-100" : "border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"}`} /></label>
);

const SectionTitle = ({ title, description, spaced = false }: { title: string; description: string; spaced?: boolean }) => (
  <div className={spaced ? "mb-3 mt-6 border-t border-slate-200 pt-5" : "mb-3"}><p className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</p><p className="mt-1 text-[11px] text-slate-500">{description}</p></div>
);

const StateMessage = ({ message, loading = false, error = false }: { message: string; loading?: boolean; error?: boolean }) => (
  <div className={`flex items-center justify-center gap-2 p-8 text-sm ${error ? "text-rose-600" : "text-slate-500"}`}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{message}</div>
);
