import type { ErpProduct } from "../types/erp-product.types";
import { ErpProductsApi } from "./erp-products.api";
import { mapByEanPayload } from "./mappers/erp-products.mapper";

const CACHE_TTL_MS = 60_000;

interface CachedSearch {
  loadedAt: number;
  items: ErpProduct[];
}

export class ErpProductsService {
  private static searchCache = new Map<string, CachedSearch>();

  private static getCacheKey(term: string, branchId: string): string {
    return `${branchId}::${term.toUpperCase()}`;
  }

  private static hasFreshCache(loadedAt: number): boolean {
    return Date.now() - loadedAt < CACHE_TTL_MS;
  }

  static async searchByTerm(term: string, branchId: string, signal?: AbortSignal): Promise<ErpProduct[]> {
    const normalizedTerm = term.trim().toUpperCase();
    const normalizedBranch = branchId.trim();

    if (!normalizedTerm || !normalizedBranch) return [];

    const key = this.getCacheKey(normalizedTerm, normalizedBranch);
    const cached = this.searchCache.get(key);

    if (cached && this.hasFreshCache(cached.loadedAt)) {
      return cached.items;
    }

    const payload = await ErpProductsApi.searchByTermAndBranch(normalizedTerm, normalizedBranch, signal);
    const items = mapByEanPayload(payload);

    this.searchCache.set(key, { loadedAt: Date.now(), items });
    return items;
  }
}
