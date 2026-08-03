import { Building2, Loader2, Mail, MessageCircle, Search, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { Client } from "../../../modules/clients/types/client.types";
import type { ErpCustomer } from "../../../modules/clients/types/erp-customer.types";
import {
  erpCustomerHasDeliveryChannel,
  erpCustomerToClientInput,
} from "../../../modules/clients/utils/erp-customer-mapper";
import { useErpCustomerSearch } from "../../../queries/customers/use-erp-customer-search";
import { useClientsStore } from "../../../store/clients/clients.store";
import { notifier } from "../../notifications/notifier";
import { isValidEmail, isValidPhoneNumber } from "../../utils/contact-validation";

interface ErpCustomerOnboardingModalProps {
  onClose: () => void;
  onCreateLocal: () => void;
  onImported: (client: Client) => void;
}

export const ErpCustomerOnboardingModal = ({
  onClose,
  onCreateLocal,
  onImported,
}: ErpCustomerOnboardingModalProps) => {
  const clients = useClientsStore((state) => state.clients);
  const addClient = useClientsStore((state) => state.addClient);
  const [term, setTerm] = useState("");
  const [pendingCustomer, setPendingCustomer] = useState<ErpCustomer | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [saving, setSaving] = useState(false);
  const debouncedTerm = useDebouncedValue(term, 300);
  const enabled = debouncedTerm.trim().length >= 2;
  const { data: results = [], isLoading, error } = useErpCustomerSearch(debouncedTerm, enabled);

  const importCustomer = async (
    customer: ErpCustomer,
    contact?: { name: string; email: string; whatsapp: string }
  ) => {
    const toast = notifier.loading("Sincronizando cliente ERP...");
    try {
      setSaving(true);
      const saved = await addClient(erpCustomerToClientInput(customer, contact));
      if (toast !== undefined) notifier.update(toast, "success", "Cliente ERP sincronizado.");
      else notifier.success("Cliente ERP sincronizado.");
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

  return (
    <div className="fixed inset-0 z-[175] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Alta de cliente</p>
            <h2 className="mt-1 text-xl font-bold">Buscar primero en ERP</h2>
            <p className="mt-1 text-xs text-slate-300">Evita duplicados consultando por código, empresa o nombre antes de crear un registro local.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </header>

        {!pendingCustomer ? (
          <>
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <label className="relative block">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar por código, razón social o nombre..." className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </label>
            </div>

            <div className="min-h-72 flex-1 overflow-auto">
              <table className="min-w-[820px] w-full divide-y divide-slate-200">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr>{["Cliente ERP", "Código", "RFC", "Correo", "WhatsApp", "Acción"].map((label) => <th key={label} className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 ${label === "Acción" ? "text-right" : ""}`}>{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {!enabled && <Message message="Escribe al menos 2 caracteres para buscar en ERP." />}
                  {enabled && isLoading && <Message message="Consultando ERP..." loading />}
                  {enabled && !isLoading && error && <Message message="No se pudo consultar ERP. Verifica que el servicio esté activo." error />}
                  {enabled && !isLoading && !error && results.length === 0 && <Message message="No se encontraron clientes en ERP. Puedes continuar con el alta local." />}
                  {results.map((customer) => (
                    <tr key={`${customer.externalId}-${customer.code}`} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3"><p className="max-w-72 truncate text-sm font-bold text-slate-900">{customer.companyName || customer.displayName}</p><p className="mt-1 text-[11px] text-slate-500">{customer.displayName}</p></td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{customer.code || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{customer.taxId || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{customer.email || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{customer.whatsapp || "-"}</td>
                      <td className="px-4 py-3 text-right"><button type="button" onClick={() => selectCustomer(customer)} disabled={saving} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{erpCustomerHasDeliveryChannel(customer) ? "Agregar desde ERP" : "Completar contacto"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs text-slate-500">¿Confirmaste que no existe en ERP?</p>
              <div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" onClick={onCreateLocal} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"><UserPlus className="h-4 w-4" />Crear cliente local</button></div>
            </footer>
          </>
        ) : (
          <div className="overflow-y-auto p-5">
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3"><span className="rounded-lg bg-white p-2 text-amber-700"><Building2 className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">{pendingCustomer.companyName || pendingCustomer.displayName}</p><p className="mt-1 text-xs text-slate-600">ERP no proporcionó correo ni WhatsApp. Completa uno para poder enviar cotizaciones.</p></div></div>
            </section>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Nombre del contacto *<input value={contactName} onChange={(event) => setContactName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>
              <label className="text-xs font-semibold text-slate-700"><span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />Correo</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="correo@cliente.com" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>
              <label className="text-xs font-semibold text-emerald-700"><span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />WhatsApp</span><input type="tel" value={contactWhatsApp} onChange={(event) => setContactWhatsApp(event.target.value)} placeholder="+52 81 1234 5678" className="mt-1 w-full rounded-lg border border-emerald-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-100" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setPendingCustomer(null)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Regresar</button><button type="button" onClick={completeContact} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cliente ERP</button></div>
          </div>
        )}
      </div>
    </div>
  );
};

const Message = ({ message, loading = false, error = false }: { message: string; loading?: boolean; error?: boolean }) => (
  <tr><td colSpan={6} className={`px-4 py-12 text-center text-sm ${error ? "text-rose-600" : "text-slate-500"}`}><span className="inline-flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{message}</span></td></tr>
);
