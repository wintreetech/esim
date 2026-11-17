import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { accessibleOrder } from "@/lib/order-access";
import { HttpError } from "@/lib/http";
import { emailConfigured } from "@/lib/email-config";

export async function requestOrderEmail(orderId: string) {
  await accessibleOrder(orderId);
  if (!emailConfigured())
    throw new HttpError(
      503,
      "Email delivery is temporarily unavailable. Your installation details are still available on your order page.",
    );
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`resend:${orderId}`})::bigint)`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { jobs: true },
    });
    if (order.status !== "FULFILLED")
      throw new HttpError(
        409,
        "Installation emails are available once your eSIM has been issued.",
      );
    if (
      order.emailRequestedAt &&
      Date.now() - order.emailRequestedAt.getTime() < 60000
    )
      throw new HttpError(
        429,
        "Please wait one minute before requesting another email.",
      );
    const job = order.jobs.find((job) => job.kind === "EMAIL");
    if (
      job?.status === "RUNNING" &&
      job.lockedUntil &&
      job.lockedUntil > new Date()
    )
      throw new HttpError(
        409,
        "An email is already being sent. Please check your inbox shortly.",
      );
    await tx.order.update({
      where: { id: orderId },
      data: {
        emailSentAt: null,
        emailVersion: { increment: 1 },
        emailAccessNonce: randomBytes(32).toString("base64url"),
        emailRequestedAt: new Date(),
      },
    });
    await tx.fulfillmentJob.upsert({
      where: { orderId_kind: { orderId, kind: "EMAIL" } },
      create: { orderId, kind: "EMAIL" },
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
      data: { orderId, action: "CUSTOMER_EMAIL_RESEND_REQUESTED" },
    });
  });
}
