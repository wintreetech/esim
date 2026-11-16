import { z } from "zod";
export const adminSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    id: z.string(),
    retailOverride: z.number().int().nonnegative().max(10000000).nullable(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("destination"),
    id: z.string(),
    active: z.boolean(),
  }),
  z.object({ action: z.literal("retry"), orderId: z.string() }),
  z.object({ action: z.literal("resend"), orderId: z.string() }),
  z.object({ action: z.literal("refund-marker"), orderId: z.string() }),
  z.object({ action: z.literal("sync") }),
  z.object({
    action: z.literal("reconcile-service"),
    orderItemId: z.string().min(1).max(150),
    serviceId: z
      .string()
      .regex(/^(?:\d+|test_svc_[a-zA-Z0-9_-]+)$/)
      .max(150),
  }),
  z.object({
    action: z.literal("authorize-supplier-retry"),
    orderItemId: z.string().min(1).max(150),
    confirmedNoPurchase: z.literal(true),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("coupon"),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    percentOff: z.number().int().min(0).max(100),
    fixedOff: z.number().int().min(0).max(100000),
    minSubtotal: z.number().int().min(0).max(10000000),
    maxUses: z.number().int().positive().max(1000000).nullable(),
    active: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
  }),
]);
