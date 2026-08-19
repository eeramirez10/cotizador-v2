import type { CustomerContact, CustomerContactInput } from "./customer-contact.types";

export interface Client {
  id: string;
  source?: "LOCAL" | "ERP";
  externalId?: string | null;
  externalSystem?: string | null;
  code?: string | null;
  name: string;
  lastname: string;
  whatsappPhone: string;
  email: string;
  rfc: string;
  companyName: string;
  phone?: string;
  taxRegime?: string;
  billingStreet?: string;
  billingExteriorNumber?: string;
  billingInteriorNumber?: string;
  billingNeighborhood?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  profileStatus?: "PROSPECT" | "FISCAL_COMPLETED";
  isActive?: boolean;
  notes?: string;
  contacts?: CustomerContact[];
  selectedContactId?: string | null;
  selectedContactName?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string | null;
  createdByName?: string;
  updatedByUserId?: string | null;
  updatedByName?: string;
}

export interface ClientInput {
  source?: "LOCAL" | "ERP";
  externalId?: string | null;
  externalSystem?: string | null;
  code?: string | null;
  name: string;
  lastname: string;
  whatsappPhone: string;
  email: string;
  rfc: string;
  companyName: string;
  phone?: string;
  taxRegime?: string;
  billingStreet?: string;
  billingExteriorNumber?: string;
  billingInteriorNumber?: string;
  billingNeighborhood?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  profileStatus?: "PROSPECT" | "FISCAL_COMPLETED";
  notes?: string;
  contacts?: CustomerContactInput[];
}

export interface ClientActor {
  userId: string | null;
  fullName: string;
}
