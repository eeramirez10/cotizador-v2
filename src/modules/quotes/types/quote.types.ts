export type Currency = "MXN" | "USD";

export interface QuoteCustomer {
  id?: string;
  name: string;
  lastname?: string;
  phone?: string;
  email?: string;
  location?: string;
  company?: string;
}

export interface QuoteLineSource {
  productKey?: string;
  warehouse?: string;
}

export interface QuoteLine {
  id: string;
  description: string;
  ean?: string;
  um?: string;
  qty: number;
  cost: number | null;
  currency: Currency;
  price: number | null;
  margin: number | null;
  source?: QuoteLineSource;
}

export interface QuoteMeta {
  pdfSentAt: string | null;
  quoteCreatedAt: string | null;
  versionCreatedAt: string | null;
  createdByUser: null;
}

export interface Quote {
  id: string;
  quoteNumber?: string;
  status: "DRAFT" | "FINAL" | "PENDING" | "BORRADOR" | "PENDIENTE" | "COTIZADA" | "CANCELADA";
  createdByName?: string;
  branch?: string;
  currency: Currency;
  taxRate: number;
  customer?: QuoteCustomer;
  items: QuoteLine[];
  createdAt: string;
  updatedAt: string;
  fileKey?: string | null;
  summary?: string;
  chatThreadId?: string;
  version: string;
  statusVersion: string;
  quoteMeta: QuoteMeta;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
