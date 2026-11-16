export type Currency = "USD" | "INR";
export function exchangeRate() {
  const rate = Number(process.env.USD_INR_RATE ?? 84);
  if (!Number.isFinite(rate) || rate <= 0)
    throw new Error("Invalid exchange rate");
  return rate;
}
export function convertCents(
  usdCents: number,
  currency: Currency,
  rate: number,
) {
  return Math.round(usdCents * (currency === "INR" ? rate : 1));
}
export function formatMoney(cents: number, currency: Currency = "USD") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
