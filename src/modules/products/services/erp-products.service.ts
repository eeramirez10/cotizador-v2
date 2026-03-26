import type { ErpProduct } from "../types/erp-product.types";
import { getBranchNameByCode, SUPPORTED_BRANCH_CODES } from "../../branches/branch.utils";
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
    const items = mapByEanPayload(payload, {
      branchCode: normalizedBranch,
      branchName: getBranchNameByCode(normalizedBranch),
    });

    this.searchCache.set(key, { loadedAt: Date.now(), items });
    return items;
  }

  static async searchByTermInAllBranches(
    term: string,
    userBranchCode: string,
    signal?: AbortSignal,
  ): Promise<ErpProduct[]> {
    const normalizedTerm = term.trim().toUpperCase();
    const normalizedUserBranch = userBranchCode.trim();

    if (!normalizedTerm) return [];

    const key = this.getCacheKey(normalizedTerm, "ALL");
    const cached = this.searchCache.get(key);

    if (cached && this.hasFreshCache(cached.loadedAt)) {
      return this.sortByUserBranch(cached.items, normalizedUserBranch);
    }

    const responses = await Promise.all(
      SUPPORTED_BRANCH_CODES.map(async (branchCode) => {
        try {
          const payload = await ErpProductsApi.searchByTermAndBranch(normalizedTerm, branchCode, signal);
          return mapByEanPayload(payload, {
            branchCode,
            branchName: getBranchNameByCode(branchCode),
          });
        } catch {
          return [] as ErpProduct[];
        }
      }),
    );

    const merged = responses.flat();
    const uniqueMap = new Map<string, ErpProduct>();
    for (const item of merged) {
      const uniqueKey = `${item.branchCode ?? ""}::${item.code}::${item.ean}`;
      if (uniqueMap.has(uniqueKey)) continue;
      uniqueMap.set(uniqueKey, item);
    }

    const items = Array.from(uniqueMap.values());
    this.searchCache.set(key, { loadedAt: Date.now(), items });

    return this.sortByUserBranch(items, normalizedUserBranch);
  }

  private static sortByUserBranch(items: ErpProduct[], userBranchCode: string): ErpProduct[] {
    return [...items].sort((a, b) => {
      const aSameBranch = a.branchCode === userBranchCode ? 1 : 0;
      const bSameBranch = b.branchCode === userBranchCode ? 1 : 0;
      if (aSameBranch !== bSameBranch) return bSameBranch - aSameBranch;

      const aBranch = a.branchCode ?? "";
      const bBranch = b.branchCode ?? "";
      if (aBranch !== bBranch) return aBranch.localeCompare(bBranch);

      return a.description.localeCompare(b.description);
    });
  }
}
