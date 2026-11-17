"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  type ExchangeRateSnapshot,
  currencies,
  usdOnlyRates,
} from "@/lib/currency";
import { useCart } from "@/lib/cart";

const CurrencyContext = createContext<ExchangeRateSnapshot>({
  base: "USD",
  rates: usdOnlyRates,
  checkedAt: null,
  rateDate: null,
  source: "Frankfurter",
  status: "unavailable",
});
export function CurrencyProvider({
  initial,
  children,
}: {
  initial: ExchangeRateSnapshot;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const currency = useCart((s) => s.currency);
  const setCurrency = useCart((s) => s.setCurrency);
  useEffect(() => {
    if (!currencies.includes(currency)) setCurrency("USD");
  }, [currency, setCurrency]);
  useEffect(() => {
    const controller = new AbortController();
    let lastAttempt = Date.now();
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      lastAttempt = Date.now();
      try {
        const response = await fetch("/api/exchange-rates", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok)
          setSnapshot((await response.json()) as ExchangeRateSnapshot);
      } catch {
        /* Keep verified display rates during a brief outage. */
      }
    };
    if (
      initial.status === "unavailable" ||
      !initial.checkedAt ||
      Date.now() - Date.parse(initial.checkedAt) >= 300_000
    )
      void refresh();
    const timer = setInterval(() => void refresh(), 300_000);
    const onFocus = () => {
      if (Date.now() - lastAttempt > 60_000) void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [initial.status, initial.checkedAt]);
  return (
    <CurrencyContext.Provider value={snapshot}>
      {children}
    </CurrencyContext.Provider>
  );
}
export const useExchangeRates = () => useContext(CurrencyContext);

export function CurrencyRateNote() {
  const snapshot = useExchangeRates();
  const timestamp = snapshot.checkedAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(new Date(snapshot.checkedAt))
    : null;
  return (
    <span className="currency-rate-note" role="status">
      <RefreshCw size={15} aria-hidden="true" />
      {timestamp
        ? `Reference rates · ${snapshot.rateDate} · checked ${timestamp} UTC${snapshot.status === "stale" ? " · reconnecting" : ""}`
        : "Currency conversion reconnecting · USD available"}
    </span>
  );
}
