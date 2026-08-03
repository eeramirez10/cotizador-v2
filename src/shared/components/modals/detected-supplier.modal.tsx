import { Building2, CheckCircle2, Mail, MessageCircle, Phone, Search, Store, X } from "lucide-react";
import type { ExtractedSupplierData } from "../../../modules/procurement/services/supplier-quote-extraction.service";
import type { SaveSupplierInput, Supplier } from "../../../modules/procurement/services/purchase-requisitions.service";

interface Props {
  detected: ExtractedSupplierData;
  matchedSupplier: Supplier | null;
  onUseMatched: (supplier: Supplier) => void;
  onCreate: (initialValues: Partial<SaveSupplierInput>) => void;
  onChooseOther: () => void;
  onClose: () => void;
}

export const DetectedSupplierModal = ({ detected, matchedSupplier, onUseMatched, onCreate, onChooseOther, onClose }: Props) => {
  const initialValues: Partial<SaveSupplierInput> = {
    name: detected.name || "",
    taxId: detected.taxId || "",
    state: detected.state || "",
    contactName: detected.contactName || "",
    email: detected.email || "",
    phone: detected.phone || "",
    contacts: detectedContacts(detected).map((contact, index, contacts) => ({
      contactKey: `detected-${canonicalContactKey(`${contact.contactName || detected.contactName || detected.name || "supplier"}-${contact.contactPosition || contact.label || "contact"}`)}`,
      channel: contact.channel,
      value: contact.value,
      phoneKind: contact.phoneKind,
      extension: contact.extension,
      isWhatsApp: contact.isWhatsApp,
      contactName: contact.contactName,
      contactPosition: contact.contactPosition,
      label: contact.label,
      isPrimary: contacts.findIndex((entry) => entry.channel === contact.channel) === index,
    })),
    country: detected.country || "MÉXICO",
  };
  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="detected-supplier-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><Building2 className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Proveedor detectado</p><h2 id="detected-supplier-title" className="mt-1 text-lg font-bold text-slate-950">{matchedSupplier ? "Encontramos un proveedor registrado" : "El proveedor no está registrado"}</h2><p className="mt-1 text-xs text-slate-500">Revisa los datos extraídos antes de continuar.</p></div></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5">
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <Info label="Nombre" value={detected.name} />
            <Info label="RFC" value={detected.taxId} />
            <Info label="Estado" value={detected.state} />
            <Info label="País" value={detected.country} />
            <Info label="Contacto" value={detected.contactName} />
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Contactos detectados</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {detectedContacts(detected).map((contact, index) => (
                  <div key={`${contact.channel}-${contact.value}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                      {contact.channel === "EMAIL" ? <Mail className="h-3.5 w-3.5 text-blue-600" /> : <Phone className="h-3.5 w-3.5 text-emerald-600" />}
                      {contact.value}
                      {contact.isWhatsApp && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><MessageCircle className="h-3 w-3" />WhatsApp</span>}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{[contact.contactName, contact.contactPosition, contact.label, contact.phoneKind === "MOBILE" ? "Celular" : contact.phoneKind === "LANDLINE" ? "Teléfono fijo" : null, contact.extension ? `Ext. ${contact.extension}` : null].filter(Boolean).join(" · ") || "Sin etiqueta"}</p>
                  </div>
                ))}
                {detectedContacts(detected).length === 0 && <p className="text-xs text-slate-500">No se identificaron correos ni teléfonos.</p>}
              </div>
            </div>
          </section>
          {detected.evidence && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Fuente: {detected.evidence}</p>}
          {detected.confidence < 0.75 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">La identificación tiene baja confianza. Verifica especialmente razón social y RFC.</p>}
          {matchedSupplier && (
            <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800"><CheckCircle2 className="h-4 w-4" />Coincidencia registrada</p>
              <p className="mt-2 text-sm font-bold text-slate-950">{matchedSupplier.erpCode ? `${matchedSupplier.erpCode} · ` : ""}{matchedSupplier.name}</p>
              <p className="mt-1 text-xs text-slate-600">{matchedSupplier.taxId || matchedSupplier.email || matchedSupplier.phone || "Sin identificador adicional"}</p>
            </section>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onChooseOther} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Search className="h-4 w-4" />Elegir otro</button>
          {matchedSupplier ? <button type="button" onClick={() => onUseMatched(matchedSupplier)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"><CheckCircle2 className="h-4 w-4" />Usar proveedor encontrado</button> : <button type="button" onClick={() => onCreate(initialValues)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"><Store className="h-4 w-4" />Revisar y crear proveedor</button>}
        </footer>
      </div>
    </div>
  );
};

const canonicalContactKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "contact";

const Info = ({ label, value }: { label: string; value: string | null }) => <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value || "No identificado"}</p></div>;

export const findDetectedSupplierMatch = (detected: ExtractedSupplierData, suppliers: Supplier[]): Supplier | null => {
  const canonical = (value: string | null | undefined) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const emails = detectedContacts(detected).filter((contact) => contact.channel === "EMAIL").map((contact) => contact.value.trim().toLowerCase());
  const phones = detectedContacts(detected).filter((contact) => contact.channel === "PHONE").map((contact) => contact.value.replace(/\D/g, ""));
  const taxId = canonical(detected.taxId);
  const name = canonical(detected.name);
  return suppliers.find((supplier) => taxId && canonical(supplier.taxId) === taxId)
    || suppliers.find((supplier) => {
      const supplierEmails = [supplier.email, ...(supplier.contacts || []).filter((contact) => contact.channel === "EMAIL").map((contact) => contact.value)]
        .filter(Boolean).map((value) => value!.trim().toLowerCase());
      return emails.some((email) => supplierEmails.includes(email));
    })
    || suppliers.find((supplier) => {
      const supplierPhones = [supplier.phone, supplier.mobile, ...(supplier.contacts || []).filter((contact) => contact.channel === "PHONE").map((contact) => contact.value)]
        .filter(Boolean).map((value) => value!.replace(/\D/g, ""));
      return phones.some((phone) => supplierPhones.includes(phone));
    })
    || suppliers.find((supplier) => name && canonical(supplier.name) === name)
    || null;
};

const detectedContacts = (detected: ExtractedSupplierData) => {
  if (detected.contacts?.length) return detected.contacts;
  return [
    ...(detected.email ? [{ channel: "EMAIL" as const, value: detected.email, phoneKind: null, extension: null, isWhatsApp: false, contactName: detected.contactName, contactPosition: null, label: null, confidence: detected.confidence, evidence: null }] : []),
    ...(detected.phone ? [{ channel: "PHONE" as const, value: detected.phone, phoneKind: "UNKNOWN" as const, extension: null, isWhatsApp: false, contactName: detected.contactName, contactPosition: null, label: null, confidence: detected.confidence, evidence: null }] : []),
  ];
};
