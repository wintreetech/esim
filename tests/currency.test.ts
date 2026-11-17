import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertCents, formatMoney, usdOnlyRates } from "@/lib/currency";
import { ExchangeRateService } from "@/lib/exchange-rates";

const rows = () => [
  { base: "USD", quote: "EUR", date: "2026-11-16", rate: 0.9 },
  { base: "USD", quote: "AUD", date: "2026-11-16", rate: 1.5 },
];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Frankfurter currency conversion", () => {
  it("fetches the documented v2 array and keeps the published date", async () => {
    const fetch = vi.fn(async () => json(rows()));
    vi.stubGlobal("fetch", fetch);
    const result = await new ExchangeRateService().latest();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,AUD",
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
    expect(result).toMatchObject({
      status: "current",
      base: "USD",
      source: "Frankfurter",
      rateDate: "2026-11-16",
      rates: { USD: 1, EUR: 0.9, AUD: 1.5 },
    });
  });
  it("deduplicates concurrent requests and refreshes after five minutes", async () => {
    const fetch = vi.fn(async () => json(rows()));
    vi.stubGlobal("fetch", fetch);
    const service = new ExchangeRateService();
    await Promise.all([service.latest(), service.latest(), service.latest()]);
    await service.latest();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-11-16T12:06:00Z"));
    await service.latest();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("retains the cached response's age instead of labeling old data as newly checked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(rows()), {
            headers: { Date: "Mon, 16 Nov 2026 11:40:00 GMT" },
          }),
      ),
    );
    expect(await new ExchangeRateService().latest()).toMatchObject({
      status: "stale",
      checkedAt: "2026-11-16T11:40:00.000Z",
    });
  });
  it("uses bounded, clearly stale display rates during an outage, then offers only USD", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(rows()))
      .mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const service = new ExchangeRateService();
    await service.latest();
    vi.setSystemTime(new Date("2026-11-16T12:06:00Z"));
    expect(await service.latest()).toMatchObject({
      status: "stale",
      rates: { EUR: 0.9 },
    });
    vi.setSystemTime(new Date("2026-11-16T13:01:00Z"));
    expect(await service.latest()).toMatchObject({
      status: "unavailable",
      rates: usdOnlyRates,
    });
  });
  it.each([
    () => rows().slice(0, 1),
    () => [rows()[0], rows()[0]],
    () => rows().map((r) => ({ ...r, base: "EUR" })),
    () => rows().map((r) => ({ ...r, rate: -1 })),
    () => rows().map((r) => ({ ...r, date: "2026-01-01" })),
  ])(
    "rejects invalid or incomplete rates without invented conversion values",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => json(body())),
      );
      expect(await new ExchangeRateService().latest()).toMatchObject({
        status: "unavailable",
        rates: usdOnlyRates,
        rateDate: null,
      });
    },
  );
  it("converts minor units once and distinguishes Australian dollars", () => {
    const rates = { USD: 1, EUR: 0.90395, AUD: 1.4727 };
    expect(convertCents(1000, "EUR", rates)).toBe(904);
    expect(convertCents(1000, "AUD", rates)).toBe(1473);
    expect(formatMoney(10000, "INR")).toContain("100.00");
    expect(formatMoney(1473, "AUD")).toBe("A$14.73");
    expect(formatMoney(904, "EUR")).toBe("€9.04");
    expect(() => convertCents(1000, "EUR", usdOnlyRates)).toThrow(
      "Exchange rate unavailable",
    );
  });
});
