import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export interface SystemCapabilities {
  quoteInternalApprovalEnabled: boolean;
  requisitionInternalApprovalEnabled: boolean;
  sellerExcelImportEnabled: boolean;
}

export class SystemCapabilitiesService {
  static async get(): Promise<SystemCapabilities> {
    const token = getAuthToken();
    if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente.");

    const response = await coreHttpClient.get<SystemCapabilities>("/api/system/capabilities", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
}
