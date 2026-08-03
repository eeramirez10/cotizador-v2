import { Building2, Loader2, Mail, MessageCircle, Phone, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { PartyDataExtractionService } from "../../../modules/ai/services/party-data-extraction.service";
import type { ExtractedPartyData, PartyDataType } from "../../../modules/ai/types/party-data.types";
import { notifier } from "../../notifications/notifier";

interface Props {
  partyType: PartyDataType;
  onClose: () => void;
  onApply: (data: ExtractedPartyData) => void;
}

export const PartyTextCompletionModal = ({ partyType, onClose, onApply }: Props) => {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExtractedPartyData | null>(null);
  const [loading, setLoading] = useState(false);
  const label = partyType === "CUSTOMER" ? "cliente" : "proveedor";

  const extract = async () => {
    if (text.trim().length < 3 || loading) return;
    setLoading(true);
    try {
      setResult(await PartyDataExtractionService.extract(text, partyType));
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : `No se pudieron extraer los datos del ${label}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="party-text-title">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-800"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Autollenado con IA</p><h2 id="party-text-title" className="mt-1 text-lg font-bold text-slate-950">Completar datos del {label}</h2><p className="mt-1 text-xs text-slate-500">Pega una firma de correo, mensaje de WhatsApp o bloque de datos comerciales.</p></div></div>
          <button type="button" disabled={loading} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <textarea value={text} disabled={loading} onChange={(event) => { setText(event.target.value); setResult(null); }} rows={8} maxLength={20_000} placeholder={`Ejemplo: ${partyType === "CUSTOMER" ? "Empresa, contacto, correo, WhatsApp, RFC y dirección..." : "Proveedor, contacto, teléfono, correo, RFC, país y condiciones..."}`} className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100" />
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>La información se aplicará al formulario únicamente después de tu confirmación.</span><span>{text.length}/20000</span></div>
          {result && <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="text-sm font-bold text-slate-950">{result.businessName || [result.firstName, result.lastName].filter(Boolean).join(" ") || "Identidad no encontrada"}</p><p className="mt-1 text-xs text-slate-500">RFC: {result.taxId || "No detectado"} · Confianza: {Math.round(result.confidence * 100)}%</p></div></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {result.contacts.map((contact, index) => <div key={`${contact.email}-${contact.landlinePhone}-${contact.whatsappPhone}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-slate-900">{contact.name || "Contacto sin nombre"}</p><p className="mt-1 text-[11px] text-slate-500">{contact.position || contact.label || "Sin puesto"}</p>{contact.email && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-700"><Mail className="h-3.5 w-3.5 text-blue-600" />{contact.email}</p>}{contact.landlinePhone && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-700"><Phone className="h-3.5 w-3.5" />{contact.landlinePhone}{contact.extension ? ` ext. ${contact.extension}` : ""}</p>}{contact.whatsappPhone && <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700"><MessageCircle className="h-3.5 w-3.5" />{contact.whatsappPhone}</p>}</div>)}
              {result.contacts.length === 0 && <p className="text-xs text-slate-500">No se detectaron contactos. Puedes aplicar el resto y completarlos manualmente.</p>}
            </div>
          </section>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" disabled={loading} onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
          {!result ? <button type="button" disabled={loading || text.trim().length < 3} onClick={() => void extract()} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? "Analizando..." : "Analizar con IA"}</button> : <button type="button" onClick={() => onApply(result)} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"><Sparkles className="h-4 w-4" />Aplicar al formulario</button>}
        </footer>
      </div>
    </div>
  );
};
