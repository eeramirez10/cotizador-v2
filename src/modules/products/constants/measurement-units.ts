export const MEASUREMENT_UNIT_OPTIONS = [
  { value: "PZA", label: "PZA - Pieza" },
  { value: "M", label: "M - Metro" },
  { value: "FT", label: "FT - Pie" },
  { value: "KG", label: "KG - Kilo" },
  { value: "TR", label: "TR - Tramo" },
  { value: "SE", label: "SE - Servicio" },
  { value: "MPZ", label: "MPZ - Metro/Pieza" },
  { value: "LB", label: "LB - Libra" },
  { value: "CM", label: "CM - Centimetro" },
  { value: "MM", label: "MM - Milimetro" },
  { value: "IN", label: "IN - Pulgada" },
  { value: "GAL", label: "GAL - Galon" },
  { value: "L", label: "L - Litro" },
] as const;

export const MEASUREMENT_UNIT_VALUES = MEASUREMENT_UNIT_OPTIONS.map((option) => option.value);
