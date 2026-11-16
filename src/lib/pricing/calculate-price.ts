import { z } from "zod";
const money = z.number().int().nonnegative().max(100_000_000);
const schema = z.object({
  wholesale: money,
  markupPercent: z.number().min(0).max(1000).default(40),
  fixedMarkup: money.default(50),
  minMargin: money.default(100),
  retailOverride: money.nullish(),
  taxPercent: z.number().min(0).max(100).default(0),
  coupon: z
    .object({
      percentOff: z.number().min(0).max(100).default(0),
      fixedOff: money.default(0),
    })
    .optional(),
});
export type PricingInput = z.input<typeof schema>;
export function calculatePrice(input: PricingInput) {
  const p = schema.parse(input);
  const floor = p.wholesale + p.minMargin;
  if (p.retailOverride != null && p.retailOverride < floor)
    throw new Error("Retail override violates minimum margin");
  const subtotal = Math.max(
    floor,
    p.retailOverride ??
      Math.ceil(p.wholesale * (1 + p.markupPercent / 100)) + p.fixedMarkup,
  );
  const requested = p.coupon
    ? Math.floor((subtotal * p.coupon.percentOff) / 100) + p.coupon.fixedOff
    : 0;
  const discount = Math.min(requested, subtotal - floor);
  const tax = Math.round(((subtotal - discount) * p.taxPercent) / 100);
  return {
    subtotal,
    discount,
    tax,
    total: subtotal - discount + tax,
    margin: subtotal - discount - p.wholesale,
  };
}
export function pricingConfig() {
  return {
    markupPercent: Number(process.env.MARKUP_PERCENT ?? 40),
    fixedMarkup: Number(process.env.FIXED_MARKUP_CENTS ?? 50),
    minMargin: Number(process.env.MIN_MARGIN_CENTS ?? 100),
    taxPercent: Number(process.env.TAX_PERCENT ?? 0),
  };
}
