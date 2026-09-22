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
}

export const ProductCatalogSelect = ({
  label,
  value,
  options,
  onChange,
  placeholder = "Por definir",
  disabled = false,
}: ProductCatalogSelectProps) => {
  const knownValue = options.some(([optionValue]) => optionValue === value);
  const [customMode, setCustomMode] = useState(Boolean(value && !knownValue));
  const showCustom = customMode || Boolean(value && !knownValue);

  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select
        value={showCustom ? CUSTOM_VALUE : value}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value === CUSTOM_VALUE) {
            setCustomMode(true);
            onChange("");
            return;
          }
          setCustomMode(false);
          onChange(event.target.value);
        }}
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
