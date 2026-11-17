"use client";
import { useCart } from "@/lib/cart";
import { convertCents, formatMoney } from "@/lib/currency";
import { useExchangeRates } from "./currency-provider";
export function Price({ cents }: { cents: number }) {
  const currency = useCart((s) => s.currency);
  const { rates } = useExchangeRates();
  if (!rates[currency])
    return (
      <span title="Currency conversion is temporarily unavailable">—</span>
    );
  return <>{formatMoney(convertCents(cents, currency, rates), currency)}</>;
}
