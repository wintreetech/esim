export const currencies = ["USD", "EUR", "AUD"] as const;
export type Currency = (typeof currencies)[number];
export type CurrencyRates = Record<Currency, number | null>;
export type ExchangeRateSnapshot = {
  base: "USD";
  rates: CurrencyRates;
  checkedAt: string | null;
  source: "Frankfurter";
  rateDate: string | null;
  status: "current" | "stale" | "unavailable";
};
export const usdOnlyRates: CurrencyRates = {
  USD: 1,
  EUR: null,
  AUD: null,
};
export function convertCents(
  usdCents: number,
  currency: Currency,
  rates: CurrencyRates,
) {
  const rate = rates[currency];
  if (!Number.isFinite(rate) || rate === null || rate <= 0)
    throw new Error("Exchange rate unavailable");
  return Math.round(usdCents * rate);
}
// Historic INR orders must remain readable, although INR is no longer offered.
export function formatMoney(cents: number, currency: Currency | "INR" = "USD") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
