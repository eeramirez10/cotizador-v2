import { envs } from "../../../config/envs";
import { erpHttpClient } from "./http/erp-http.client";

export class ErpProductsApi {
  private static ensureConfigured(): void {
    if (!envs.ERP_API_URL) {
      throw new Error("Falta configurar VITE_ERP_API_URL (o VITE_ERP_DEV/VITE_ERP_PROD).");
    }
  }

  static async getByEanAndBranch(ean: string, branchId: string, signal?: AbortSignal): Promise<unknown> {
    this.ensureConfigured();
    const safeEan = encodeURIComponent(ean);
    const safeBranch = encodeURIComponent(branchId);
    const path = `${envs.ERP_PRODUCTS_BASE_PATH}/by-ean/${safeEan}/branch/${safeBranch}`;
    const { data } = await erpHttpClient.get<unknown>(path, { signal });
    return data;
  }
}
