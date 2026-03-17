import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export interface BranchOption {
  id: string;
  code: string;
  name: string;
}

interface ApiBranch {
  id: string;
  code: string;
  name: string;
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

export class BranchesService {
  static async list(): Promise<BranchOption[]> {
    try {
      const { data } = await coreHttpClient.get<ApiBranch[]>("/api/branches", {
        headers: requireAuthHeaders(),
      });

      return (data || [])
        .map((item) => ({
          id: item.id,
          code: String(item.code || "").trim().toUpperCase(),
          name: item.name,
        }))
        .filter((item) => item.code.length > 0)
        .sort((a, b) => a.code.localeCompare(b.code));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error;
        if (typeof message === "string" && message.trim()) {
          throw new Error(message);
        }
      }
      throw new Error("No se pudieron cargar las sucursales.");
    }
  }
}
