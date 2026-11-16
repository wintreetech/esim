import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { quoteSchema } from "@/lib/validators/checkout";
import { calculatePrice, pricingConfig } from "@/lib/pricing/calculate-price";
import { convertCents, exchangeRate } from "@/lib/currency";
import { HttpError } from "@/lib/http";
import { accessibleEsim } from "@/lib/order-access";
import { providerName } from "@/lib/esim/config";
export async function quoteOrder(input: z.infer<typeof quoteSchema>) {
  const plans = await db().plan.findMany({
    where: {
      id: { in: input.planIds },
      active: true,
      destination: { active: true },
      provider: providerName(),
      syncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: { destination: true },
  });
  if (plans.length !== input.planIds.length)
    throw new HttpError(
      400,
      "A selected plan is no longer available. Please choose another plan.",
    );
  let targetEsim: Awaited<ReturnType<typeof accessibleEsim>> | null = null;
  if (input.topUpEsimId) {
    if (process.env.ENABLE_TOPUPS !== "true")
      throw new HttpError(400, "Top-ups are not enabled.");
    if (plans.length !== 1)
      throw new HttpError(400, "Choose one top-up package.");
    targetEsim = await accessibleEsim(input.topUpEsimId);
    if (
      !targetEsim.orderItem.plan.supportsTopup ||
      plans[0].destinationId !== targetEsim.orderItem.plan.destinationId ||
      plans[0].provider !== targetEsim.orderItem.provider ||
      !plans[0].supportsTopup
    )
      throw new HttpError(400, "This package cannot top up that eSIM.");
  }
  const coupon = input.coupon
    ? await db().coupon.findUnique({ where: { code: input.coupon } })
    : null;
  if (
    input.coupon &&
    (!coupon ||
      !coupon.active ||
      (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
      (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses))
  )
    throw new HttpError(400, "That coupon is unavailable or expired.");
  const config = pricingConfig();
  const base = plans.map((p) =>
    calculatePrice({
      wholesale: p.wholesalePrice,
      retailOverride: p.retailOverride ?? p.retailPrice,
      ...config,
      taxPercent: 0,
    }),
  );
  const subtotalUsd = base.reduce((n, p) => n + p.subtotal, 0);
  if (coupon && subtotalUsd < coupon.minSubtotal)
    throw new HttpError(
      400,
      "The selected plans do not meet this coupon's minimum spend.",
    );
  const floorUsd = plans.reduce(
    (n, p) => n + p.wholesalePrice + config.minMargin,
    0,
  );
  const discountUsd = Math.min(
    coupon
      ? Math.floor((subtotalUsd * coupon.percentOff) / 100) + coupon.fixedOff
      : 0,
    subtotalUsd - floorUsd,
  );
  const rate = exchangeRate(),
    convert = (v: number) => convertCents(v, input.currency, rate);
  const subtotal = convert(subtotalUsd),
    discount = convert(discountUsd),
    tax = Math.round(((subtotal - discount) * config.taxPercent) / 100),
    total = subtotal - discount + tax;
  if (total < 50 || total > 99_999_999)
    throw new HttpError(400, "This order amount is not supported.");
  return {
    plans,
    coupon,
    targetEsim,
    subtotal,
    discount,
    tax,
    total,
    currency: input.currency,
    rate,
    items: plans.map((p, i) => ({
      id: p.id,
      name: p.name,
      destinationName: p.destination.name,
      dataLabel: p.dataLabel,
      validityDays: p.validityDays,
      unitPrice: convert(base[i].subtotal),
    })),
  };
}
export function publicQuote(q: Awaited<ReturnType<typeof quoteOrder>>) {
  return {
    subtotal: q.subtotal,
    discount: q.discount,
    tax: q.tax,
    total: q.total,
    currency: q.currency,
    items: q.items,
  };
}
