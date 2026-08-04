import type { ErpProduct } from "../../products/types/erp-product.types";

export type AiSimilarityConfidence = "high" | "medium" | "low";
export type AiSimilarProductsEngine = "v2" | "semantic" | "legacy";

export interface AiSimilarProductSuggestion {
  source: string;
  ean: string;
  productId: string;
  description: string;
  originalDescription: string;
  semanticSimilarity: number;
  semanticSimilarityPercent: number;
  finalSimilarity: number;
  finalSimilarityPercent: number;
  similarity: number;
  similarityPercent: number;
  confidence: AiSimilarityConfidence;
  reasons: string[];
  rankingStrategy: string;
  branchCode: string;
  branchProductCode: string;
  availableInBranch: boolean | null;
  availableInAnyBranch: boolean | null;
  resolvedBranchCode: string;
  registeredInBranch: boolean | null;
  stockAvailableInBranch: boolean | null;
  stockAvailableInAnyBranch: boolean | null;
  codeTotalStock: number | null;
  eanTotalStock: number | null;
  branchProduct: ErpProduct | null;
  authorized: boolean | null;
}
