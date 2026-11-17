import "server-only";
import { z } from "zod";
import { type ExchangeRateSnapshot, usdOnlyRates } from "./currency";

const refreshMs = 5 * 60 * 1000;
const maxStaleMs = 60 * 60 * 1000;
const rate = z.coerce.number().finite().positive().max(100_000);
const responseSchema = z
  .array(
    z.object({
      base: z.literal("USD"),
      quote: z.enum(["EUR", "AUD"]),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rate,
    }),
  )
  .length(2)
  .refine((rows) => new Set(rows.map((r) => r.quote)).size === 2);

export class ExchangeRateService {
  private cached?: ExchangeRateSnapshot;
  private pending?: Promise<ExchangeRateSnapshot>;

  async latest(): Promise<ExchangeRateSnapshot> {
    if (
      this.cached?.checkedAt &&
      Date.now() - Date.parse(this.cached.checkedAt) < refreshMs
    )
      return this.cached;
    if (this.pending) return this.pending;
    this.pending = this.load().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async load(): Promise<ExchangeRateSnapshot> {
    try {
      const response = await fetch(
        "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,AUD",
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: refreshMs / 1000 },
        },
      );
      if (!response.ok) throw new Error("Exchange rates unavailable");
      const raw = await response.text();
      if (raw.length > 128_000)
        throw new Error("Unexpected exchange rate response");
      const rows = responseSchema.parse(JSON.parse(raw));
      for (const row of rows) {
        const publishedAt = Date.parse(`${row.date}T00:00:00Z`);
        if (
          !Number.isFinite(publishedAt) ||
          publishedAt > Date.now() + 24 * 60 * 60 * 1000 ||
          Date.now() - publishedAt > 10 * 24 * 60 * 60 * 1000
        )
          throw new Error("Published exchange rates are out of date");
      }
      const serverDate = Date.parse(response.headers.get("date") || "");
      const checked = Number.isFinite(serverDate) ? serverDate : Date.now();
      if (checked > Date.now() + refreshMs || Date.now() - checked > maxStaleMs)
        throw new Error("Exchange rate response is out of date");
      this.cached = {
        base: "USD",
        rates: {
          ...usdOnlyRates,
          ...Object.fromEntries(rows.map((r) => [r.quote, r.rate])),
        },
        checkedAt: new Date(checked).toISOString(),
        rateDate: rows.map((r) => r.date).sort()[0],
        source: "Frankfurter",
        status: Date.now() - checked < refreshMs * 2 ? "current" : "stale",
      };
      return this.cached;
    } catch {
      if (
        this.cached?.checkedAt &&
        Date.now() - Date.parse(this.cached.checkedAt) <= maxStaleMs
      )
        return { ...this.cached, status: "stale" };
      return {
        base: "USD",
        rates: { ...usdOnlyRates },
        checkedAt: null,
        rateDate: null,
        source: "Frankfurter",
        status: "unavailable",
      };
    }
  }
}

const service = new ExchangeRateService();
export const getExchangeRates = () => service.latest();
