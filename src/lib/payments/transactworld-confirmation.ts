import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { HttpError, readBody } from "@/lib/http";
import { resellPortalTestMode } from "@/lib/esim/config";
import {
  confirmPayment,
  recordRefund,
} from "@/lib/orders/payment-confirmation";
import {
  decimalCents,
  inquirePayment,
  sessionId,
  sessionReference,
  verifyGatewayCallback,
  type Inquiry,
} from "./transactworld";
import { requireTransactworldConfig } from "./transactworld-config";

export async function reconcileTransactworld(
  id: string,
  inquiry: Inquiry = inquirePayment,
  expectedPaymentId?: string,
) {
  const c = requireTransactworldConfig();
  const ref = sessionReference(id, c);
  const order = await db().order.findUnique({
    where: { checkoutSessionId: id },
    include: { payment: true },
  });
  if (!order) throw new HttpError(404, "Payment order not found.");
  if (
    order.supplierTestMode !== (c.environment === "sandbox") ||
    order.supplierTestMode !== resellPortalTestMode()
  )
    throw new HttpError(
      409,
      "The payment and supplier environments do not match this order.",
    );
  const knownId =
    expectedPaymentId ||
    order.payment?.transactionId.replace(/^transactworld:/, "");
  const remote = await inquiry(knownId || ref, knownId ? "PID" : "MID", c);
  if (
    remote.merchantTransactionId !== ref ||
    (knownId && remote.paymentId !== knownId) ||
    decimalCents(remote.amount) !== order.total ||
    remote.currency !== order.currency ||
    !/^\d{1,32}$/.test(remote.paymentId)
  )
    throw new HttpError(400, "The verified payment does not match the order.");
  const transactionId = `transactworld:${remote.paymentId}`;
  const refund = decimalCents(remote.refundamount || "0.00");
  const chargeback = decimalCents(remote.chargebackamount || "0.00");
  if (refund > order.total || chargeback > order.total)
    throw new HttpError(400, "Invalid verified refund amount.");
  if (refund + chargeback >= order.total) {
    await recordRefund(
      transactionId,
      `tw:refund:${c.environment}:${remote.paymentId}`,
      "transactworld",
    );
    await confirmPayment({
      provider: "transactworld",
      eventId: `tw:refunded-payment:${c.environment}:${remote.paymentId}`,
      eventType: "transactworld.refunded",
      orderId: order.id,
      sessionId: id,
      transactionId,
      amount: order.total,
      currency: order.currency,
    });
    return { paid: false, refunded: true };
  }
  if (refund || chargeback || /refund|chargeback/i.test(remote.status))
    throw new HttpError(
      409,
      "This payment needs review in the merchant dashboard.",
    );
  if (remote.status !== "capturesuccess" || remote.transactionStatus !== "Y") {
    await db().order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { updatedAt: new Date() },
    });
    return { paid: false, refunded: false };
  }
  await confirmPayment({
    provider: "transactworld",
    eventId: `tw:capture:${c.environment}:${remote.paymentId}`,
    eventType: "transactworld.capture",
    orderId: order.id,
    sessionId: id,
    transactionId,
    amount: order.total,
    currency: order.currency,
  });
  return { paid: true, refunded: false };
}

export async function processTransactworldCallback(
  request: Request,
  ref: string,
  kind: "return" | "notify",
) {
  const raw = await readBody(request, 16384);
  let body: unknown;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid payment callback.");
    }
  } else {
    const parameters = new URLSearchParams(raw);
    const entries = [...parameters.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length)
      throw new HttpError(400, "Duplicate payment callback fields.");
    body = Object.fromEntries(entries);
  }
  const c = requireTransactworldConfig();
  const data = verifyGatewayCallback(body, ref, kind, c);
  const id = sessionId(ref, c);
  const order = await db().order.findUnique({
    where: { checkoutSessionId: id },
  });
  if (
    !order ||
    decimalCents(data.amount) !== order.total ||
    (data.currency && data.currency !== order.currency)
  )
    throw new HttpError(400, "Payment does not match the order.");
  // Save only safe event fields. This receipt does not mark an order paid.
  const eventId = `tw:callback:${createHash("sha256").update([kind, id, data.paymentId, data.amount, data.signedStatus, data.checksum].join("|")).digest("hex")}`;
  await db().webhookEvent.upsert({
    where: { id: eventId },
    create: { id: eventId, type: `transactworld.${kind}` },
    update: {},
  });
  return reconcileTransactworld(id, inquirePayment, data.paymentId);
}

export async function reconcilePendingTransactworld(limit = 2) {
  const c = requireTransactworldConfig();
  const pending = await db().order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      checkoutSessionId: {
        startsWith: `tw_${c.environment === "sandbox" ? "s" : "l"}_`,
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  let verified = 0;
  for (const order of pending) {
    try {
      if ((await reconcileTransactworld(order.checkoutSessionId!)).paid)
        verified++;
    } catch {
      // Fair retries, without assuming failure or releasing a potentially paid reservation.
      await db().order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { updatedAt: new Date() },
      });
    }
  }
  return { checked: pending.length, verified };
}
