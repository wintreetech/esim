import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/orders/state";
describe("order state machine", () => {
  it("requires payment before provisioning", () => {
    expect(canTransition("PENDING_PAYMENT", "PROVISIONING")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("PAID", "PROVISIONING")).toBe(true);
    expect(canTransition("PROVISIONING", "FULFILLED")).toBe(true);
  });
  it("allows failed paid orders to retry and fulfilled orders to refund", () => {
    expect(canTransition("FAILED", "PROVISIONING")).toBe(true);
    expect(canTransition("FULFILLED", "REFUNDED")).toBe(true);
    expect(canTransition("REFUNDED", "PROVISIONING")).toBe(false);
  });
});
