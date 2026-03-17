import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { Client, ClientInput } from "../types/client.types";

interface ApiUserBrief {
  firstName?: string | null;
  lastName?: string | null;
}

interface ApiCustomer {
  id: string;
  source: "LOCAL" | "ERP";
  externalId?: string | null;
  externalSystem?: string | null;
  code?: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp: string;
  taxId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdByUser?: ApiUserBrief | null;
  updatedByUser?: ApiUserBrief | null;
}

interface ApiCustomersListResponse {
  items: ApiCustomer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

interface CustomerPayload {
  source?: "LOCAL" | "ERP";
  externalId?: string | null;
  externalSystem?: string | null;
  code?: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string;
  taxId: string | null;
  profileStatus: "PROSPECT" | "FISCAL_COMPLETED";
}

const toActorName = (user?: ApiUserBrief | null): string => {
  const first = user?.firstName?.trim() || "";
  const last = user?.lastName?.trim() || "";
  const fullName = `${first} ${last}`.trim();
  return fullName || "Sistema";
};

const mapApiCustomer = (raw: ApiCustomer): Client => {
  const fallbackCompanyName = raw.displayName || `${raw.firstName} ${raw.lastName}`.trim();

  return {
    id: raw.id,
    source: raw.source,
    externalId: raw.externalId ?? null,
    externalSystem: raw.externalSystem ?? null,
    code: raw.code ?? null,
    name: raw.firstName || "",
    lastname: raw.lastName || "",
    whatsappPhone: raw.whatsapp || "",
    email: raw.email || "",
    rfc: raw.taxId || "",
    companyName: raw.legalName || fallbackCompanyName,
    phone: raw.phone || "",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdByUserId: raw.createdByUserId ?? null,
    createdByName: toActorName(raw.createdByUser),
    updatedByUserId: raw.updatedByUserId ?? null,
    updatedByName: toActorName(raw.updatedByUser),
  };
};

const buildBasePayloadFromInput = (input: ClientInput): Omit<
  CustomerPayload,
  "source" | "externalId" | "externalSystem" | "code"
> => {
  const firstName = input.name.trim();
  const lastName = input.lastname.trim();
  const legalName = input.companyName.trim();
  const taxId = input.rfc.trim().toUpperCase();

  return {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    legalName: legalName || null,
    email: input.email.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsappPhone.trim(),
    taxId: taxId || null,
    profileStatus: legalName && taxId ? "FISCAL_COMPLETED" : "PROSPECT",
  };
};

const buildCreatePayloadFromInput = (input: ClientInput): CustomerPayload => {
  const source = input.source === "ERP" ? "ERP" : "LOCAL";
  const externalId = input.externalId?.trim() || null;
  const externalSystemRaw = input.externalSystem?.trim() || null;
  const externalSystem = source === "ERP" ? (externalSystemRaw || "ERP") : externalSystemRaw;

  return {
    ...buildBasePayloadFromInput(input),
    source,
    externalId,
    externalSystem,
    code: input.code?.trim() || null,
  };
};

const buildUpdatePayloadFromInput = (input: ClientInput): CustomerPayload => {
  const payload: CustomerPayload = {
    ...buildBasePayloadFromInput(input),
  };

  if (input.source) {
    const source = input.source === "ERP" ? "ERP" : "LOCAL";
    payload.source = source;
    payload.externalId = input.externalId?.trim() || null;
    payload.externalSystem = source === "ERP" ? input.externalSystem?.trim() || "ERP" : input.externalSystem?.trim() || null;
    payload.code = input.code?.trim() || null;
  }

  return payload;
};

const requireAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

export class CustomersService {
  static async list(params?: {
    search?: string;
    pageSize?: number;
    page?: number;
    source?: "LOCAL" | "ERP";
  }): Promise<Client[]> {
    const { data } = await coreHttpClient.get<ApiCustomersListResponse>("/api/customers", {
      headers: requireAuthHeaders(),
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 100,
        search: params?.search?.trim() || undefined,
        source: params?.source,
      },
    });

    return (data.items || []).map(mapApiCustomer);
  }

  static async create(input: ClientInput): Promise<Client> {
    const payload = buildCreatePayloadFromInput(input);
    const { data } = await coreHttpClient.post<ApiCustomer>("/api/customers", payload, {
      headers: requireAuthHeaders(),
    });

    return mapApiCustomer(data);
  }

  static async update(customerId: string, input: ClientInput): Promise<Client> {
    const payload = buildUpdatePayloadFromInput(input);
    const { data } = await coreHttpClient.patch<ApiCustomer>(`/api/customers/${customerId}`, payload, {
      headers: requireAuthHeaders(),
    });

    return mapApiCustomer(data);
  }

  static async remove(customerId: string): Promise<void> {
    await coreHttpClient.delete(`/api/customers/${customerId}`, {
      headers: requireAuthHeaders(),
    });
  }
}
