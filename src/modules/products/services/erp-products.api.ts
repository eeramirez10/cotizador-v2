import { envs } from "../../../config/envs";
import { erpHttpClient } from "./http/erp-http.client";

export class ErpProductsApi {
  private static ensureConfigured(): void {
    if (!envs.ERP_API_URL) {
      throw new Error("Falta configurar VITE_ERP_API_URL (o VITE_ERP_DEV/VITE_ERP_PROD).");
    }
  }

  static async searchByTermAndBranch(term: string, branchId: string, signal?: AbortSignal): Promise<unknown> {
    this.ensureConfigured();
    const safeTerm = encodeURIComponent(term);
    const safeBranch = encodeURIComponent(branchId);
    const path = `${envs.ERP_PRODUCTS_BASE_PATH}/by-ean/${safeTerm}/branch/${safeBranch}`;
    const { data } = await erpHttpClient.get<unknown>(path, { signal });
    return data;
  }
}
