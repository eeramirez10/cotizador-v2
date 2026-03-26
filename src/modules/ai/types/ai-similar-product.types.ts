import type { ErpProduct } from "../../products/types/erp-product.types";

export type AiSimilarityConfidence = "high" | "medium" | "low";

export interface AiSimilarProductSuggestion {
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
  branchCode: string;
  branchProductCode: string;
  availableInBranch: boolean | null;
  availableInAnyBranch: boolean | null;
  resolvedBranchCode: string;
  branchProduct: ErpProduct | null;
}
