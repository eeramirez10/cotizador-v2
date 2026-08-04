import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type WarehouseAccessMode = "INHERIT" | "ADDITIVE" | "OVERRIDE";

export interface ErpWarehouse {
  id: string;
  code: string;
  name: string;
  companyCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchWarehouseAccess {
  branch: { id: string; code: string; name: string; isActive: boolean };
  warehouses: ErpWarehouse[];
}

export interface UserWarehouseAccess {
  user: { id: string; firstName: string; lastName: string; role: string; isActive: boolean };
  branch: { id: string; code: string; name: string };
  accessMode: WarehouseAccessMode;
  branchWarehouses: ErpWarehouse[];
  userWarehouses: ErpWarehouse[];
  effectiveWarehouses: ErpWarehouse[];
}

export interface UpsertErpWarehouseInput {
  code?: string;
  name: string;
  companyCode?: string | null;
  isActive?: boolean;
}

const headers = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) throw new Error("Sesion no valida. Inicia sesion nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

const mapError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error(fallback);
};

export class ErpWarehousesService {
  static async list(includeInactive = true): Promise<ErpWarehouse[]> {
    try {
      const { data } = await coreHttpClient.get<ErpWarehouse[]>("/api/erp-warehouses", {
        headers: headers(),
        params: { includeInactive },
      });
      return data || [];
    } catch (error) {
      throw mapError(error, "No se pudieron cargar los almacenes ERP.");
    }
  }

  static async create(input: UpsertErpWarehouseInput): Promise<ErpWarehouse> {
    try {
      const { data } = await coreHttpClient.post<ErpWarehouse>("/api/erp-warehouses", input, { headers: headers() });
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo crear el almacen ERP.");
    }
  }

  static async update(id: string, input: UpsertErpWarehouseInput): Promise<ErpWarehouse> {
    try {
      const { data } = await coreHttpClient.patch<ErpWarehouse>(
        `/api/erp-warehouses/${encodeURIComponent(id)}`,
        input,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo actualizar el almacen ERP.");
    }
  }

  static async getBranchAccess(branchId: string): Promise<BranchWarehouseAccess> {
    try {
      const { data } = await coreHttpClient.get<BranchWarehouseAccess>(
        `/api/erp-warehouses/branches/${encodeURIComponent(branchId)}`,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo consultar la configuracion de la sucursal.");
    }
  }

  static async replaceBranchAccess(branchId: string, warehouseCodes: string[]): Promise<BranchWarehouseAccess> {
    try {
      const { data } = await coreHttpClient.put<BranchWarehouseAccess>(
        `/api/erp-warehouses/branches/${encodeURIComponent(branchId)}`,
        { warehouseCodes },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo guardar la configuracion de la sucursal.");
    }
  }

  static async getUserAccess(userId: string): Promise<UserWarehouseAccess> {
    try {
      const { data } = await coreHttpClient.get<UserWarehouseAccess>(
        `/api/erp-warehouses/users/${encodeURIComponent(userId)}`,
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo consultar la configuracion del vendedor.");
    }
  }

  static async replaceUserAccess(
    userId: string,
    accessMode: WarehouseAccessMode,
    warehouseCodes: string[],
  ): Promise<UserWarehouseAccess> {
    try {
      const { data } = await coreHttpClient.put<UserWarehouseAccess>(
        `/api/erp-warehouses/users/${encodeURIComponent(userId)}`,
        { accessMode, warehouseCodes },
        { headers: headers() },
      );
      return data;
    } catch (error) {
      throw mapError(error, "No se pudo guardar la configuracion del vendedor.");
    }
  }
}
