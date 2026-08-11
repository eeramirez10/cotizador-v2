import type { ErpProduct, ErpProductCurrency } from "../../types/erp-product.types";
import { normalizeMeasurementUnit } from "../../constants/measurement-units";

interface ErpByEanRow {
  id?: string | number;
  code?: string;
  ean?: string;
  description?: string;
  stock?: number | string;
  unit?: string;
  currency?: string;
  saleCurrency?: string;
  costCurrency?: string;
  cost?: number | string;
  averageCost?: number | string;
  lastCost?: number | string;
  averageCostMxn?: number | string;
  lastCostMxn?: number | string;
  warehouseId?: string | number;
  warehouseName?: string;
  authorized?: boolean;
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
  const directCost = toNumber(row.cost);
  const lastCost = toNumber(row.lastCostMxn ?? row.lastCost);
  const averageCost = toNumber(row.averageCostMxn ?? row.averageCost);

  return Math.max(0, directCost, lastCost, averageCost);
};

const asByEanRows = (payload: unknown): ErpByEanRow[] => {
  if (Array.isArray(payload)) return payload as ErpByEanRow[];
  if (payload && typeof payload === "object") {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items as ErpByEanRow[];
  }
  return [];
};

interface MapByEanOptions {
  branchCode?: string;
  branchName?: string;
}

export const mapByEanPayload = (payload: unknown, options?: MapByEanOptions): ErpProduct[] => {
  return asByEanRows(payload)
    .map((row) => {
      const code = toText(row.code);
      const ean = toText(row.ean);
      const description = toText(row.description);

      if (!code || !ean || !description) return null;

      const rawUnit = toText(row.unit);
      const unit = normalizeMeasurementUnit(rawUnit) ?? (rawUnit || "PZ");
      const stock = Math.max(0, toNumber(row.stock));
      const saleCurrency = toCurrency(row.saleCurrency ?? row.currency);
      const warehouseCode = toText(row.warehouseId) || options?.branchCode;
      const warehouseName = toText(row.warehouseName) || options?.branchName;

      const mapped: ErpProduct = {
        code,
        ean,
        description,
        unit,
        costUsd: resolveCost(row),
        costCurrency: "MXN",
        saleCurrency,
        stock,
        branchCode: warehouseCode,
        branchName: warehouseName,
        warehouseCode,
        warehouseName,
        authorized: typeof row.authorized === "boolean" ? row.authorized : Boolean(toText(row.warehouseId)),
      };
      return mapped;
    })
    .filter((row): row is ErpProduct => row !== null);
};
