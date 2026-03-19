import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export interface ManagedBranch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export interface CreateBranchInput {
  code: string;
  name: string;
  address?: string | null;
}

export interface UpdateBranchInput {
  code: string;
  name: string;
  address?: string | null;
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

const mapAxiosError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }

  return new Error(fallback);
};

const mapApiBranch = (raw: ManagedBranch): ManagedBranch => ({
  id: raw.id,
  code: String(raw.code || "").trim().toUpperCase(),
  name: String(raw.name || "").trim(),
  address: typeof raw.address === "string" && raw.address.trim().length > 0 ? raw.address.trim() : null,
  isActive: Boolean(raw.isActive),
});

export class BranchesService {
  static async list(): Promise<ManagedBranch[]> {
    try {
      const { data } = await coreHttpClient.get<ManagedBranch[]>("/api/branches", {
        headers: requireAuthHeaders(),
      });

      return (data || [])
        .map(mapApiBranch)
        .filter((item) => item.code.length > 0)
        .sort((a, b) => a.code.localeCompare(b.code));
    } catch (error) {
      throw mapAxiosError(error, "No se pudieron cargar las sucursales.");
    }
  }

  static async create(input: CreateBranchInput): Promise<ManagedBranch> {
    try {
      const { data } = await coreHttpClient.post<ManagedBranch>(
        "/api/branches",
        {
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          address: input.address?.trim() || null,
        },
        {
          headers: requireAuthHeaders(),
        }
      );

      return mapApiBranch(data);
    } catch (error) {
      throw mapAxiosError(error, "No se pudo crear la sucursal.");
    }
  }

  static async update(branchId: string, input: UpdateBranchInput): Promise<ManagedBranch> {
    try {
      const { data } = await coreHttpClient.patch<ManagedBranch>(
        `/api/branches/${encodeURIComponent(branchId)}`,
        {
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          address: input.address?.trim() || null,
        },
        {
          headers: requireAuthHeaders(),
        }
      );

      return mapApiBranch(data);
    } catch (error) {
      throw mapAxiosError(error, "No se pudo actualizar la sucursal.");
    }
  }

  static async deactivate(branchId: string): Promise<void> {
    try {
      await coreHttpClient.patch(
        `/api/branches/${encodeURIComponent(branchId)}/deactivate`,
        {},
        {
          headers: requireAuthHeaders(),
        }
      );
    } catch (error) {
      throw mapAxiosError(error, "No se pudo desactivar la sucursal.");
    }
  }
}
