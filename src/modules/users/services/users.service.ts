import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";

export type UserRole = "ADMIN" | "MANAGER" | "SELLER";

export interface ManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phone: string | null;
  erpUserCode: string | null;
  branch: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PaginatedUsers {
  items: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  branchCode?: string;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  branchCode: string;
  phone?: string | null;
  erpUserCode?: string | null;
}

export interface UpdateUserInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: UserRole;
  branchCode: string;
  phone?: string | null;
  erpUserCode?: string | null;
  password?: string;
}

interface ApiPaginatedUsersResponse {
  items: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

const normalizeRole = (role: string): UserRole => {
  const normalized = role.trim().toUpperCase();

  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "MANAGER") return "MANAGER";
  return "SELLER";
};

const mapApiUser = (raw: ManagedUser): ManagedUser => {
  return {
    ...raw,
    role: normalizeRole(raw.role),
    isActive: Boolean(raw.isActive),
  };
};

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

export class UsersService {
  static async list(params?: ListUsersParams): Promise<PaginatedUsers> {
    try {
      const { data } = await coreHttpClient.get<ApiPaginatedUsersResponse>("/api/users", {
        headers: requireAuthHeaders(),
        params: {
          page: params?.page ?? 1,
          pageSize: params?.pageSize ?? 20,
          search: params?.search?.trim() || undefined,
          branchCode: params?.branchCode?.trim() || undefined,
        },
      });

      return {
        items: (data.items || []).map(mapApiUser),
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.pageSize || 20,
        totalPages: data.totalPages || 1,
        hasPrevPage: Boolean(data.hasPrevPage),
        hasNextPage: Boolean(data.hasNextPage),
      };
    } catch (error) {
      throw mapAxiosError(error, "No se pudieron cargar los usuarios.");
    }
  }

  static async create(input: CreateUserInput): Promise<ManagedUser> {
    try {
      const { data } = await coreHttpClient.post<ManagedUser>(
        "/api/users",
        {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          username: input.username.trim().toLowerCase(),
          email: input.email.trim().toLowerCase(),
          password: input.password.trim(),
          role: input.role,
          branchCode: input.branchCode.trim().toUpperCase(),
          phone: input.phone?.trim() || null,
          erpUserCode: input.erpUserCode?.trim() || null,
        },
        {
          headers: requireAuthHeaders(),
        }
      );

      return mapApiUser(data);
    } catch (error) {
      throw mapAxiosError(error, "No se pudo crear el usuario.");
    }
  }

  static async update(userId: string, input: UpdateUserInput): Promise<ManagedUser> {
    try {
      const { data } = await coreHttpClient.patch<ManagedUser>(
        `/api/users/${encodeURIComponent(userId)}`,
        {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          username: input.username.trim().toLowerCase(),
          email: input.email.trim().toLowerCase(),
          role: input.role,
          branchCode: input.branchCode.trim().toUpperCase(),
          phone: input.phone?.trim() || null,
          erpUserCode: input.erpUserCode?.trim() || null,
          ...(input.password?.trim() ? { password: input.password.trim() } : {}),
        },
        {
          headers: requireAuthHeaders(),
        }
      );

      return mapApiUser(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404 || status === 405) {
          throw new Error("El endpoint para editar usuarios no esta disponible aun en backend.");
        }
      }
      throw mapAxiosError(error, "No se pudo actualizar el usuario.");
    }
  }

  static async deactivate(userId: string): Promise<void> {
    const headers = requireAuthHeaders();

    try {
      await coreHttpClient.patch(
        `/api/users/${encodeURIComponent(userId)}/deactivate`,
        {},
        {
          headers,
        }
      );
      return;
    } catch (firstError) {
      if (!axios.isAxiosError(firstError) || (firstError.response?.status !== 404 && firstError.response?.status !== 405)) {
        throw mapAxiosError(firstError, "No se pudo desactivar el usuario.");
      }
    }

    try {
      await coreHttpClient.patch(
        `/api/users/${encodeURIComponent(userId)}/status`,
        { isActive: false },
        {
          headers,
        }
      );
      return;
    } catch (secondError) {
      if (!axios.isAxiosError(secondError) || (secondError.response?.status !== 404 && secondError.response?.status !== 405)) {
        throw mapAxiosError(secondError, "No se pudo desactivar el usuario.");
      }
    }

    try {
      await coreHttpClient.delete(`/api/users/${encodeURIComponent(userId)}`, {
        headers,
      });
    } catch (thirdError) {
      if (axios.isAxiosError(thirdError)) {
        const status = thirdError.response?.status;
        if (status === 404 || status === 405) {
          throw new Error("El endpoint para desactivar usuarios no esta disponible aun en backend.");
        }
      }
      throw mapAxiosError(thirdError, "No se pudo desactivar el usuario.");
    }
  }
}
