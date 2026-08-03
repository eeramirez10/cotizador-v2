import { Building2, CheckCircle2, Loader2, Search, Store, X } from "lucide-react";
import { useMemo } from "react";
import type { ExtractedPartyData } from "../../../modules/ai/types/party-data.types";
import type { Client } from "../../../modules/clients/types/client.types";
import type { ErpCustomer } from "../../../modules/clients/types/erp-customer.types";
import { useErpCustomerSearch } from "../../../queries/customers/use-erp-customer-search";

interface Props {
  detected: ExtractedPartyData;
  clients: Client[];
  onUseLocal: (client: Client) => void;
  onUseErp: (customer: ErpCustomer) => void;
  onCreate: () => void;
  onChooseOther: () => void;
  onDismiss: () => void;
}

const canonical = (value?: string | null): string => (value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]/gi, "")
  .toUpperCase();

const contactValues = (detected: ExtractedPartyData) => detected.contacts.flatMap((contact) => [
  contact.email?.trim().toLowerCase() || "",
  contact.whatsappPhone?.replace(/\D/g, "") || "",
]).filter(Boolean);

const findDetectedCustomerMatch = (detected: ExtractedPartyData, clients: Client[]): Client | null => {
  const taxId = canonical(detected.taxId);
  const businessName = canonical(detected.businessName);
  const contacts = new Set(contactValues(detected));
  return clients.find((client) => {
    if (taxId && canonical(client.rfc) === taxId) return true;
    if (businessName && canonical(client.companyName) === businessName) return true;
    const values = [client.email?.toLowerCase(), client.whatsappPhone?.replace(/\D/g, ""), ...(client.contacts || []).flatMap((contact) => [contact.email?.toLowerCase(), contact.mobile?.replace(/\D/g, "")])].filter(Boolean) as string[];
    return values.some((value) => contacts.has(value));
  }) || null;
};

const findErpMatch = (detected: ExtractedPartyData, customers: ErpCustomer[]): ErpCustomer | null => {
  const taxId = canonical(detected.taxId);
  const businessName = canonical(detected.businessName);
  return customers.find((customer) =>
    (taxId && canonical(customer.taxId) === taxId)
    || (businessName && canonical(customer.companyName || customer.displayName) === businessName)) || null;
};

export const DetectedCustomerModal = ({ detected, clients, onUseLocal, onUseErp, onCreate, onChooseOther, onDismiss }: Props) => {
  const localMatch = useMemo(() => findDetectedCustomerMatch(detected, clients), [clients, detected]);
  const searchTerm = detected.taxId || detected.businessName || [detected.firstName, detected.lastName].filter(Boolean).join(" ");
  const erpSearch = useErpCustomerSearch(searchTerm, !localMatch && searchTerm.trim().length >= 2);
  const erpMatch = useMemo(() => findErpMatch(detected, erpSearch.data || []), [detected, erpSearch.data]);
  const matched = localMatch || erpMatch;
  const displayName = detected.businessName || [detected.firstName, detected.lastName].filter(Boolean).join(" ") || "Cliente sin nombre";

  return <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="detected-customer-title">
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div className="flex gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-800"><Building2 className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Cliente detectado</p><h2 id="detected-customer-title" className="mt-1 text-lg font-bold text-slate-950">{matched ? "Encontramos un cliente registrado" : "Revisa el cliente encontrado"}</h2><p className="mt-1 text-xs text-slate-500">Las partidas ya fueron extraídas. Decide cómo ligar el cliente a la cotización.</p></div></div><button type="button" onClick={onDismiss} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="p-5">
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><Info label="Empresa / nombre" value={displayName} /><Info label="RFC" value={detected.taxId} /><Info label="Contacto" value={detected.contacts[0]?.name} /><Info label="Correo / WhatsApp" value={detected.contacts[0]?.email || detected.contacts[0]?.whatsappPhone} /><Info label="Ubicación" value={[detected.address.city, detected.address.state, detected.address.country].filter(Boolean).join(", ")} /><Info label="Confianza" value={`${Math.round(detected.confidence * 100)}%`} /></section>
        {!localMatch && erpSearch.isFetching && <p className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700"><Loader2 className="h-4 w-4 animate-spin" />Buscando coincidencias en ERP...</p>}
        {matched && <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800"><CheckCircle2 className="h-4 w-4" />Coincidencia {localMatch ? "en el cotizador" : "en ERP"}</p><p className="mt-2 text-sm font-bold text-slate-950">{localMatch ? (localMatch.companyName || `${localMatch.name} ${localMatch.lastname}`) : `${erpMatch?.code ? `${erpMatch.code} · ` : ""}${erpMatch?.companyName || erpMatch?.displayName}`}</p></section>}
        {!matched && !erpSearch.isFetching && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">No encontramos una coincidencia exacta. Revisa los datos antes de crear un cliente local.</p>}
      </div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4"><button type="button" onClick={onDismiss} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Omitir por ahora</button><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onChooseOther} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><Search className="h-4 w-4" />Elegir otro</button>{localMatch && <button type="button" onClick={() => onUseLocal(localMatch)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950"><CheckCircle2 className="h-4 w-4" />Usar cliente encontrado</button>}{!localMatch && erpMatch && <button type="button" onClick={() => onUseErp(erpMatch)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950"><CheckCircle2 className="h-4 w-4" />Vincular cliente ERP</button>}{!matched && !erpSearch.isFetching && <button type="button" onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950"><Store className="h-4 w-4" />Revisar y crear cliente</button>}</div></footer>
    </div>
  </div>;
};

const Info = ({ label, value }: { label: string; value?: string | null }) => <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value || "No detectado"}</p></div>;
