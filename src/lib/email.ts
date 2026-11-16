import "server-only";
import { Resend } from "resend";
import { esimQrImage } from "./esim/qr-image";
import { db } from "./db";
import { brand } from "./brand";
import { createOrderToken } from "./order-access";
import { EsimReadyEmail } from "@/emails/esim-ready";
export async function sendEsimEmail(orderId: string) {
  const order = await db().order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, esims: true, topUp: true },
  });
  if (order.emailSentAt || order.status !== "FULFILLED") return;
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("Email not configured");
  if (!order.emailAccessNonce || !order.emailRequestedAt)
    throw new Error("Email access is not initialized");
  const token = createOrderToken(
      order.id,
      order.emailRequestedAt.getTime(),
      order.emailAccessNonce,
    ),
    link = `${brand.url}/api/orders/access?token=${encodeURIComponent(token)}`;
  const attachments = await Promise.all(
    order.esims
      .filter((e) => !e.testMode)
      .map(async (e) => {
        const qr = await esimQrImage(e);
        return {
          filename: `esim-${e.id.slice(-6)}.${qr.mime.split("/")[1]}`,
          content: qr.buffer,
          contentType: qr.mime,
          contentId: `qr-${e.orderItemId}`,
        };
      }),
  );
  const items = order.items.map((i) => ({
    ...i,
    qrCid: order.esims.some((e) => e.orderItemId === i.id && !e.testMode)
      ? `qr-${i.id}`
      : undefined,
  }));
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
    {
      from: process.env.EMAIL_FROM,
      to: order.email,
      subject: order.esims.some((e) => e.testMode)
        ? "Test order: your eSIM integration result"
        : order.topUp
          ? "Your travel eSIM top-up is ready"
          : "Your travel eSIM is ready",
      react: EsimReadyEmail({
        orderLink: link,
        items,
        topUp: !!order.topUp,
        testMode: order.esims.some((e) => e.testMode),
      }),
      attachments,
    },
    { idempotencyKey: `esim-ready:${order.id}:${order.emailVersion}` },
  );
  if (error) throw new Error("Email delivery unavailable");
  await db().$transaction([
    db().order.update({
      where: { id: orderId },
      data: { emailSentAt: new Date() },
    }),
    db().auditLog.create({ data: { orderId, action: "ESIM_EMAIL_SENT" } }),
  ]);
}
