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
  costCurrency: QuoteMoneyCurrency,
  quoteCurrency: QuoteMoneyCurrency,
  exchangeRate: number
): number => convertQuoteAmount(cost, costCurrency, quoteCurrency, exchangeRate);

export const getErpCostDisplayCurrency = (
  _costCurrency: QuoteMoneyCurrency,
  quoteCurrency: QuoteMoneyCurrency
): QuoteMoneyCurrency => quoteCurrency;
