import "server-only";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { ConfirmedPayment } from "@/lib/payments/types";
import { track } from "@/lib/analytics";
export async function confirmPayment(payment: ConfirmedPayment) {
  // Event receipt, money record, state transition and durable outbox are one transaction.
  // The unique event / transaction / order indexes also protect concurrent deliveries.
  try {
    const result = await db().$transaction(async (tx) => {
      // Serialize payment/refund events for the same external transaction, including
      // when the refund arrives first. The lock is released with this DB transaction.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.transactionId})::bigint)`;
      if (await tx.webhookEvent.findUnique({ where: { id: payment.eventId } }))
        return { duplicate: true };
      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        include: { payment: true },
      });
      if (
        !order ||
        order.total !== payment.amount ||
        order.currency !== payment.currency.toUpperCase() ||
        (order.checkoutSessionId?.startsWith("tw_")
          ? "transactworld"
          : "stripe") !== (payment.provider || "stripe") ||
        (order.checkoutSessionId &&
          order.checkoutSessionId !== payment.sessionId)
      )
        throw new HttpError(400, "Payment does not match the order.");
      if (order.payment) {
        if (order.payment.transactionId !== payment.transactionId)
          throw new HttpError(409, "Payment reference mismatch.");
        await tx.webhookEvent.create({
          data: { id: payment.eventId, type: payment.eventType },
        });
        return { duplicate: true };
      }
      if (!["PENDING_PAYMENT", "FAILED"].includes(order.status))
        throw new HttpError(
          409,
          "Order cannot accept this payment. Manual review required.",
        );
      const reversal = await tx.paymentReversal.findUnique({
        where: { transactionId: payment.transactionId },
      });
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: reversal ? "REFUNDED" : "PAID",
          ...(payment.provider === "transactworld"
            ? {}
            : { stripePaymentIntentId: payment.transactionId }),
          checkoutSessionId: payment.sessionId,
        },
      });
      if (!changed.count)
        throw new HttpError(409, "Payment processing is already in progress.");
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: payment.provider || "stripe",
          transactionId: payment.transactionId,
          amount: payment.amount,
          currency: order.currency,
          status: reversal ? "REFUNDED" : "PAID",
        },
      });
      if (order.status === "FAILED" && order.couponId)
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { increment: 1 } },
        });
      if (!reversal)
        await tx.fulfillmentJob.upsert({
          where: { orderId_kind: { orderId: order.id, kind: "PROVISION" } },
          create: { orderId: order.id, kind: "PROVISION" },
          update: {},
        });
      await tx.auditLog.create({
        data: {
          orderId: order.id,
          action: reversal
            ? "PAYMENT_RECEIVED_ALREADY_REFUNDED"
            : order.status === "FAILED"
              ? "LATE_PAYMENT_RECOVERED"
              : "PAYMENT_CONFIRMED",
        },
      });
      await tx.webhookEvent.create({
        data: { id: payment.eventId, type: payment.eventType },
      });
      return { duplicate: false };
    });
    if (!result.duplicate)
      await track("payment_completed", {
        orderId: payment.orderId,
        total: payment.amount,
        currency: payment.currency,
      });
    return result;
  } catch (error) {
    if (await db().webhookEvent.findUnique({ where: { id: payment.eventId } }))
      return { duplicate: true };
    throw error;
  }
}
export async function expireCheckout(sessionId: string) {
  await db().$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { checkoutSessionId: sessionId },
    });
    if (!order) return;
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "FAILED" },
    });
    if (changed.count && order.couponId)
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });
  });
}
export async function recordRefund(
  transactionId: string,
  eventId: string,
  provider = "stripe",
) {
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${transactionId})::bigint)`;
    if (await tx.webhookEvent.findUnique({ where: { id: eventId } })) return;
    await tx.paymentReversal.upsert({
      where: { transactionId },
      create: { transactionId, eventId },
      update: {},
    });
    const payment = await tx.payment.findUnique({ where: { transactionId } });
    if (!payment) {
      await tx.webhookEvent.create({
        data: { id: eventId, type: `${provider}.refunded` },
      });
      return;
    }
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "REFUNDED" },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });
    await tx.fulfillmentJob.updateMany({
      where: {
        orderId: payment.orderId,
        kind: "PROVISION",
        status: { in: ["PENDING", "FAILED"] },
      },
      data: { status: "DONE" },
    });
    await tx.auditLog.create({
      data: {
        orderId: payment.orderId,
        action: `${provider.toUpperCase()}_FULL_REFUND_CONFIRMED`,
        detail:
          "If an eSIM was already issued or provisioning was in flight, reconcile with supplier.",
      },
    });
    await tx.webhookEvent.create({
      data: { id: eventId, type: `${provider}.refunded` },
    });
  });
}
