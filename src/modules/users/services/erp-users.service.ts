import { envs } from "../../../config/envs";
import { getAuthToken } from "../../../store/auth/auth.store";
import { erpUsersHttpClient } from "./http/erp-users-http.client";

export interface ErpUserSummary {
  code: string;
  description: string;
}

interface ErpUsersApiResponse {
  items?: Array<{
    code?: unknown;
    description?: unknown;
  }>;
}

const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return `${value}`;
  return "";
};

const normalizeRows = (payload: unknown): ErpUserSummary[] => {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as ErpUsersApiResponse).items)
      ? (payload as ErpUsersApiResponse).items || []
      : [];

  return rows
    .map((row) => {
      const code = asText((row as { code?: unknown }).code);
      const description = asText((row as { description?: unknown }).description);

      if (!code || !description) return null;
      return { code, description };
    })
    .filter((item): item is ErpUserSummary => item !== null);
};

const buildAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
};

export class ErpUsersService {
  static async search(query: string, signal?: AbortSignal): Promise<ErpUserSummary[]> {
    const q = query.trim();
    if (!q) return [];

    const { data } = await erpUsersHttpClient.get<ErpUsersApiResponse>(envs.ERP_USERS_BASE_PATH, {
      signal,
      headers: buildAuthHeaders(),
      params: {
        q,
        by: "both",
        limit: 20,
      },
    });

    return normalizeRows(data);
  }
}
