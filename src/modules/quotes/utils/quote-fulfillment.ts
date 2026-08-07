import type { ErpProductCurrency } from "../../products/types/erp-product.types";
import type { QuoteCurrency } from "../../../store/quote/manual-quote.store";
import { convertQuoteAmount } from "./quote-currency";

interface FulfillmentInput {
  qty: number;
  stock: number;
  erpCode: string;
}

interface EffectiveCostInput extends FulfillmentInput {
  costUsd: number;
  costCurrency: ErpProductCurrency;
  sellerQuotedUnitCost: number | null;
  sellerQuotedCurrency: QuoteCurrency;
  sellerQuotedExchangeRate: number | null;
}

export interface QuoteItemFulfillment {
  requestedQty: number;
  stockQty: number;
  availableQty: number;
  purchaseQty: number;
  requiresPurchase: boolean;
}

export interface QuoteItemEffectiveCost extends QuoteItemFulfillment {
  erpUnitCost: number;
  supplierUnitCost: number | null;
  effectiveUnitCost: number;
}

const positive = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0;

export const getQuoteItemFulfillment = (item: FulfillmentInput): QuoteItemFulfillment => {
  const requestedQty = positive(item.qty);
  const hasErpProduct = Boolean(item.erpCode.trim());
  const stockQty = hasErpProduct ? positive(item.stock) : 0;
  const availableQty = hasErpProduct
    ? Math.min(requestedQty, stockQty)
    : 0;
  const purchaseQty = Math.max(0, requestedQty - availableQty);

  return {
    requestedQty,
    stockQty,
    availableQty,
    purchaseQty,
    requiresPurchase: purchaseQty > 0,
  };
};

export const getQuoteItemEffectiveCost = (
  item: EffectiveCostInput,
  quoteCurrency: QuoteCurrency,
  exchangeRate: number,
): QuoteItemEffectiveCost => {
  const fulfillment = getQuoteItemFulfillment(item);
  const erpUnitCost = positive(convertQuoteAmount(
    positive(item.costUsd),
    item.costCurrency,
    quoteCurrency,
    exchangeRate,
  ));
  const supplierUnitCost = item.sellerQuotedUnitCost !== null && item.sellerQuotedUnitCost > 0
    ? positive(convertQuoteAmount(
        item.sellerQuotedUnitCost,
        item.sellerQuotedCurrency,
        quoteCurrency,
        item.sellerQuotedExchangeRate || exchangeRate,
      ))
    : null;

  const effectiveUnitCost = fulfillment.requestedQty <= 0
    ? erpUnitCost
    : supplierUnitCost === null || fulfillment.purchaseQty <= 0
      ? erpUnitCost
      : (
          fulfillment.availableQty * erpUnitCost
          + fulfillment.purchaseQty * supplierUnitCost
        ) / fulfillment.requestedQty;

  return {
    ...fulfillment,
    erpUnitCost,
    supplierUnitCost,
    effectiveUnitCost,
  };
};
