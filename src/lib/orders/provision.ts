import "server-only";
import { randomUUID, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/esim/provider";
import { ProviderError, providerOrderSchema } from "@/lib/esim/types";
import { track } from "@/lib/analytics";
import { sendEsimEmail } from "@/lib/email";
import { resellPortalTestMode } from "@/lib/esim/config";
const MAX_ATTEMPTS = 6;
export async function fulfillOrder(orderId: string) {
  const order = await db().order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { include: { esim: true, supplierOrder: true } },
      payment: true,
      topUp: {
        include: { esim: { include: { orderItem: true } }, plan: true },
      },
    },
  });
  if (order.status === "FULFILLED" || order.status === "REFUNDED") return;
  if (order.supplierTestMode !== resellPortalTestMode())
    throw new ProviderError("SUPPLIER_MODE_CHANGED", false);
  if (
    !order.payment ||
    order.payment.status !== "PAID" ||
    !["PAID", "PROVISIONING", "FAILED"].includes(order.status)
  )
    throw new ProviderError("PAYMENT_NOT_CONFIRMED", false);
  await db().order.updateMany({
    where: { id: orderId, status: { in: ["PAID", "FAILED"] } },
    data: { status: "PROVISIONING" },
  });
  if (order.topUp) {
    const t = order.topUp;
    if (t.status !== "COMPLETED") {
      const result = await getProvider(t.esim.orderItem.provider).topUp({
        esimId: t.esim.providerEsimId,
        supplierPlanId: order.items[0].supplierPlanId,
        reference: t.reference,
      });
      if (result.status !== "COMPLETED")
        throw new ProviderError("SUPPLIER_PENDING");
      await db().$transaction(async (tx) => {
        const changed = await tx.topUp.updateMany({
          where: { id: t.id, status: { not: "COMPLETED" } },
          data: { externalId: result.id, status: "COMPLETED" },
        });
        if (changed.count)
          await tx.esim.update({
            where: { id: t.esimId },
            data: { dataTotalMb: { increment: order.items[0].dataAmountMB } },
          });
      });
    }
  } else {
    for (const item of order.items) {
      if (item.esim) continue;
      const current = await db().order.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true },
      });
      if (current.status === "REFUNDED") return;
      const reference = `esim:${item.id}`;
      // Persist a local reference before any purchase. Idempotent adapters may repeat
      // their stable key; ResellPortal pauses ambiguous purchases for reconciliation.
      // No database transaction spans an external network call.
      const reservation = await db().supplierOrder.upsert({
        where: { orderItemId: item.id },
        create: { orderItemId: item.id, provider: item.provider, reference },
        update: {},
      });
      const provider = getProvider(item.provider);
      let remote;
      let submitted = false;
      try {
        if (reservation.externalOrderId) {
          remote = providerOrderSchema.parse(
            await provider.getOrder(reservation.externalOrderId),
          );
        } else {
          if (
            !provider.supportsIdempotentOrders &&
            ["SUBMITTING", "RECONCILE_REQUIRED"].includes(reservation.status)
          ) {
            throw new ProviderError(
              "SUPPLIER_RECONCILIATION_REQUIRED",
              false,
              true,
            );
          }
          const input = {
            supplierPlanId: item.supplierPlanId,
            reference,
            email: order.email,
            firstName: order.firstName,
            lastName: order.lastName,
            clientId: reservation.clientId || undefined,
          };
          if (provider.prepareOrder && !input.clientId) {
            const prepared = await provider.prepareOrder(input);
            input.clientId = prepared.clientId;
            await db().supplierOrder.update({
              where: { id: reservation.id },
              data: { clientId: prepared.clientId },
            });
          }
          if (!provider.supportsIdempotentOrders) {
            const claim = await db().supplierOrder.updateMany({
              where: {
                id: reservation.id,
                externalOrderId: null,
                status: "RESERVED",
              },
              data: { status: "SUBMITTING" },
            });
            if (!claim.count)
              throw new ProviderError(
                "SUPPLIER_RECONCILIATION_REQUIRED",
                false,
                true,
              );
          }
          submitted = true;
          remote = providerOrderSchema.parse(await provider.createOrder(input));
          // Persist the remote service ID before any later operation can fail.
          await db().supplierOrder.update({
            where: { id: reservation.id },
            data: {
              externalOrderId: remote.orderId,
              status: remote.status,
              errorCode: null,
            },
          });
        }
      } catch (error) {
        const unknown = error instanceof ProviderError && error.outcomeUnknown;
        const needsReview =
          !provider.supportsIdempotentOrders &&
          (unknown || (submitted && !(error instanceof ProviderError)));
        await db().supplierOrder.update({
          where: { id: reservation.id },
          data: {
            ...(!provider.supportsIdempotentOrders &&
            !reservation.externalOrderId &&
            (submitted || unknown)
              ? { status: needsReview ? "RECONCILE_REQUIRED" : "RESERVED" }
              : {}),
            errorCode:
              error instanceof ProviderError
                ? error.code
                : "PROVIDER_RESPONSE_INVALID",
          },
        });
        if (needsReview)
          throw new ProviderError(
            "SUPPLIER_RECONCILIATION_REQUIRED",
            false,
            true,
          );
        throw error;
      }
      await db().supplierOrder.update({
        where: { id: reservation.id },
        data: {
          externalOrderId: remote.orderId,
          status: remote.status,
          errorCode: null,
        },
      });
      if (remote.testMode !== order.supplierTestMode)
        throw new ProviderError("SUPPLIER_MODE_MISMATCH", false);
      if (remote.status !== "READY")
        throw new ProviderError("SUPPLIER_PENDING");
      await db().esim.upsert({
        where: { orderItemId: item.id },
        create: {
          orderId,
          orderItemId: item.id,
          supplierOrderId: reservation.id,
          providerEsimId: remote.esimId,
          iccid: remote.iccid,
          activationCode: remote.activationCode,
          qrCodeData: remote.qrCodeData,
          smdpAddress: remote.smdpAddress,
          status: remote.testMode ? "TEST_READY" : "READY",
          testMode: remote.testMode,
          qrCodeUrl: remote.qrCodeUrl,
          activationUrl: remote.activationUrl,
          dataTotalMb: item.dataAmountMB,
          expiresAt: remote.expiresAt ? new Date(remote.expiresAt) : null,
        },
        update: {},
      });
    }
  }
  const fulfilled = await db().$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: "PROVISIONING" },
      data: {
        status: "FULFILLED",
        emailAccessNonce: randomBytes(32).toString("base64url"),
        emailRequestedAt: new Date(),
      },
    });
    if (changed.count) {
      await tx.fulfillmentJob.upsert({
        where: { orderId_kind: { orderId, kind: "EMAIL" } },
        create: { orderId, kind: "EMAIL" },
        update: {},
      });
      await tx.auditLog.create({
        data: {
          orderId,
          action: order.topUp ? "TOPUP_COMPLETED" : "ESIM_PROVISIONED",
        },
      });
    }
    return changed.count;
  });
  if (fulfilled)
    await track(order.topUp ? "topup_completed" : "esim_provisioned", {
      orderId,
    });
}
export async function runJobs(limit = 5) {
  const now = new Date();
  const jobs = await db().fulfillmentJob.findMany({
    where: {
      runAfter: { lte: now },
      OR: [
        { status: "PENDING" },
        { status: "RUNNING", lockedUntil: { lt: now } },
      ],
    },
    orderBy: { runAfter: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const job of jobs) {
    const token = randomUUID();
    const claim = await db().fulfillmentJob.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: "PENDING" },
          { status: "RUNNING", lockedUntil: { lt: new Date() } },
        ],
      },
      data: {
        status: "RUNNING",
        lockToken: token,
        lockedUntil: new Date(Date.now() + 600000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    try {
      if (job.kind === "PROVISION") await fulfillOrder(job.orderId);
      else await sendEsimEmail(job.orderId);
      await db().fulfillmentJob.updateMany({
        where: { id: job.id, lockToken: token },
        data: {
          status: "DONE",
          lockedUntil: null,
          lockToken: null,
          lastError: null,
        },
      });
      processed++;
    } catch (error) {
      const code =
        error instanceof ProviderError ? error.code : "DELIVERY_UNAVAILABLE";
      const permanent =
        (error instanceof ProviderError && !error.retryable) ||
        job.attempts + 1 >= MAX_ATTEMPTS;
      await db().$transaction(async (tx) => {
        const changed = await tx.fulfillmentJob.updateMany({
          where: { id: job.id, lockToken: token },
          data: {
            status: permanent ? "FAILED" : "PENDING",
            lockedUntil: null,
            lockToken: null,
            lastError: code,
            runAfter: new Date(
              Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
            ),
          },
        });
        if (!changed.count) return;
        if (job.kind === "PROVISION" && permanent)
          await tx.order.updateMany({
            where: {
              id: job.orderId,
              status: { in: ["PAID", "PROVISIONING"] },
            },
            data: { status: "FAILED" },
          });
        await tx.auditLog.create({
          data: {
            orderId: job.orderId,
            action: permanent
              ? `${job.kind}_NEEDS_ATTENTION`
              : `${job.kind}_RETRY_SCHEDULED`,
            detail: code,
          },
        });
      });
      if (job.kind === "PROVISION")
        await track("esim_provision_failed", {
          orderId: job.orderId,
          code,
          permanent,
        });
    }
  }
  return { processed };
}
