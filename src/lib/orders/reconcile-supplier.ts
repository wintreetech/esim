import "server-only";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/esim/provider";
import { HttpError } from "@/lib/http";
export async function reconcileSupplierOrder(
  orderItemId: string,
  serviceId: string,
  actorId: string,
) {
  const item = await db().orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    include: {
      order: { include: { payment: true, jobs: true } },
      supplierOrder: true,
    },
  });
  if (
    !item.supplierOrder ||
    !item.supplierOrder.clientId ||
    item.order.payment?.status !== "PAID" ||
    !["FAILED", "PROVISIONING"].includes(item.order.status)
  )
    throw new HttpError(
      400,
      "Only a paid order awaiting supplier reconciliation can be linked.",
    );
  if (
    item.order.jobs.some(
      (j) =>
        j.status === "RUNNING" && j.lockedUntil && j.lockedUntil > new Date(),
    )
  )
    throw new HttpError(409, "A worker is still handling this order.");
  const remote = await getProvider(item.provider).getOrder(serviceId);
  if (
    remote.clientId !== item.supplierOrder.clientId ||
    remote.packageCode !== item.supplierPlanId ||
    remote.testMode !== item.order.supplierTestMode
  )
    throw new HttpError(
      409,
      "The supplier service does not confirm the same customer, package and test/live mode. Reconcile it in ResellPortal before linking.",
    );
  await db().$transaction(async (tx) => {
    const linked = await tx.supplierOrder.updateMany({
      where: {
        id: item.supplierOrder!.id,
        externalOrderId: null,
        status: { in: ["SUBMITTING", "RECONCILE_REQUIRED"] },
      },
      data: {
        externalOrderId: remote.orderId,
        status: remote.status,
        errorCode: null,
      },
    });
    if (!linked.count)
      throw new HttpError(
        409,
        "The supplier order changed. Refresh before retrying.",
      );
    await tx.order.updateMany({
      where: { id: item.orderId, status: { in: ["FAILED", "PROVISIONING"] } },
      data: { status: "PROVISIONING" },
    });
    await tx.fulfillmentJob.upsert({
      where: { orderId_kind: { orderId: item.orderId, kind: "PROVISION" } },
      create: { orderId: item.orderId, kind: "PROVISION" },
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
        orderId: item.orderId,
        actorId,
        action: "SUPPLIER_SERVICE_RECONCILED",
        detail: `Service ${serviceId} linked without creating a new supplier order.`,
      },
    });
  });
}

export async function authorizeSupplierRetry(
  orderItemId: string,
  reason: string,
  actorId: string,
) {
  await db().$transaction(async (tx) => {
    const item = await tx.orderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      include: {
        order: { include: { payment: true, jobs: true } },
        supplierOrder: true,
      },
    });
    if (
      !item.supplierOrder ||
      item.order.payment?.status !== "PAID" ||
      !["FAILED", "PROVISIONING"].includes(item.order.status)
    )
      throw new HttpError(400, "This order cannot be retried.");
    if (
      item.order.jobs.some(
        (j) =>
          j.status === "RUNNING" && j.lockedUntil && j.lockedUntil > new Date(),
      )
    )
      throw new HttpError(409, "A worker is still handling this order.");
    const changed = await tx.supplierOrder.updateMany({
      where: {
        id: item.supplierOrder.id,
        externalOrderId: null,
        status: { in: ["SUBMITTING", "RECONCILE_REQUIRED"] },
      },
      data: { status: "RESERVED", errorCode: null },
    });
    if (!changed.count)
      throw new HttpError(
        409,
        "The supplier record changed. Refresh before retrying.",
      );
    await tx.order.updateMany({
      where: { id: item.orderId, status: { in: ["FAILED", "PROVISIONING"] } },
      data: { status: "PROVISIONING" },
    });
    await tx.fulfillmentJob.upsert({
      where: { orderId_kind: { orderId: item.orderId, kind: "PROVISION" } },
      create: { orderId: item.orderId, kind: "PROVISION" },
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
        orderId: item.orderId,
        actorId,
        action: "OPERATOR_CONFIRMED_NO_SUPPLIER_PURCHASE",
        detail: reason,
      },
    });
  });
}
