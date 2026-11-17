import { randomUUID, randomBytes } from "node:crypto";
import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonBody, sameOrigin, apiError, HttpError } from "@/lib/http";
import { adminSchema } from "@/lib/validators/admin";
import { calculatePrice, pricingConfig } from "@/lib/pricing/calculate-price";
import { runJobs } from "@/lib/orders/provision";
import { syncCatalog } from "@/lib/esim/sync";
import { getStripe } from "@/lib/stripe";
import { recordRefund } from "@/lib/orders/payment-confirmation";
import { reconcileTransactworld } from "@/lib/payments/transactworld-confirmation";
import { rateLimit } from "@/lib/rate-limit";
import {
  reconcileSupplierOrder,
  authorizeSupplierRetry,
} from "@/lib/orders/reconcile-supplier";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireAdmin();
    await rateLimit(request, "admin", 30);
    const input = await jsonBody(request, adminSchema);
    if (input.action === "reconcile-service") {
      await reconcileSupplierOrder(input.orderItemId, input.serviceId, user.id);
      after(async () => {
        await runJobs(2);
      });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "authorize-supplier-retry") {
      await authorizeSupplierRetry(input.orderItemId, input.reason, user.id);
      after(async () => {
        await runJobs(2);
      });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "sync") {
      const result = await syncCatalog();
      await db().auditLog.create({
        data: { actorId: user.id, action: "CATALOG_SYNCED" },
      });
      return NextResponse.json(result);
    }
    if (input.action === "plan") {
      const plan = await db().plan.findUniqueOrThrow({
        where: { id: input.id },
      });
      try {
        calculatePrice({
          wholesale: plan.wholesalePrice,
          retailOverride: input.retailOverride ?? plan.retailPrice,
          ...pricingConfig(),
        });
      } catch {
        throw new HttpError(
          400,
          "Retail price must cover supplier cost and the configured minimum margin.",
        );
      }
      await db().$transaction([
        db().plan.update({
          where: { id: plan.id },
          data: { retailOverride: input.retailOverride, active: input.active },
        }),
        db().auditLog.create({
          data: { actorId: user.id, action: "PLAN_UPDATED", detail: plan.id },
        }),
      ]);
    } else if (input.action === "destination")
      await db().$transaction([
        db().destination.update({
          where: { id: input.id },
          data: { active: input.active },
        }),
        db().auditLog.create({
          data: {
            actorId: user.id,
            action: "DESTINATION_UPDATED",
            detail: input.id,
          },
        }),
      ]);
    else if (input.action === "coupon") {
      const previous = await db().coupon.findUnique({
        where: { code: input.code },
      });
      if (input.maxUses !== null && input.maxUses < (previous?.usedCount || 0))
        throw new HttpError(
          400,
          "Usage limit cannot be below existing reservations.",
        );
      const { action: _, ...fields } = input;
      void _;
      const data = {
        ...fields,
        expiresAt: fields.expiresAt ? new Date(fields.expiresAt) : null,
      };
      await db().$transaction([
        db().coupon.upsert({
          where: { code: input.code },
          create: data,
          update: data,
        }),
        db().auditLog.create({
          data: {
            actorId: user.id,
            action: "COUPON_UPDATED",
            detail: input.code,
          },
        }),
      ]);
    } else if (input.action === "refund-marker") {
      const order = await db().order.findUniqueOrThrow({
        where: { id: input.orderId },
      });
      if (order.checkoutSessionId?.startsWith("tw_")) {
        const result = await reconcileTransactworld(order.checkoutSessionId);
        if (!result.refunded)
          throw new HttpError(
            400,
            "The payment gateway has not confirmed a full refund. Refund in the merchant dashboard first.",
          );
        await db().auditLog.create({
          data: {
            actorId: user.id,
            orderId: order.id,
            action: "ADMIN_REFUND_RECONCILED",
          },
        });
        return NextResponse.json({ success: true });
      }
      if (!order.stripePaymentIntentId)
        throw new HttpError(400, "No recorded payment.");
      const intent = await getStripe().paymentIntents.retrieve(
        order.stripePaymentIntentId,
        { expand: ["latest_charge"] },
      );
      const charge = intent.latest_charge;
      if (
        !charge ||
        typeof charge === "string" ||
        !charge.refunded ||
        charge.amount_refunded !== charge.amount
      )
        throw new HttpError(
          400,
          "Stripe has not confirmed a full refund. Issue the refund in Stripe first.",
        );
      await recordRefund(
        order.stripePaymentIntentId,
        `admin-refund:${randomUUID()}`,
      );
      await db().auditLog.create({
        data: {
          actorId: user.id,
          orderId: order.id,
          action: "ADMIN_REFUND_RECONCILED",
        },
      });
    } else {
      await db().$transaction(async (tx) => {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          include: { payment: true, jobs: true },
        });
        const kind = input.action === "retry" ? "PROVISION" : "EMAIL";
        const existing = order.jobs.find((j) => j.kind === kind);
        if (
          existing?.status === "RUNNING" &&
          existing.lockedUntil &&
          existing.lockedUntil > new Date()
        )
          throw new HttpError(
            409,
            "A worker is currently handling this order.",
          );
        if (kind === "PROVISION") {
          if (
            !order.payment ||
            order.payment.status !== "PAID" ||
            !["PAID", "PROVISIONING", "FAILED"].includes(order.status)
          )
            throw new HttpError(
              400,
              "Only paid, unfulfilled orders can be retried.",
            );
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PROVISIONING" },
          });
        } else {
          if (order.status !== "FULFILLED")
            throw new HttpError(
              400,
              "Only fulfilled orders can receive a ready email.",
            );
          await tx.order.update({
            where: { id: order.id },
            data: {
              emailSentAt: null,
              emailVersion: { increment: 1 },
              emailAccessNonce: randomBytes(32).toString("base64url"),
              emailRequestedAt: new Date(),
            },
          });
        }
        await tx.fulfillmentJob.upsert({
          where: { orderId_kind: { orderId: order.id, kind } },
          create: { orderId: order.id, kind },
          update: {
            status: "PENDING",
            attempts: 0,
            runAfter: new Date(),
            lockedUntil: null,
            lockToken: null,
            lastError: null,
          },
        });
        await tx.auditLog.create({
          data: {
            orderId: order.id,
            actorId: user.id,
            action:
              kind === "PROVISION"
                ? "ADMIN_RETRY_REQUESTED"
                : "ADMIN_EMAIL_RESEND_REQUESTED",
          },
        });
      });
      after(async () => {
        await runJobs(2);
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
