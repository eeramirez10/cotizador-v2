import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import type { CustomerContact, CustomerContactInput } from "../types/customer-contact.types";

interface ApiCustomerContact {
  id: string;
  customerId: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiContactsListResponse {
  items: ApiCustomerContact[];
}

const requireAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sesión no válida. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const asTextOrNull = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mapApiContact = (row: ApiCustomerContact): CustomerContact => ({
  id: row.id,
  customerId: row.customerId,
  name: row.name,
  jobTitle: row.jobTitle,
  email: row.email,
  phone: row.phone,
  mobile: row.mobile,
  isPrimary: row.isPrimary,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPayload = (input: CustomerContactInput): CustomerContactInput => ({
  name: input.name.trim(),
  jobTitle: asTextOrNull(input.jobTitle ?? null),
  email: asTextOrNull(input.email ?? null),
  phone: asTextOrNull(input.phone ?? null),
  mobile: asTextOrNull(input.mobile ?? null),
  isPrimary: Boolean(input.isPrimary),
});

export class CustomerContactsService {
  static async list(customerId: string): Promise<CustomerContact[]> {
    const { data } = await coreHttpClient.get<ApiContactsListResponse>(`/api/customers/${customerId}/contacts`, {
      headers: requireAuthHeaders(),
    });

    return (data.items || []).map(mapApiContact);
  }

  static async create(customerId: string, input: CustomerContactInput): Promise<CustomerContact> {
    const { data } = await coreHttpClient.post<ApiCustomerContact>(
      `/api/customers/${customerId}/contacts`,
      toPayload(input),
      {
        headers: requireAuthHeaders(),
      }
    );

    return mapApiContact(data);
  }

  static async update(customerId: string, contactId: string, input: CustomerContactInput): Promise<CustomerContact> {
    const { data } = await coreHttpClient.patch<ApiCustomerContact>(
      `/api/customers/${customerId}/contacts/${contactId}`,
      toPayload(input),
      {
        headers: requireAuthHeaders(),
      }
    );

    return mapApiContact(data);
  }

  static async remove(customerId: string, contactId: string): Promise<void> {
    await coreHttpClient.delete(`/api/customers/${customerId}/contacts/${contactId}`, {
      headers: requireAuthHeaders(),
    });
  }
}

