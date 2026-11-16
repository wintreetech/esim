import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { quoteOrder } from "./quote";
import type { CheckoutInput } from "@/lib/validators/checkout";
import { getPaymentProvider } from "@/lib/payments/provider";
import { track } from "@/lib/analytics";
import {
  requireResellPortalCredentials,
  requireOrderMode,
  resellPortalTestMode,
} from "@/lib/esim/config";
export async function startCheckout(input: CheckoutInput) {
  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.ORDER_ACCESS_SECRET ||
    process.env.ORDER_ACCESS_SECRET.length < 32 ||
    !process.env.RESEND_API_KEY
  )
    throw new HttpError(
      503,
      "Checkout is being configured. Please come back soon.",
    );
  requireResellPortalCredentials();
  requireOrderMode();
  const stripeTest = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY);
  const stripeLive = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY);
  if (
    (resellPortalTestMode() && !stripeTest) ||
    (!resellPortalTestMode() && !stripeLive)
  )
    throw new HttpError(503, "Checkout is temporarily unavailable.");
  const user = await getUser();
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        email: input.email,
        currency: input.currency,
        plans: [...input.planIds].sort(),
        coupon: input.coupon || null,
        topUp: input.topUpEsimId || null,
        userId: user?.id || null,
        supplierTestMode: resellPortalTestMode(),
        firstName: input.firstName || null,
        lastName: input.lastName || null,
      }),
    )
    .digest("hex");
  let order = await db().order.findUnique({
    where: { checkoutKey: input.idempotencyKey },
  });
  const payment = getPaymentProvider();
  if (order) {
    if (order.checkoutFingerprint !== fingerprint)
      throw new HttpError(
        409,
        "Checkout changed. Refresh your cart and try again.",
      );
    if (order.status !== "PENDING_PAYMENT")
      throw new HttpError(
        409,
        "This checkout is closed. Start a new checkout.",
      );
    if (order.checkoutSessionId) {
      const session = await payment.getCheckout(order.checkoutSessionId);
      if (!session.url)
        throw new HttpError(409, "Checkout expired. Please start again.");
      return { url: session.url };
    }
  }
  if (!order) {
    const q = await quoteOrder(input);
    try {
      order = await db().$transaction(async (tx) => {
        if (q.coupon) {
          const reserved = await tx.coupon.updateMany({
            where: {
              id: q.coupon.id,
              active: true,
              usedCount: q.coupon.usedCount,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            data: { usedCount: { increment: 1 } },
          });
          if (!reserved.count)
            throw new HttpError(
              409,
              "Coupon availability changed. Please try again.",
            );
        }
        return tx.order.create({
          data: {
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            userId: user?.id,
            status: "PENDING_PAYMENT",
            checkoutKey: input.idempotencyKey,
            checkoutFingerprint: fingerprint,
            supplierTestMode: resellPortalTestMode(),
            subtotal: q.subtotal,
            discount: q.discount,
            tax: q.tax,
            total: q.total,
            currency: q.currency,
            couponId: q.coupon?.id,
            items: {
              create: q.plans.map((p) => ({
                planId: p.id,
                name: p.name,
                destinationName: p.destination.name,
                dataAmountMB: p.dataAmountMB,
                dataLabel: p.dataLabel,
                validityDays: p.validityDays,
                unitPrice: q.items.find((i) => i.id === p.id)!.unitPrice,
                supplierPlanId: p.supplierPlanId,
                provider: p.provider,
              })),
            },
            ...(q.targetEsim
              ? {
                  topUp: {
                    create: {
                      esimId: q.targetEsim.id,
                      planId: q.plans[0].id,
                      reference: `topup:${input.idempotencyKey}`,
                    },
                  },
                }
              : {}),
          },
        });
      });
    } catch (error) {
      const duplicate = await db().order.findUnique({
        where: { checkoutKey: input.idempotencyKey },
      });
      if (!duplicate || duplicate.checkoutFingerprint !== fingerprint)
        throw error;
      order = duplicate;
    }
  }
  const session = await payment.createCheckout({
    orderId: order.id,
    email: order.email,
    amount: order.total,
    currency: order.currency,
    description: `${input.topUpEsimId ? "Travel eSIM top-up" : "Travel eSIM order"} · ${order.id.slice(-8).toUpperCase()}`,
    expiresAt: Math.floor(order.createdAt.getTime() / 1000) + 31 * 60,
  });
  await db().order.update({
    where: { id: order.id },
    data: { checkoutSessionId: session.id },
  });
  await track(input.topUpEsimId ? "topup_started" : "checkout_started", {
    orderId: order.id,
    currency: order.currency,
    total: order.total,
  });
  return { url: session.url };
}
