import type { ErpProduct, ErpProductCurrency } from "../../products/types/erp-product.types";
import axios from "axios";
import { aiHttpClient } from "./http/ai-http.client";
import type { AiSimilarityConfidence, AiSimilarProductSuggestion } from "../types/ai-similar-product.types";

interface ApiBranchProduct {
  branchCode?: unknown;
  branchName?: unknown;
  id?: unknown;
  code?: unknown;
  ean?: unknown;
  description?: unknown;
  stock?: unknown;
  unit?: unknown;
  currency?: unknown;
  averageCost?: unknown;
  lastCost?: unknown;
}

interface ApiSimilarItem {
  ean?: unknown;
  productId?: unknown;
  product_id?: unknown;
  description?: unknown;
  originalDescription?: unknown;
  original_description?: unknown;
  semanticSimilarity?: unknown;
  semantic_similarity?: unknown;
  semanticSimilarityPercent?: unknown;
  semantic_similarity_percent?: unknown;
  finalSimilarity?: unknown;
  final_similarity?: unknown;
  finalSimilarityPercent?: unknown;
  final_similarity_percent?: unknown;
  similarity?: unknown;
  similarityPercent?: unknown;
  similarity_percent?: unknown;
  confidence?: unknown;
  reasons?: unknown;
  branchCode?: unknown;
  branch_code?: unknown;
  branchProductCode?: unknown;
  branch_product_code?: unknown;
  availableInBranch?: unknown;
  available_in_branch?: unknown;
  availableInAnyBranch?: unknown;
  available_in_any_branch?: unknown;
  resolvedBranchCode?: unknown;
  resolved_branch_code?: unknown;
  branchProduct?: unknown;
  branch_product?: unknown;
}

interface ApiSimilarProductsResponse {
  items?: unknown;
}

const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const asBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return null;
};

const toCurrency = (value: unknown): ErpProductCurrency => {
  const normalized = asText(value).toUpperCase();
  return normalized === "MXN" ? "MXN" : "USD";
};

const resolveCost = (row: ApiBranchProduct): number => {
  const average = asNumber(row.averageCost);
  const last = asNumber(row.lastCost);
  return Math.max(0, average, last);
};

const asConfidence = (value: unknown): AiSimilarityConfidence => {
  const normalized = asText(value).toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
};

const mapBranchProduct = (input: unknown): ErpProduct | null => {
  if (!input || typeof input !== "object") return null;
  const row = input as ApiBranchProduct;

  const code = asText(row.code);
  const ean = asText(row.ean);
  const description = asText(row.description);

  if (!code || !ean || !description) return null;

  return {
    code,
    ean,
    description,
    branchCode: asText(row.branchCode),
    branchName: asText(row.branchName),
    unit: asText(row.unit) || "PZA",
    stock: Math.max(0, asNumber(row.stock)),
    costCurrency: toCurrency(row.currency),
    costUsd: resolveCost(row),
  };
};

const toReasons = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item)).filter((item) => item.length > 0);
};

const mapItem = (input: unknown): AiSimilarProductSuggestion | null => {
  if (!input || typeof input !== "object") return null;

  const row = input as ApiSimilarItem;
  const ean = asText(row.ean);
  const description = asText(row.description);
  if (!ean || !description) return null;

  const branchProduct = mapBranchProduct(row.branchProduct ?? row.branch_product);

  return {
    ean,
    productId: asText(row.productId ?? row.product_id),
    description,
    originalDescription: asText(row.originalDescription ?? row.original_description),
    semanticSimilarity: asNumber(row.semanticSimilarity ?? row.semantic_similarity),
    semanticSimilarityPercent: asNumber(row.semanticSimilarityPercent ?? row.semantic_similarity_percent),
    finalSimilarity: asNumber(row.finalSimilarity ?? row.final_similarity),
    finalSimilarityPercent: asNumber(row.finalSimilarityPercent ?? row.final_similarity_percent),
    similarity: asNumber(row.similarity),
    similarityPercent: asNumber(row.similarityPercent ?? row.similarity_percent),
    confidence: asConfidence(row.confidence),
    reasons: toReasons(row.reasons),
    branchCode: asText(row.branchCode ?? row.branch_code),
    branchProductCode: asText(row.branchProductCode ?? row.branch_product_code),
    availableInBranch: asBooleanOrNull(row.availableInBranch ?? row.available_in_branch),
    availableInAnyBranch: asBooleanOrNull(row.availableInAnyBranch ?? row.available_in_any_branch),
    resolvedBranchCode: asText(row.resolvedBranchCode ?? row.resolved_branch_code),
    branchProduct,
  };
};

const mapResponse = (payload: unknown): AiSimilarProductSuggestion[] => {
  if (!payload || typeof payload !== "object") return [];

  const rows = (payload as ApiSimilarProductsResponse).items;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => mapItem(row)).filter((row): row is AiSimilarProductSuggestion => row !== null);
};

interface SearchSimilarProductsParams {
  query: string;
  branchCode: string;
  topK?: number;
  limit?: number;
  minScore?: number;
}

export class AiSimilarProductsService {
  static async search(params: SearchSimilarProductsParams, signal?: AbortSignal): Promise<AiSimilarProductSuggestion[]> {
    const query = params.query.trim();
    const branchCode = params.branchCode.trim();

    if (!query || !branchCode) return [];

    try {
      const { data } = await aiHttpClient.post<unknown>(
        "/api/ai/products/similar",
        {
          query,
          branchCode,
          topK: params.topK ?? 30,
          limit: params.limit ?? 10,
          minScore: params.minScore ?? 0.7,
        },
        { signal }
      );

      return mapResponse(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          throw new Error("Límite de IA alcanzado. Espera 20 segundos e intenta de nuevo.");
        }
      }

      throw error;
    }
  }
}
