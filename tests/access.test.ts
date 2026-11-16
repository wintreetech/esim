import { describe, it, expect, vi } from "vitest";
import { createOrderToken, verifyOrderToken } from "@/lib/order-access";
vi.stubEnv(
  "ORDER_ACCESS_SECRET",
  "a-private-test-signing-key-with-at-least-32-characters",
);
describe("private guest-order tokens", () => {
  it("signs and verifies the correct order", () => {
    const token = createOrderToken("private-order", 1000000000);
    expect(verifyOrderToken(token, 1000000000)).toBe("private-order");
  });
  it("rejects expiry, tampering and malformed data", () => {
    const token = createOrderToken("private-order", 1000000000);
    expect(verifyOrderToken(token, 1000000000 + 8 * 86400000)).toBe(null);
    expect(verifyOrderToken(token.slice(0, -4) + "evil", 1000000000)).toBe(
      null,
    );
    expect(verifyOrderToken("bad.token.extra")).toBe(null);
  });
  it("creates unguessable links with unique nonces", () =>
    expect(createOrderToken("id")).not.toBe(createOrderToken("id")));
  it("can reproduce the exact email content on a retry", () => {
    const nonce = "a".repeat(43);
    expect(createOrderToken("id", 1000, nonce)).toBe(
      createOrderToken("id", 1000, nonce),
    );
  });
});
