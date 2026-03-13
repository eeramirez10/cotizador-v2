import axios from "axios";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { User } from "../../../interfaces/user.interface";

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    branchId: string;
    branchName: string;
    branchCode?: string;
    branch?: {
      id?: string;
      name?: string;
      code?: string;
    };
  };
}

interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  branchId: string;
  branchName: string;
  branchCode?: string;
  branch?: {
    id?: string;
    name?: string;
    code?: string;
  };
}

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

const normalizeBranchCode = (value?: string): string | undefined => {
  if (!value) return undefined;
  const raw = value.trim().toUpperCase();
  if (!raw) return undefined;
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, "0");
  return raw;
};

const mapApiUser = (raw: LoginResponse["user"]): User => {
  const nowIso = new Date().toISOString();
  const branchName = raw.branchName || raw.branch?.name || "";
  const branchId = raw.branchId || raw.branch?.id || "";
  const branchCode = normalizeBranchCode(raw.branchCode || raw.branch?.code);

  return {
    id: raw.id,
    name: raw.firstName,
    lastname: raw.lastName,
    username: raw.email.split("@")[0],
    email: raw.email,
    phone: "",
    role: raw.role.toLowerCase(),
    isActive: raw.isActive,
    createdAt: nowIso,
    updatedAt: nowIso,
    branchId,
    erpBranchCode: branchCode,
    branch: {
      id: branchId,
      code: branchCode,
      name: toTitleCase(branchName),
      address: "",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
};

export class AuthService {
  static async login(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      const { data } = await coreHttpClient.post<LoginResponse>("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      return {
        token: data.accessToken,
        user: mapApiUser(data.user),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage = error.response?.data?.error;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          throw new Error(apiMessage);
        }
      }
      throw new Error("No fue posible iniciar sesión con el backend.");
    }
  }

  static async me(token: string): Promise<User> {
    try {
      const { data } = await coreHttpClient.get<MeResponse>("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return mapApiUser({
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        branchId: data.branchId,
        branchName: data.branchName,
        branchCode: data.branchCode,
        branch: data.branch,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage = error.response?.data?.error;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          throw new Error(apiMessage);
        }
      }
      throw new Error("Sesión inválida.");
    }
  }
}
