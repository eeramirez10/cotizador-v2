import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { Client, ClientInput } from "../types/client.types";
import type { CustomerContact, CustomerContactInput } from "../types/customer-contact.types";

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
  taxRegime?: string | null;
  billingStreet?: string | null;
  billingExteriorNumber?: string | null;
  billingInteriorNumber?: string | null;
  billingNeighborhood?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  profileStatus?: "PROSPECT" | "FISCAL_COMPLETED";
  isActive?: boolean;
  notes?: string | null;
  contacts?: ApiCustomerContact[];
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdByUser?: ApiUserBrief | null;
  updatedByUser?: ApiUserBrief | null;
}

interface ApiCustomerContact {
  id: string;
  customerId: string;
  name: string;
  jobTitle: string | null;
  label: string | null;
  email: string | null;
  phone: string | null;
  phoneExtension: string | null;
  mobile: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
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
  taxRegime?: string | null;
  billingStreet?: string | null;
  billingExteriorNumber?: string | null;
  billingInteriorNumber?: string | null;
  billingNeighborhood?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  notes?: string | null;
  contacts?: CustomerContactInput[];
}

const mapApiContact = (contact: ApiCustomerContact): CustomerContact => ({ ...contact });

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
    taxRegime: raw.taxRegime || "",
    billingStreet: raw.billingStreet || "",
    billingExteriorNumber: raw.billingExteriorNumber || "",
    billingInteriorNumber: raw.billingInteriorNumber || "",
    billingNeighborhood: raw.billingNeighborhood || "",
    billingCity: raw.billingCity || "",
    billingState: raw.billingState || "",
    billingPostalCode: raw.billingPostalCode || "",
    billingCountry: raw.billingCountry || "MÉXICO",
    profileStatus: raw.profileStatus || "PROSPECT",
    isActive: raw.isActive ?? true,
    notes: raw.notes || "",
    contacts: (raw.contacts || []).map(mapApiContact),
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
  const deliveryContact = input.contacts?.find((contact) => contact.isPrimary && (contact.email?.trim() || contact.mobile?.trim()))
    || input.contacts?.find((contact) => contact.email?.trim() || contact.mobile?.trim());

  return {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    legalName: legalName || null,
    email: deliveryContact?.email?.trim().toLowerCase() || input.email.trim().toLowerCase() || null,
    phone: deliveryContact?.phone?.trim() || input.phone?.trim() || null,
    whatsapp: deliveryContact?.mobile?.trim() || input.whatsappPhone.trim(),
    taxId: taxId || null,
    profileStatus: legalName && taxId ? "FISCAL_COMPLETED" : "PROSPECT",
    taxRegime: input.taxRegime?.trim() || null,
    billingStreet: input.billingStreet?.trim() || null,
    billingExteriorNumber: input.billingExteriorNumber?.trim() || null,
    billingInteriorNumber: input.billingInteriorNumber?.trim() || null,
    billingNeighborhood: input.billingNeighborhood?.trim() || null,
    billingCity: input.billingCity?.trim() || null,
    billingState: input.billingState?.trim() || null,
    billingPostalCode: input.billingPostalCode?.trim() || null,
    billingCountry: input.billingCountry?.trim() || null,
    notes: input.notes?.trim() || null,
    contacts: input.contacts?.map((contact) => ({
      name: contact.name.trim(),
      jobTitle: contact.jobTitle?.trim() || null,
      label: contact.label?.trim() || null,
      email: contact.email?.trim().toLowerCase() || null,
      phone: contact.phone?.trim() || null,
      phoneExtension: contact.phoneExtension?.trim() || null,
      mobile: contact.mobile?.trim() || null,
      isPrimary: Boolean(contact.isPrimary),
    })),
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
