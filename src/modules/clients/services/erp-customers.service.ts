import { envs } from "../../../config/envs";
import type { ErpCustomer } from "../types/erp-customer.types";
import { erpHttpClient } from "../../products/services/http/erp-http.client";

interface ErpCustomerRow {
  externalId?: unknown;
  id?: unknown;
  code?: unknown;
  customerCode?: unknown;
  displayName?: unknown;
  name?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  whatsapp?: unknown;
  whatsappPhone?: unknown;
  phone?: unknown;
  email?: unknown;
  taxId?: unknown;
  rfc?: unknown;
  companyName?: unknown;
  legalName?: unknown;
  isActive?: unknown;
  branchCode?: unknown;
  salesmanCode?: unknown;
  billingStreet?: unknown;
  billingCity?: unknown;
  billingState?: unknown;
  billingPostalCode?: unknown;
  billingCountry?: unknown;
  lastSyncedAt?: unknown;
}

const asText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return `${value}`;
  return "";
};

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
};

const splitDisplayName = (displayName: string): { firstName: string; lastName: string } => {
  const safe = displayName.trim();
  if (!safe) return { firstName: "", lastName: "" };

  const parts = safe.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "." };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const mapRow = (row: ErpCustomerRow): ErpCustomer | null => {
  const code = asText(row.code || row.customerCode);
  const externalId = asText(row.externalId || row.id || code);
  const displayName = asText(row.displayName || row.name || row.companyName || row.legalName);
  const split = splitDisplayName(displayName);
  const firstName = asText(row.firstName) || split.firstName;
  const lastName = asText(row.lastName) || split.lastName;
  const whatsapp = asText(row.whatsapp || row.whatsappPhone);
  const companyName = asText(row.companyName || row.legalName || displayName);

  if (!externalId || !displayName || !firstName || !lastName) {
    return null;
  }

  return {
    externalId,
    code,
    displayName,
    firstName,
    lastName,
    whatsapp,
    phone: asText(row.phone),
    email: asText(row.email).toLowerCase(),
    taxId: asText(row.taxId || row.rfc).toUpperCase(),
    companyName,
    isActive: asBoolean(row.isActive, true),
    source: "ERP",
    branchCode: asText(row.branchCode),
    salesmanCode: asText(row.salesmanCode),
    billingStreet: asText(row.billingStreet),
    billingCity: asText(row.billingCity),
    billingState: asText(row.billingState),
    billingPostalCode: asText(row.billingPostalCode),
    billingCountry: asText(row.billingCountry),
    lastSyncedAt: asText(row.lastSyncedAt),
  };
};

const normalizePayload = (payload: unknown): ErpCustomer[] => {
  const maybeItems =
    Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).items)
        ? ((payload as Record<string, unknown>).items as unknown[])
        : [];

  return maybeItems
    .map((item) => mapRow((item || {}) as ErpCustomerRow))
    .filter((item): item is ErpCustomer => item !== null);
};

export class ErpCustomersService {
  static async searchByTerm(term: string, signal?: AbortSignal): Promise<ErpCustomer[]> {
    if (!envs.ERP_API_URL) return [];

    const normalizedTerm = term.trim();

    if (!normalizedTerm) return [];

    const path = `${envs.ERP_CUSTOMERS_BASE_PATH}/search`;
    const { data } = await erpHttpClient.get<unknown>(path, {
      signal,
      params: {
        q: normalizedTerm,
        limit: 20,
      },
    });

    return normalizePayload(data);
  }
}
