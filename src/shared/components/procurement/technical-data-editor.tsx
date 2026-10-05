import { Loader2, Sparkles } from "lucide-react";
import { MenuItem, TextField } from "@mui/material";
import { ProductCatalogSelect } from "../../../modules/products/components/product-catalog-select";
import {
  LOCAL_PRODUCT_FAMILIES,
  LOCAL_PRODUCT_TECHNICAL_FIELDS,
} from "../../../modules/products/constants/local-product-catalog";
import { getLocalProductTechnicalOptions } from "../../../modules/products/constants/local-product-technical-options";

export interface TechnicalDataFormValue {
  standard: string;
  diameter: string;
  thickness: string;
  bore: string;
  technicalFamily: string;
  technicalAttributes: Record<string, string>;
}

const TECHNICAL_FAMILIES = LOCAL_PRODUCT_FAMILIES;
const TECHNICAL_FIELDS = LOCAL_PRODUCT_TECHNICAL_FIELDS;

interface Props {
  value: TechnicalDataFormValue;
  onChange: (value: TechnicalDataFormValue) => void;
  onSuggest?: () => void;
  suggesting?: boolean;
  compact?: boolean;
}

export const TechnicalDataEditor = ({ value, onChange, onSuggest, suggesting = false, compact = false }: Props) => {
  const update = <K extends keyof TechnicalDataFormValue>(key: K, fieldValue: TechnicalDataFormValue[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };
  const changeFamily = (family: string) => onChange({
    ...value,
    technicalFamily: family,
    standard: "",
    diameter: "",
    thickness: "",
    bore: "",
    technicalAttributes: {},
  });
  return (
    <section className={`rounded-xl border border-slate-200 bg-slate-50/60 ${compact ? "p-2" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Datos técnicos para requisición</p><p className="mt-1 text-[11px] text-slate-500">Solo captura los atributos que aplican al producto.</p></div>
        {onSuggest && <button type="button" disabled={suggesting} onClick={onSuggest} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Completar con IA</button>}
      </div>
      {compact ? <TextField select fullWidth size="small" label="Familia del producto" value={value.technicalFamily || "OTHER"} onChange={(event) => changeFamily(event.target.value)} sx={{ mt: 1.5, "& .MuiInputBase-root": { minHeight: 31, fontSize: 11 }, "& .MuiSelect-select": { py: "6px", px: 1 }, "& .MuiInputLabel-root": { fontSize: 11 } }}>
        {TECHNICAL_FAMILIES.map(([family, label]) => <MenuItem key={family} value={family} sx={{ fontSize: 11 }}>{label}</MenuItem>)}
      </TextField> : <label className="mt-4 block text-xs font-semibold text-slate-600">Familia del producto
        <select value={value.technicalFamily || "OTHER"} onChange={(event) => changeFamily(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
          {TECHNICAL_FAMILIES.map(([family, label]) => <option key={family} value={family}>{label}</option>)}
        </select>
      </label>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCatalogSelect compact={compact} key={`${value.technicalFamily}-standard`} label="Norma" value={value.standard} options={getLocalProductTechnicalOptions(value.technicalFamily, "STANDARD")} onChange={(fieldValue) => update("standard", fieldValue)} />
        <ProductCatalogSelect compact={compact} key={`${value.technicalFamily}-diameter`} label="Diámetro" value={value.diameter} options={getLocalProductTechnicalOptions(value.technicalFamily, "NOMINAL_DIAMETER")} onChange={(fieldValue) => update("diameter", fieldValue)} />
        <ProductCatalogSelect compact={compact} key={`${value.technicalFamily}-thickness`} label="Espesor / cédula" value={value.thickness} options={[...getLocalProductTechnicalOptions(value.technicalFamily, "SCHEDULE"), ...getLocalProductTechnicalOptions(value.technicalFamily, "THICKNESS")]} onChange={(fieldValue) => update("thickness", fieldValue)} />
        <ProductCatalogSelect compact={compact} key={`${value.technicalFamily}-bore`} label="Bore / paso" value={value.bore} options={getLocalProductTechnicalOptions(value.technicalFamily, "BORE")} onChange={(fieldValue) => update("bore", fieldValue)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(TECHNICAL_FIELDS[value.technicalFamily || "OTHER"] || []).filter(([key]) => !["STANDARD", "NOMINAL_DIAMETER", "THICKNESS", "SCHEDULE", "BORE"].includes(key)).map(([key, label]) => (
          <ProductCatalogSelect compact={compact} key={`${value.technicalFamily}-${key}`} label={label} value={value.technicalAttributes[key] || ""} options={getLocalProductTechnicalOptions(value.technicalFamily, key)} onChange={(fieldValue) => update("technicalAttributes", { ...value.technicalAttributes, [key]: fieldValue })} />
        ))}
      </div>
    </section>
  );
};
