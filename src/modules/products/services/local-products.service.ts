import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { ErpProductCurrency } from "../types/erp-product.types";

export interface LocalProductBatchItemInput {
  itemId: string;
  description: string;
  unit?: string;
  currency?: ErpProductCurrency;
  averageCost?: number | null;
  lastCost?: number | null;
  stock?: number | null;
  eanSuggested?: string | null;
}

export interface LocalProductBatchResultItem {
  itemId: string;
  action: "created" | "matched";
  product: {
    id: string;
    source: "ERP" | "LOCAL_TEMP";
    code: string | null;
    ean: string | null;
    description: string;
    unit: string;
    currency: ErpProductCurrency;
    averageCost: number | null;
    lastCost: number | null;
    stock: number | null;
  };
}

export interface LocalProduct {
  id: string;
  source: "ERP" | "LOCAL_TEMP";
  externalId: string | null;
  externalSystem: string | null;
  code: string | null;
  ean: string | null;
  description: string;
  unit: string;
  currency: ErpProductCurrency;
  averageCost: number | null;
  lastCost: number | null;
  stock: number | null;
  branchId: string | null;
  isActive: boolean;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  branch: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface ListLocalProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
}

export interface PaginatedLocalProducts {
  items: LocalProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export interface UpdateLocalProductInput {
  code?: string | null;
  ean?: string | null;
  description?: string;
  unit?: string;
  currency?: ErpProductCurrency;
  averageCost?: number | null;
  lastCost?: number | null;
  stock?: number | null;
  isActive?: boolean;
}

export interface SimilarLocalProductCandidate {
  matchType: "EXACT" | "SEMANTIC";
  similarity: number;
  similarityPercent: number;
  product: LocalProduct;
}

export interface SimilarLocalProductsResult {
  semanticAvailable: boolean;
  items: SimilarLocalProductCandidate[];
}

interface LocalProductsBatchApiResponse {
  createdCount: number;
  matchedCount: number;
  total: number;
  items: LocalProductBatchResultItem[];
}

interface LocalProductsListApiResponse {
  items: LocalProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

const requireAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sesion no valida. Inicia sesion nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

export class LocalProductsService {
  private static readonly similarCacheTtlMs = 30_000;
  private static readonly similarCache = new Map<
    string,
    { expiresAt: number; result: SimilarLocalProductsResult }
  >();
  private static readonly similarRequests = new Map<string, Promise<SimilarLocalProductsResult>>();

  static async searchSimilar(input: {
    description: string;
    unit: string;
    topK?: number;
  }): Promise<SimilarLocalProductsResult> {
    const description = input.description.trim().toUpperCase();
    const unit = input.unit.trim().toUpperCase();
    const topK = input.topK ?? 8;
    const cacheKey = JSON.stringify([description, unit, topK]);
    const cached = this.similarCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const pending = this.similarRequests.get(cacheKey);
    if (pending) return pending;

    const request = coreHttpClient.post<SimilarLocalProductsResult>(
      "/api/local-products/similar",
      { description, unit, topK },
      { headers: requireAuthHeaders() },
    ).then(({ data }) => {
      const result = {
        semanticAvailable: data.semanticAvailable !== false,
        items: Array.isArray(data.items) ? data.items : [],
      };
      if (result.semanticAvailable) {
        this.similarCache.set(cacheKey, {
          expiresAt: Date.now() + this.similarCacheTtlMs,
          result,
        });
      }
      return result;
    }).finally(() => {
      this.similarRequests.delete(cacheKey);
    });

    this.similarRequests.set(cacheKey, request);
    return request;
  }

  static async list(params?: ListLocalProductsParams): Promise<PaginatedLocalProducts> {
    const status = params?.status || "ALL";
    const includeInactive = status === "ALL" ? true : undefined;
    const isActive = status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined;

    const { data } = await coreHttpClient.get<LocalProductsListApiResponse>("/api/local-products", {
      headers: requireAuthHeaders(),
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        search: params?.search?.trim() || undefined,
        includeInactive,
        isActive,
      },
    });

    return {
      items: data.items || [],
      total: data.total || 0,
      page: data.page || 1,
      pageSize: data.pageSize || 20,
      totalPages: data.totalPages || 1,
      hasPrevPage: Boolean(data.hasPrevPage),
      hasNextPage: Boolean(data.hasNextPage),
    };
  }

  static async createBatchFromItems(
    items: LocalProductBatchItemInput[],
    defaultCurrency?: ErpProductCurrency
  ): Promise<LocalProductBatchResultItem[]> {
    if (items.length === 0) return [];

    const body: {
      items: LocalProductBatchItemInput[];
      defaultCurrency?: ErpProductCurrency;
    } = {
      items: items.map((item) => ({
        ...item,
        description: item.description.trim().toUpperCase(),
      })),
    };

    if (defaultCurrency) {
      body.defaultCurrency = defaultCurrency;
    }

    const { data } = await coreHttpClient.post<LocalProductsBatchApiResponse>(
      "/api/local-products/batch-from-items",
      body,
      {
        headers: requireAuthHeaders(),
      }
    );

    this.similarCache.clear();
    return Array.isArray(data.items) ? data.items : [];
  }

  static async updateById(productId: string, input: UpdateLocalProductInput): Promise<LocalProduct> {
    const { data } = await coreHttpClient.patch<LocalProduct>(
      `/api/local-products/${encodeURIComponent(productId)}`,
      input,
      {
        headers: requireAuthHeaders(),
      }
    );

    this.similarCache.clear();
    return data;
  }

  static async deleteById(productId: string): Promise<void> {
    await coreHttpClient.delete(`/api/local-products/${encodeURIComponent(productId)}`, {
      headers: requireAuthHeaders(),
    });
    this.similarCache.clear();
  }
}
