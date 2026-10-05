import { MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import type { ProductCatalogOption } from "../constants/local-product-technical-options";

const CUSTOM_VALUE = "__CUSTOM_PRODUCT_SPECIFICATION__";

interface ProductCatalogSelectProps {
  label: string;
  value: string;
  options: ReadonlyArray<ProductCatalogOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

export const ProductCatalogSelect = ({
  label,
  value,
  options,
  onChange,
  placeholder = "Por definir",
  disabled = false,
  compact = false,
}: ProductCatalogSelectProps) => {
  const knownValue = options.some(([optionValue]) => optionValue === value);
  const [customMode, setCustomMode] = useState(Boolean(value && !knownValue));
  const showCustom = customMode || Boolean(value && !knownValue);
  const selectValue = (next: string) => {
    if (next === CUSTOM_VALUE) {
      setCustomMode(true);
      onChange("");
      return;
    }
    setCustomMode(false);
    onChange(next);
  };

  if (compact) return <div className="min-w-0">
    <TextField select fullWidth size="small" label={label} value={showCustom ? CUSTOM_VALUE : value} disabled={disabled} onChange={(event) => selectValue(event.target.value)} sx={{ "& .MuiInputBase-root": { minHeight: 31, fontSize: 11 }, "& .MuiSelect-select": { py: "6px", px: 1 }, "& .MuiInputLabel-root": { fontSize: 11 } }}>
      <MenuItem value="" sx={{ fontSize: 11 }}>{placeholder}</MenuItem>
      {options.map(([optionValue, optionLabel]) => <MenuItem key={optionValue} value={optionValue} sx={{ fontSize: 11 }}>{optionLabel}</MenuItem>)}
      <MenuItem value={CUSTOM_VALUE} sx={{ fontSize: 11 }}>Otra especificación...</MenuItem>
    </TextField>
    {showCustom && <TextField autoFocus={!value} fullWidth size="small" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="Escribe la especificación exacta" sx={{ mt: 1, "& .MuiInputBase-root": { minHeight: 31, fontSize: 11 }, "& .MuiInputBase-input": { py: "6px", px: 1 } }} />}
  </div>;

  return (
    <label className={`block font-semibold text-slate-600 ${compact ? "text-[10px]" : "text-xs"}`}>
      {label}
      <select
        value={showCustom ? CUSTOM_VALUE : value}
        disabled={disabled}
        onChange={(event) => selectValue(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
        <option value={CUSTOM_VALUE}>Otra especificación...</option>
      </select>
      {showCustom && (
        <input
          autoFocus={!value}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="Escribe la especificación exacta"
          className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
      )}
    </label>
  );
};
