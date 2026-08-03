import { Loader2, PackageSearch, X } from "lucide-react";
import { useState } from "react";
import { TechnicalDataService } from "../../../modules/procurement/services/technical-data.service";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import type { ManualQuoteItem, QuoteCurrency } from "../../../store/quote/manual-quote.store";
import { notifier } from "../../notifications/notifier";
import { TechnicalDataEditor, type TechnicalDataFormValue } from "../procurement/technical-data-editor";

export interface BulkProcurementItemForm extends TechnicalDataFormValue {
  technicalRequiresReview: boolean;
  supplierDescription: string;
  unitCost: string;
  currency: QuoteCurrency;
  exchangeRate: string;
  brand: string;
  origin: string;
  deliveryTime: string;
  validUntil: string;
  externalReference: string;
  notes: string;
}

interface Props {
  item: ManualQuoteItem;
  value: BulkProcurementItemForm;
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  onSave: (value: BulkProcurementItemForm) => void;
  onClose: () => void;
}

const optionValue = (option: QuoteCatalogOption) => option.value || option.label;
const canonical = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100";
const labelClass = "text-xs font-semibold text-slate-600";

export const BulkProcurementItemEditorModal = ({ item, value, brands, origins, deliveryTimes, onSave, onClose }: Props) => {
  const [form, setForm] = useState(value);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof BulkProcurementItemForm>(key: K, fieldValue: BulkProcurementItemForm[K]) => setForm((current) => ({ ...current, [key]: fieldValue }));
  const withCurrentOption = (options: QuoteCatalogOption[], current: string) => current && !options.some((option) => canonical(optionValue(option)) === canonical(current));

  const suggestTechnical = async () => {
    try {
      setSuggesting(true);
      setError("");
      const suggestion = await TechnicalDataService.suggest({
        requestedDescription: item.erpDescription || item.customerDescription,
        supplierDescription: form.supplierDescription.trim() || undefined,
        existingAttributes: form.technicalAttributes,
      });
      const attributes = Object.fromEntries(suggestion.attributes.map((attribute) => [attribute.key, attribute.value]));
      setForm((current) => ({
        ...current,
        technicalRequiresReview: suggestion.confidence < 0.75 || suggestion.attributes.some((attribute) => attribute.confidence < 0.65),
        technicalFamily: suggestion.family,
        technicalAttributes: { ...current.technicalAttributes, ...attributes },
        standard: attributes.STANDARD || current.standard,
        diameter: attributes.NOMINAL_DIAMETER || current.diameter,
        thickness: attributes.THICKNESS || attributes.SCHEDULE || current.thickness,
      }));
      notifier.success(`IA sugirió ${suggestion.attributes.length} dato(s) técnicos. Revisa antes de aplicar.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron sugerir datos técnicos.");
    } finally {
      setSuggesting(false);
    }
  };

  const submit = () => {
    const cost = Number(form.unitCost);
    const exchangeRate = Number(form.exchangeRate);
    if (!form.supplierDescription.trim()) return setError("Captura la descripción utilizada por el proveedor.");
    if (!Number.isFinite(cost) || cost <= 0) return setError("El costo unitario debe ser mayor a cero.");
    if (form.currency === "USD" && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) return setError("Captura un tipo de cambio válido.");
    if (!form.deliveryTime) return setError("Selecciona el tiempo de entrega de esta partida.");
    onSave({ ...form, technicalRequiresReview: false, supplierDescription: form.supplierDescription.trim().toUpperCase() });
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-item-editor-title">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><PackageSearch className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Detalle de la partida</p><h2 id="bulk-item-editor-title" className="mt-1 text-lg font-bold text-slate-950">{item.erpCode || "Producto local"}</h2><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.erpDescription || item.customerDescription}</p></div></div>
          <button type="button" disabled={suggesting} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto p-5">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Descripción según el proveedor *<textarea value={form.supplierDescription} onChange={(event) => update("supplierDescription", event.target.value)} onBlur={(event) => update("supplierDescription", event.currentTarget.value.toUpperCase())} rows={3} maxLength={500} className={inputClass} /></label>
            <label className={labelClass}>Costo unitario *<input type="number" min="0" step="0.0001" value={form.unitCost} onChange={(event) => update("unitCost", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Moneda *<select value={form.currency} onChange={(event) => update("currency", event.target.value as QuoteCurrency)} className={inputClass}><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
            {form.currency === "USD" && <label className={labelClass}>Tipo de cambio *<input type="number" min="0" step="0.0001" value={form.exchangeRate} onChange={(event) => update("exchangeRate", event.target.value)} className={inputClass} /></label>}
            <SelectField label="Marca" value={form.brand} options={brands} includeCurrent={withCurrentOption(brands, form.brand)} onChange={(fieldValue) => update("brand", fieldValue)} />
            <SelectField label="Procedencia" value={form.origin} options={origins} includeCurrent={withCurrentOption(origins, form.origin)} onChange={(fieldValue) => update("origin", fieldValue)} />
            <SelectField label="Tiempo de entrega *" value={form.deliveryTime} options={deliveryTimes} includeCurrent={withCurrentOption(deliveryTimes, form.deliveryTime)} onChange={(fieldValue) => update("deliveryTime", fieldValue)} />
            <label className={labelClass}>Vigencia<input type="date" value={form.validUntil} onChange={(event) => update("validUntil", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Referencia del proveedor<input value={form.externalReference} onChange={(event) => update("externalReference", event.target.value)} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Notas y condiciones<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} maxLength={1000} className={inputClass} /></label>
          </section>
          <div className="mt-5"><TechnicalDataEditor value={form} onChange={(technical) => setForm((current) => ({ ...current, ...technical }))} onSuggest={() => void suggestTechnical()} suggesting={suggesting} /></div>
          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4"><button type="button" disabled={suggesting} onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button><button type="button" disabled={suggesting} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{suggesting && <Loader2 className="h-4 w-4 animate-spin" />}Aplicar a la partida</button></footer>
      </div>
    </div>
  );
};

const SelectField = ({ label, value, options, includeCurrent, onChange }: { label: string; value: string; options: QuoteCatalogOption[]; includeCurrent: boolean | ""; onChange: (value: string) => void }) => (
  <label className={labelClass}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">Seleccionar</option>{includeCurrent && <option value={value}>{value} (actual)</option>}{options.map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}</select></label>
);
