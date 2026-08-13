import { normalizeMeasurementUnit } from "../../products/constants/measurement-units";
import type {
  ExtractedQuotedExcelItem,
  QuotedExcelReviewReason,
} from "../types/quote-extraction-job.types";

export type QuotedExcelReviewField =
  | "description_normalizada"
  | "cantidad"
  | "unidad"
  | "precio_vendedor"
  | "subtotal"
  | "moneda"
  | "tiempo_entrega";

export interface QuotedExcelReviewIssue {
  code: QuotedExcelReviewReason;
  field: QuotedExcelReviewField;
  message: string;
}

const positive = (value: number | null): boolean => value !== null && Number.isFinite(value) && value > 0;

export const getQuotedExcelReviewIssues = (item: ExtractedQuotedExcelItem): QuotedExcelReviewIssue[] => {
  const issues: QuotedExcelReviewIssue[] = [];
  const rawUnit = item.unidad?.trim() ?? "";
  const normalizedUnit = normalizeMeasurementUnit(rawUnit);

  if (!item.description_normalizada.trim()) {
    issues.push({ code: "MISSING_DESCRIPTION", field: "description_normalizada", message: "Falta la descripción." });
  }
  if (!positive(item.cantidad)) {
    issues.push({ code: "INVALID_QUANTITY", field: "cantidad", message: "La cantidad debe ser mayor a cero." });
  }
  if (!rawUnit) {
    issues.push({ code: "MISSING_UNIT", field: "unidad", message: "Falta la unidad de medida." });
  } else if (!normalizedUnit) {
    issues.push({
      code: "UNRECOGNIZED_UNIT",
      field: "unidad",
      message: `La unidad “${rawUnit}” no está reconocida. Selecciona una unidad válida.`,
    });
  }
  if (!positive(item.precio_vendedor)) {
    issues.push({ code: "INVALID_UNIT_PRICE", field: "precio_vendedor", message: "El precio unitario debe ser mayor a cero." });
  }
  if (!positive(item.subtotal)) {
    issues.push({ code: "INVALID_SUBTOTAL", field: "subtotal", message: "El total de la partida debe ser mayor a cero." });
  }
  if (!item.moneda) {
    issues.push({ code: "MISSING_CURRENCY", field: "moneda", message: "No se identificó la moneda de la partida." });
  }
  if (!item.tiempo_entrega?.trim()) {
    issues.push({ code: "MISSING_DELIVERY_TIME", field: "tiempo_entrega", message: "Falta el tiempo de entrega." });
  }

  if (positive(item.cantidad) && positive(item.precio_vendedor) && positive(item.subtotal)) {
    const expectedSubtotal = Number(((item.cantidad ?? 0) * (item.precio_vendedor ?? 0)).toFixed(4));
    const tolerance = Math.max(0.05, expectedSubtotal * 0.001);
    if (Math.abs((item.subtotal ?? 0) - expectedSubtotal) > tolerance) {
      issues.push({
        code: "SUBTOTAL_MISMATCH",
        field: "subtotal",
        message: `El total no coincide con cantidad × precio unitario (${expectedSubtotal.toLocaleString("es-MX", { maximumFractionDigits: 4 })}).`,
      });
    }
  }

  return issues;
};

export const normalizeAndReviewQuotedExcelItem = (
  item: ExtractedQuotedExcelItem,
  normalizeUnit = true,
): ExtractedQuotedExcelItem => {
  const normalizedUnit = normalizeUnit ? normalizeMeasurementUnit(item.unidad) : null;
  const normalizedItem: ExtractedQuotedExcelItem = {
    ...item,
    description_normalizada: item.description_normalizada.trim().toUpperCase(),
    unidad: normalizedUnit ?? item.unidad?.trim().toUpperCase() ?? null,
    tiempo_entrega: item.tiempo_entrega?.trim() || null,
  };
  const issues = getQuotedExcelReviewIssues(normalizedItem);
  return {
    ...normalizedItem,
    requiere_revision: issues.length > 0,
    motivos_revision: issues.map((issue) => issue.code),
  };
};
