export type ErpProductCurrency = "MXN" | "USD";

export interface ErpProduct {
  code: string;
  ean: string;
  description: string;
  unit: string;
  costUsd: number;
  costCurrency: ErpProductCurrency;
  stock: number;
}
