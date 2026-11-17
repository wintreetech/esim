import { describe, it, expect } from "vitest";
import { checkoutSchema } from "@/lib/validators/checkout";
import { confirmedDevice } from "./fixtures/device-check";
const valid = {
  email: "A@example.com",
  planIds: ["db-plan"],
  currency: "USD",
  idempotencyKey: "b4e668dd-d430-4cdf-b635-c3dacd027086",
  acceptedTerms: true,
  deviceCheck: confirmedDevice(),
};
describe("checkout boundary", () => {
  it("ignores a forged browser price", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      total: 1,
      price: 1,
      wholesalePrice: 0,
    });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("price");
    expect(parsed).not.toHaveProperty("wholesalePrice");
    expect(parsed.email).toBe("a@example.com");
  });
  it("rejects duplicate plans and unaccepted terms", () => {
    expect(() =>
      checkoutSchema.parse({ ...valid, planIds: ["p", "p"] }),
    ).toThrow();
    expect(() =>
      checkoutSchema.parse({ ...valid, acceptedTerms: false }),
    ).toThrow();
  });
  it("requires current affirmative device checks at the payment boundary", () => {
    for (const deviceCheck of [
      undefined,
      { ...confirmedDevice(), esim: "no" },
      { ...confirmedDevice(), unlocked: "unsure" },
      { ...confirmedDevice(), model: " " },
      {
        ...confirmedDevice(),
        checkedAt: new Date(Date.now() - 31 * 86400000).toISOString(),
      },
      {
        ...confirmedDevice(),
        checkedAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ])
      expect(checkoutSchema.safeParse({ ...valid, deviceCheck }).success).toBe(
        false,
      );
    expect(
      checkoutSchema.safeParse({ ...valid, deviceCheck: confirmedDevice() })
        .success,
    ).toBe(true);
  });
});
