import { describe, it, expect } from "vitest";
import { calculatePrice } from "@/lib/pricing/calculate-price";
describe("pricing in integer minor units", () => {
  it("applies percentage and fixed markup", () =>
    expect(
      calculatePrice({
        wholesale: 600,
        markupPercent: 40,
        fixedMarkup: 0,
        minMargin: 100,
      }).total,
    ).toBe(840));
  it("protects minimum margin after a coupon", () =>
    expect(
      calculatePrice({
        wholesale: 600,
        retailOverride: 1000,
        minMargin: 150,
        coupon: { percentOff: 90, fixedOff: 0 },
      }),
    ).toMatchObject({
      subtotal: 1000,
      discount: 250,
      total: 750,
      margin: 150,
    }));
  it("rejects an unsafe admin override", () =>
    expect(() =>
      calculatePrice({ wholesale: 600, retailOverride: 650, minMargin: 100 }),
    ).toThrow(/margin/));
  it("taxes the discounted price", () =>
    expect(
      calculatePrice({
        wholesale: 600,
        retailOverride: 1000,
        minMargin: 100,
        taxPercent: 10,
        coupon: { percentOff: 10 },
      }),
    ).toMatchObject({ discount: 100, tax: 90, total: 990 }));
  it("rejects invalid money and percentages", () => {
    expect(() => calculatePrice({ wholesale: -1 })).toThrow();
    expect(() =>
      calculatePrice({ wholesale: 1, markupPercent: NaN }),
    ).toThrow();
  });
});
