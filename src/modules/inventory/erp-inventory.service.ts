import axios from "axios";
import { getAuthToken } from "../../store/auth/auth.store";
import { coreHttpClient } from "../core/services/http/core-http.client";

export type InventorySort = "code" | "ean" | "description" | "unit" | "warehouseCode" | "stock";
export interface InventoryFilters {
  query: string;
  warehouseCode: string;
  stock: "all" | "positive" | "zero" | "negative";
  page: number;
  pageSize: number;
  sortBy: InventorySort;
  sortDirection: "asc" | "desc";
}
export interface InventoryItem {
  id: string;
  code: string;
  ean: string;
  description: string;
  unit: string;
  warehouseCode: string | null;
  warehouseName: string;
  stock: number | null;
}
export interface InventoryPage {
  items: InventoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  fetchedAt: string;
}
export interface InventoryWarehouse { code: string; name: string }
export interface InventorySettings {
  warehouseCodes: string[] | null;
  warehouses: InventoryWarehouse[];
}

export const normalizeInventorySearch = (value: string): string => value.normalize("NFC").trim().toUpperCase();

function authHeaders() {
  const token = getAuthToken();
  if (!token) throw new Error("Inicia sesión nuevamente para consultar el inventario.");
  return { Authorization: `Bearer ${token}` };
}

function rethrow(error: unknown, fallback: string): never {
  if (axios.isCancel(error)) throw error;
  const message = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
  throw new Error(typeof message === "string" ? message : fallback);
}

async function get<T>(path: string, signal?: AbortSignal, params?: InventoryFilters): Promise<T> {
  const headers = authHeaders();
  try {
    const { data } = await coreHttpClient.get<T>(`/api/inventory/erp${path}`, {
      params, signal, headers,
    });
    return data;
  } catch (error) {
    rethrow(error, "No se pudo consultar el inventario ERP. Intenta nuevamente.");
  }
}

export const ErpInventoryService = {
  list: (filters: InventoryFilters, signal?: AbortSignal) => get<InventoryPage>("", signal, {
    ...filters, query: normalizeInventorySearch(filters.query),
  }),
  warehouses: (signal?: AbortSignal) => get<InventoryWarehouse[]>("/warehouses", signal),
  settings: (signal?: AbortSignal) => get<InventorySettings>("/settings", signal),
  saveSettings: async (warehouseCodes: string[] | null): Promise<InventorySettings> => {
    const headers = authHeaders();
    try {
      const { data } = await coreHttpClient.put<InventorySettings>("/api/inventory/erp/settings", { warehouseCodes }, { headers });
      return data;
    } catch (error) {
      rethrow(error, "No se pudo guardar la configuración de inventario ERP.");
    }
  },
};
