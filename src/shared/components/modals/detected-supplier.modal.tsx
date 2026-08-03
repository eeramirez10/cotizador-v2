import { Building2, CheckCircle2, Search, Store, X } from "lucide-react";
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
    country: "MÉXICO",
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
            <Info label="Contacto" value={detected.contactName} />
            <Info label="Correo" value={detected.email} />
            <Info label="Teléfono" value={detected.phone} />
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

const Info = ({ label, value }: { label: string; value: string | null }) => <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value || "No identificado"}</p></div>;

export const findDetectedSupplierMatch = (detected: ExtractedSupplierData, suppliers: Supplier[]): Supplier | null => {
  const canonical = (value: string | null | undefined) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const email = (detected.email || "").trim().toLowerCase();
  const phone = (detected.phone || "").replace(/\D/g, "");
  const taxId = canonical(detected.taxId);
  const name = canonical(detected.name);
  return suppliers.find((supplier) => taxId && canonical(supplier.taxId) === taxId)
    || suppliers.find((supplier) => email && supplier.email?.trim().toLowerCase() === email)
    || suppliers.find((supplier) => phone && [supplier.phone, supplier.mobile].some((value) => value?.replace(/\D/g, "") === phone))
    || suppliers.find((supplier) => name && canonical(supplier.name) === name)
    || null;
};
