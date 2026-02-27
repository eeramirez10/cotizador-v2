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

  private static getCacheKey(ean: string, branchId: string): string {
    return `${branchId}::${ean.toUpperCase()}`;
  }

  private static hasFreshCache(loadedAt: number): boolean {
    return Date.now() - loadedAt < CACHE_TTL_MS;
  }

  static async searchByEan(ean: string, branchId: string, signal?: AbortSignal): Promise<ErpProduct[]> {
    const normalizedEan = ean.trim().toUpperCase();
    const normalizedBranch = branchId.trim();

    if (!normalizedEan || !normalizedBranch) return [];

    const key = this.getCacheKey(normalizedEan, normalizedBranch);
    const cached = this.searchCache.get(key);

    if (cached && this.hasFreshCache(cached.loadedAt)) {
      return cached.items;
    }

    const payload = await ErpProductsApi.getByEanAndBranch(normalizedEan, normalizedBranch, signal);
    const items = mapByEanPayload(payload);

    this.searchCache.set(key, { loadedAt: Date.now(), items });
    return items;
  }
}
