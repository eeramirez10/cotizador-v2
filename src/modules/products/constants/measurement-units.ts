export const MEASUREMENT_UNIT_OPTIONS = [
  { value: "PZ", label: "PZ - Pieza" },
  { value: "K", label: "K - Kilo" },
  { value: "M", label: "M - Metro" },
  { value: "ML", label: "ML - Metro lineal" },
  { value: "L", label: "L - Litro" },
  { value: "TR", label: "TR - Tramos" },
  { value: "SE", label: "SE - Servicio" },
  { value: "ACT", label: "ACT - Actividad" },
  { value: "FT", label: "FT - Pies" },
  { value: "XRO", label: "XRO - Rollo" },
  { value: "UNO", label: "UNO - Uno" },
  { value: "M2", label: "M2 - Metro cuadrado" },
  { value: "LOT", label: "LOT - Lote" },
  { value: "CON", label: "CON - Conjunto" },
] as const;

export const MEASUREMENT_UNIT_VALUES = MEASUREMENT_UNIT_OPTIONS.map((option) => option.value);
export type MeasurementUnit = (typeof MEASUREMENT_UNIT_OPTIONS)[number]["value"];

const UNIT_ALIASES = new Map<string, MeasurementUnit>([
  ["PZ", "PZ"], ["PZA", "PZ"], ["PZAS", "PZ"], ["PIEZA", "PZ"], ["PIEZAS", "PZ"],
  ["PC", "PZ"], ["PCS", "PZ"], ["PIECE", "PZ"], ["PIECES", "PZ"],
  ["K", "K"], ["KG", "K"], ["KGS", "K"], ["KILO", "K"], ["KILOS", "K"],
  ["KILOGRAMO", "K"], ["KILOGRAMOS", "K"], ["KILOGRAM", "K"], ["KILOGRAMS", "K"],
  ["M", "M"], ["MT", "M"], ["MTS", "M"], ["MTR", "M"], ["MTRS", "M"],
  ["METRO", "M"], ["METROS", "M"],
  ["ML", "ML"], ["M L", "ML"], ["MTL", "ML"], ["MTLS", "ML"],
  ["METRO LINEAL", "ML"], ["METROS LINEALES", "ML"],
  ["L", "L"], ["LT", "L"], ["LTS", "L"], ["LTR", "L"], ["LITRO", "L"], ["LITROS", "L"],
  ["TR", "TR"], ["TMO", "TR"], ["TMOS", "TR"], ["TRAMO", "TR"], ["TRAMOS", "TR"],
  ["SE", "SE"], ["SERV", "SE"], ["SERVICIO", "SE"], ["SERVICIOS", "SE"], ["SERVICE", "SE"],
  ["ACT", "ACT"], ["ACTIVIDAD", "ACT"], ["ACTIVIDADES", "ACT"], ["ACTIVITY", "ACT"],
  ["FT", "FT"], ["FTS", "FT"], ["PIE", "FT"], ["PIES", "FT"], ["FOOT", "FT"], ["FEET", "FT"],
  ["XRO", "XRO"], ["RLL", "XRO"], ["RLLS", "XRO"], ["ROLLO", "XRO"], ["ROLLOS", "XRO"], ["ROLL", "XRO"],
  ["UNO", "UNO"], ["UN", "UNO"], ["UND", "UNO"], ["UNID", "UNO"], ["UNIDAD", "UNO"],
  ["UNIDADES", "UNO"], ["EA", "UNO"], ["EACH", "UNO"],
  ["M2", "M2"], ["MT2", "M2"], ["MTS2", "M2"], ["METRO CUADRADO", "M2"],
  ["METROS CUADRADOS", "M2"], ["SQM", "M2"],
  ["LOT", "LOT"], ["LOTE", "LOT"], ["LOTES", "LOT"],
  ["CON", "CON"], ["CONJ", "CON"], ["CONJUNTO", "CON"], ["CONJUNTOS", "CON"],
  ["JGO", "CON"], ["JUEGO", "CON"], ["JUEGOS", "CON"], ["SET", "CON"], ["SETS", "CON"],
]);

export const normalizeMeasurementUnit = (value: unknown): MeasurementUnit | null => {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/²/g, "2")
    .replace(/\^2/g, "2")
    .trim()
    .toUpperCase()
    .replace(/[.,;:()"'`]/g, "")
    .replace(/[/_-]+/g, " ")
    .replace(/\s+/g, " ");
  return UNIT_ALIASES.get(normalized) ?? UNIT_ALIASES.get(normalized.replace(/\s+/g, "")) ?? null;
};
