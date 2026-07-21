import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export interface ManagedBranch {
  id: string;
  code: string;
  name: string;
  street: string | null;
  exteriorNumber: string | null;
  interiorNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  municipality: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  isActive: boolean;
}

export interface CreateBranchInput {
  code: string;
  name: string;
  street?: string | null;
  exteriorNumber?: string | null;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  municipality?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
}

export type UpdateBranchInput = CreateBranchInput;

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
  street: normalizeOptional(raw.street),
  exteriorNumber: normalizeOptional(raw.exteriorNumber),
  interiorNumber: normalizeOptional(raw.interiorNumber),
  neighborhood: normalizeOptional(raw.neighborhood),
  city: normalizeOptional(raw.city),
  municipality: normalizeOptional(raw.municipality),
  state: normalizeOptional(raw.state),
  postalCode: normalizeOptional(raw.postalCode),
  country: normalizeOptional(raw.country) || "México",
  email: normalizeOptional(raw.email),
  phone: normalizeOptional(raw.phone),
  secondaryPhone: normalizeOptional(raw.secondaryPhone),
  isActive: Boolean(raw.isActive),
});

const normalizeOptional = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const mapInput = (input: CreateBranchInput) => ({
  code: input.code.trim().toUpperCase(),
  name: input.name.trim(),
  street: normalizeOptional(input.street),
  exteriorNumber: normalizeOptional(input.exteriorNumber),
  interiorNumber: normalizeOptional(input.interiorNumber),
  neighborhood: normalizeOptional(input.neighborhood),
  city: normalizeOptional(input.city),
  municipality: normalizeOptional(input.municipality),
  state: normalizeOptional(input.state),
  postalCode: normalizeOptional(input.postalCode),
  country: normalizeOptional(input.country) || "México",
  email: normalizeOptional(input.email),
  phone: normalizeOptional(input.phone),
  secondaryPhone: normalizeOptional(input.secondaryPhone),
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
        mapInput(input),
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
        mapInput(input),
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
