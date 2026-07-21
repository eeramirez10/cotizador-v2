export type QuoteMoneyCurrency = "MXN" | "USD";

const safeExchangeRate = (exchangeRate: number): number => exchangeRate > 0 ? exchangeRate : 1;

export const convertQuoteAmount = (
  amount: number,
  sourceCurrency: QuoteMoneyCurrency,
  targetCurrency: QuoteMoneyCurrency,
  exchangeRate: number
): number => {
  if (sourceCurrency === targetCurrency) return amount;
  const rate = safeExchangeRate(exchangeRate);
  return sourceCurrency === "USD" ? amount * rate : amount / rate;
};

export const getErpCostDisplayAmount = (
  cost: number,
  productCurrency: QuoteMoneyCurrency,
  quoteCurrency: QuoteMoneyCurrency,
  exchangeRate: number
): number => {
  if (productCurrency === "USD") return cost;
  return quoteCurrency === "USD" ? convertQuoteAmount(cost, "MXN", "USD", exchangeRate) : cost;
};

export const getErpCostDisplayCurrency = (
  productCurrency: QuoteMoneyCurrency,
  quoteCurrency: QuoteMoneyCurrency
): QuoteMoneyCurrency => productCurrency === "USD" || quoteCurrency === "USD" ? "USD" : "MXN";
