import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "./db";
import { getUser } from "./auth";
import { HttpError } from "./http";
const payloadSchema = z.object({
  id: z.string(),
  exp: z.number(),
  nonce: z.string().length(43),
});
function secret() {
  const key = process.env.ORDER_ACCESS_SECRET;
  if (!key || key.length < 32)
    throw new Error("ORDER_ACCESS_SECRET must contain at least 32 characters");
  return key;
}
export function createOrderToken(
  id: string,
  now = Date.now(),
  nonce = randomBytes(32).toString("base64url"),
) {
  const payload = Buffer.from(
    JSON.stringify({ id, exp: Math.floor(now / 1000) + 7 * 86400, nonce }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyOrderToken(token: string, now = Date.now()) {
  try {
    if (token.length > 2048) return null;
    const [payload, signature, ...extra] = token.split(".");
    if (!payload || !signature || extra.length) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      return null;
    const data = payloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    if (data.exp <= Math.floor(now / 1000)) return null;
    return data.id;
  } catch {
    return null;
  }
}
export async function canAccessOrder(order: {
  id: string;
  email: string;
  userId: string | null;
}) {
  const user = await getUser();
  if (
    user &&
    (user.id === order.userId ||
      user.email.toLowerCase() === order.email.toLowerCase() ||
      user.role === "ADMIN")
  )
    return true;
  const token = (await cookies()).get(`roamly_order_${order.id}`)?.value;
  return Boolean(token && verifyOrderToken(token) === order.id);
}
export async function accessibleOrder(id: string) {
  const order = await db().order.findUnique({
    where: { id },
    include: {
      items: true,
      esims: { include: { orderItem: true } },
      topUp: true,
    },
  });
  if (!order || !(await canAccessOrder(order)))
    throw new HttpError(
      404,
      "Order not found. Sign in or use the secure link from your email.",
    );
  return order;
}
export async function accessibleEsim(id: string) {
  const esim = await db().esim.findUnique({
    where: { id },
    include: { order: true, orderItem: { include: { plan: true } } },
  });
  if (!esim || !(await canAccessOrder(esim.order)))
    throw new HttpError(404, "eSIM not found.");
  return esim;
}
