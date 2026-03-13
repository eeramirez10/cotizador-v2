export interface ErpCustomer {
  externalId: string;
  code: string;
  displayName: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  phone: string;
  email: string;
  taxId: string;
  companyName: string;
  isActive: boolean;
  source: "ERP";
  branchCode?: string;
  salesmanCode?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  lastSyncedAt?: string;
}
