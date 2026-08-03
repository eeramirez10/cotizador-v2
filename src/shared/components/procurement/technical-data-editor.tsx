import { Loader2, Sparkles } from "lucide-react";

export interface TechnicalDataFormValue {
  standard: string;
  diameter: string;
  thickness: string;
  bore: string;
  technicalFamily: string;
  technicalAttributes: Record<string, string>;
}

export const TECHNICAL_FAMILIES = [
  ["PIPE", "Tubería"], ["VALVE", "Válvula"], ["FITTING", "Conexión"], ["FLANGE", "Brida"],
  ["GASKET", "Empaque"], ["FASTENER", "Tornillería"], ["OTHER", "Otro"],
] as const;

export const TECHNICAL_FIELDS: Record<string, Array<[string, string]>> = {
  PIPE: [["MATERIAL", "Material"], ["STANDARD", "Norma"], ["GRADE", "Grado"], ["NOMINAL_DIAMETER", "Diámetro nominal"], ["SCHEDULE", "Cédula"], ["THICKNESS", "Espesor"], ["MANUFACTURING", "Fabricación"], ["LENGTH", "Longitud"]],
  VALVE: [["TYPE", "Tipo"], ["NOMINAL_DIAMETER", "Diámetro nominal"], ["PRESSURE_CLASS", "Clase / presión"], ["CONNECTION", "Conexión"], ["BODY_MATERIAL", "Material del cuerpo"], ["TRIM", "Trim"], ["OPERATION", "Operación"]],
  FITTING: [["FIGURE", "Figura"], ["MATERIAL", "Material"], ["STANDARD", "Norma"], ["NOMINAL_DIAMETER", "Diámetro nominal"], ["SCHEDULE", "Cédula / clase"], ["CONNECTION", "Conexión"]],
  FLANGE: [["TYPE", "Tipo"], ["MATERIAL", "Material"], ["STANDARD", "Norma"], ["NOMINAL_DIAMETER", "Diámetro nominal"], ["PRESSURE_CLASS", "Clase"], ["FACE", "Cara"]],
  GASKET: [["MATERIAL", "Material"], ["STANDARD", "Norma"], ["NOMINAL_DIAMETER", "Diámetro nominal"], ["PRESSURE_CLASS", "Clase"], ["THICKNESS", "Espesor"]],
  FASTENER: [["TYPE", "Tipo"], ["MATERIAL", "Material"], ["STANDARD", "Norma"], ["GRADE", "Grado"], ["NOMINAL_DIAMETER", "Diámetro"], ["LENGTH", "Longitud"]],
  OTHER: [],
};

interface Props {
  value: TechnicalDataFormValue;
  onChange: (value: TechnicalDataFormValue) => void;
  onSuggest?: () => void;
  suggesting?: boolean;
}

export const technicalDataStatus = (value: TechnicalDataFormValue): "PENDING" | "COMPLETE" => (
  value.standard.trim()
  || value.diameter.trim()
  || value.thickness.trim()
  || value.bore.trim()
  || Object.values(value.technicalAttributes).some((entry) => entry.trim())
) ? "COMPLETE" : "PENDING";

export const TechnicalDataEditor = ({ value, onChange, onSuggest, suggesting = false }: Props) => {
  const update = <K extends keyof TechnicalDataFormValue>(key: K, fieldValue: TechnicalDataFormValue[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Datos técnicos para requisición</p><p className="mt-1 text-[11px] text-slate-500">Solo captura los atributos que aplican al producto.</p></div>
        {onSuggest && <button type="button" disabled={suggesting} onClick={onSuggest} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Completar con IA</button>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TechnicalField label="Norma" value={value.standard} onChange={(fieldValue) => update("standard", fieldValue)} placeholder="ASTM A53" />
        <TechnicalField label="Diámetro" value={value.diameter} onChange={(fieldValue) => update("diameter", fieldValue)} placeholder={'2"'} />
        <TechnicalField label="Espesor" value={value.thickness} onChange={(fieldValue) => update("thickness", fieldValue)} placeholder="Cédula 40" />
        <TechnicalField label="Bore" value={value.bore} onChange={(fieldValue) => update("bore", fieldValue)} placeholder="Opcional" />
      </div>
      <label className="mt-4 block text-xs font-semibold text-slate-600">Familia del producto
        <select value={value.technicalFamily || "OTHER"} onChange={(event) => update("technicalFamily", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
          {TECHNICAL_FAMILIES.map(([family, label]) => <option key={family} value={family}>{label}</option>)}
        </select>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(TECHNICAL_FIELDS[value.technicalFamily || "OTHER"] || []).map(([key, label]) => (
          <TechnicalField key={key} label={label} value={value.technicalAttributes[key] || ""} onChange={(fieldValue) => update("technicalAttributes", { ...value.technicalAttributes, [key]: fieldValue.toUpperCase() })} />
        ))}
      </div>
    </section>
  );
};

const TechnicalField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) => (
  <label className="text-xs font-semibold text-slate-600">{label}<input value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>
);
