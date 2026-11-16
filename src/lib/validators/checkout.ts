import { z } from "zod";
export const quoteSchema = z.object({
  planIds: z
    .array(z.string().min(1).max(150))
    .min(1)
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate plans"),
  currency: z.enum(["USD", "INR"]),
  coupon: z.string().trim().toUpperCase().max(40).optional(),
  topUpEsimId: z.string().max(150).optional(),
});
export const checkoutSchema = quoteSchema.extend({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  idempotencyKey: z.uuid(),
  acceptedTerms: z.literal(true),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
