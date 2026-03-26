export const SUPPORTED_BRANCH_CODES = ["01", "02", "03", "04", "05", "06", "07"] as const;

const BRANCH_NAME_BY_CODE: Record<string, string> = {
  "01": "Mexico",
  "02": "Monterrey",
  "03": "Veracruz",
  "04": "Mexicali",
  "05": "Queretaro",
  "06": "Cancun",
  "07": "Cabos",
};

export const getBranchNameByCode = (branchCode?: string): string => {
  const normalized = (branchCode ?? "").trim();
  if (!normalized) return "Sin sucursal";
  return BRANCH_NAME_BY_CODE[normalized] ?? `Sucursal ${normalized}`;
};

const normalizeBranchLabel = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

export const resolveBranchCode = (
  erpBranchCode?: string,
  branchCode?: string,
  branchName?: string,
): string => {
  const explicitCode = (erpBranchCode || branchCode || "").trim();
  if (/^\d{2}$/.test(explicitCode)) return explicitCode;
  if (/^\d{1}$/.test(explicitCode)) return `0${explicitCode}`;

  const normalizedName = normalizeBranchLabel(branchName || "");

  if (normalizedName.includes("cdmx")) return "01";
  if (normalizedName.includes("mexico")) return "01";
  if (normalizedName.includes("monterrey")) return "02";
  if (normalizedName.includes("veracruz")) return "03";
  if (normalizedName.includes("mexicali")) return "04";
  if (normalizedName.includes("queretaro")) return "05";
  if (normalizedName.includes("cancun")) return "06";
  if (normalizedName.includes("cabos")) return "07";

  return "";
};
