import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { quoteOrder } from "./quote";
import type { CheckoutInput } from "@/lib/validators/checkout";
import { getPaymentProvider } from "@/lib/payments/provider";
import { track } from "@/lib/analytics";
import { resellPortalTestMode } from "@/lib/esim/config";
import {
  paymentProviderName,
  requireCheckoutSetup,
} from "@/lib/payments/config";
import { requireTransactworldConfig } from "@/lib/payments/transactworld-config";
export async function startCheckout(input: CheckoutInput, shopperIp?: string) {
  requireCheckoutSetup();
  if (
    paymentProviderName() === "transactworld" &&
    !requireTransactworldConfig().supportedCurrencies.includes(input.currency)
  )
    throw new HttpError(
      400,
      `${input.currency} payments are unavailable. Choose ${requireTransactworldConfig().supportedCurrencies.join(" or ")}.`,
    );
  const user = await getUser();
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        email: input.email,
        currency: input.currency,
        expectedTotal: input.expectedTotal ?? null,
        plans: [...input.planIds].sort(),
        coupon: input.coupon || null,
        topUp: input.topUpEsimId || null,
        userId: user?.id || null,
        supplierTestMode: resellPortalTestMode(),
        paymentProvider: paymentProviderName(),
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        deviceModel: input.deviceCheck.model,
      }),
    )
    .digest("hex");
  let order = await db().order.findUnique({
    where: { checkoutKey: input.idempotencyKey },
  });
  const payment = getPaymentProvider();
  await payment.assertReady?.();
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
      const session = await payment.getCheckout(
        order.checkoutSessionId,
        shopperIp,
      );
      if (!session.url)
        throw new HttpError(409, "Checkout expired. Please start again.");
      return {
        url: session.url,
        method: session.method,
        fields: session.fields,
      };
    }
  }
  if (!order) {
    const q = await quoteOrder(input);
    if (
      (input.expectedTotal !== undefined && input.expectedTotal !== q.total) ||
      (input.currency !== "USD" && input.expectedTotal === undefined)
    )
      throw new HttpError(
        409,
        "Prices have updated. Please review the refreshed total before continuing.",
      );
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
            auditLogs: {
              create: [
                {
                  action: "DEVICE_CHECK_CONFIRMED",
                  detail: JSON.stringify({
                    ...input.deviceCheck,
                    source: "customer_self_report",
                  }),
                },
                ...(q.fx
                  ? [
                      {
                        action: "EXCHANGE_RATE_LOCKED",
                        detail: JSON.stringify({
                          currency: q.currency,
                          rate: q.rate,
                          rateDate: q.fx.rateDate,
                          checkedAt: q.fx.checkedAt,
                          source: q.fx.source,
                        }),
                      },
                    ]
                  : []),
              ],
            },
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
    shopperIp,
    firstName: order.firstName || undefined,
    lastName: order.lastName || undefined,
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
  return { url: session.url, method: session.method, fields: session.fields };
}
