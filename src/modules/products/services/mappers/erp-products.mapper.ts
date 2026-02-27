import type { ErpProduct, ErpProductCurrency } from "../../types/erp-product.types";

interface ErpByEanRow {
  id?: string | number;
  code?: string;
  ean?: string;
  description?: string;
  stock?: number | string;
  unit?: string;
  currency?: string;
  averageCost?: number | string;
  lastCost?: number | string;
  [key: string]: unknown;
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
};

const toText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const toCurrency = (value: unknown): ErpProductCurrency => {
  const normalized = toText(value).toUpperCase();
  return normalized === "MXN" ? "MXN" : "USD";
};

const resolveCost = (row: ErpByEanRow): number => {
  const lastCost = toNumber(row.lastCost);
  if (lastCost > 0) return lastCost;

  return toNumber(row.averageCost);
};

const asByEanRows = (payload: unknown): ErpByEanRow[] => {
  if (!Array.isArray(payload)) return [];
  return payload as ErpByEanRow[];
};

export const mapByEanPayload = (payload: unknown): ErpProduct[] => {
  return asByEanRows(payload)
    .map((row) => {
      const code = toText(row.code);
      const ean = toText(row.ean);
      const description = toText(row.description);

      if (!code || !ean || !description) return null;

      const unit = toText(row.unit) || "PZA";
      const stock = Math.max(0, toNumber(row.stock));
      const costCurrency = toCurrency(row.currency);

      const mapped: ErpProduct = {
        code,
        ean,
        description,
        unit,
        costUsd: resolveCost(row),
        costCurrency,
        stock,
      };
      return mapped;
    })
    .filter((row): row is ErpProduct => row !== null);
};
