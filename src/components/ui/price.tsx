"use client";
import { useCart } from "@/lib/cart";
import { convertCents, formatMoney } from "@/lib/currency";
export function Price({ cents, rate = 84 }: { cents: number; rate?: number }) {
  const currency = useCart((s) => s.currency);
  return <>{formatMoney(convertCents(cents, currency, rate), currency)}</>;
}
