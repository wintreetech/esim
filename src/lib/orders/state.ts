import type { OrderStatus } from "@/generated/prisma/client";
const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "FAILED"],
  PAID: ["PROVISIONING", "REFUNDED"],
  PROVISIONING: ["FULFILLED", "FAILED", "REFUNDED"],
  FULFILLED: ["REFUNDED"],
  FAILED: ["PAID", "PROVISIONING", "REFUNDED"],
  REFUNDED: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to);
}
