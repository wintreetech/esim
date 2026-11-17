import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { HttpError } from "@/lib/http";
import {
  requireTransactworldConfig,
  type TransactworldConfig,
} from "./transactworld-config";
import { gatewayAuthToken, gatewayJson } from "./transactworld-token";
import type { CheckoutSessionInput } from "./types";

export const md5 = (value: string) =>
  createHash("md5").update(value, "utf8").digest("hex");
export function decimalCents(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,8}\.\d{2}$/.test(value))
    throw new HttpError(400, "Invalid gateway amount.");
  const [whole, fraction] = value.split(".");
  return Number(whole) * 100 + Number(fraction);
}
export const requestChecksum = (
  c: TransactworldConfig,
  amount: string,
  ref: string,
  redirect: string,
) => md5([c.memberId, c.toType, amount, ref, redirect, c.workingKey].join("|"));
export const responseChecksum = (
  c: TransactworldConfig,
  id: string,
  ref: string,
  amount: string,
  status: string,
) => md5([id, ref, amount, status, c.workingKey].join("|"));
export const sessionId = (ref: string, c = requireTransactworldConfig()) =>
  `tw_${c.environment === "live" ? "l" : "s"}_${ref}`;
export function sessionReference(id: string, c = requireTransactworldConfig()) {
  const prefix = `tw_${c.environment === "live" ? "l" : "s"}_`;
  if (!id.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(id.slice(prefix.length)))
    throw new HttpError(
      409,
      "This checkout belongs to a different payment mode. Start a new checkout.",
    );
  return id.slice(prefix.length);
}
export function buildGatewayRequest(
  input: CheckoutSessionInput,
  ref: string,
  c = requireTransactworldConfig(),
) {
  if (
    !/^[a-f0-9]{64}$/.test(ref) ||
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > 99_999_999
  )
    throw new HttpError(400, "Invalid payment request.");
  if (!c.supportedCurrencies.includes(input.currency))
    throw new HttpError(
      400,
      `${input.currency} payments are unavailable. Choose ${c.supportedCurrencies.join(" or ")}.`,
    );
  const ip = input.shopperIp?.replace(/^::ffff:/, "") || "";
  if (!isIP(ip))
    throw new HttpError(
      400,
      "Could not determine the customer network address. Please try again.",
    );
  const amount = (input.amount / 100).toFixed(2);
  const redirect = `${c.appOrigin}/api/payments/transactworld/return/${ref}`;
  return {
    id: sessionId(ref, c),
    url: `${c.origin}/transaction/Checkout`,
    method: "POST" as const,
    fields: {
      memberId: c.memberId,
      totype: c.toType,
      language: c.language,
      amount,
      TMPL_AMOUNT: amount,
      currency: input.currency,
      TMPL_CURRENCY: input.currency,
      merchantTransactionId: ref,
      merchantRedirectUrl: redirect,
      notificationUrl: `${c.appOrigin}/api/payments/transactworld/notify/${ref}`,
      paymentType: "DB",
      paymentMode: c.paymentMode,
      paymentBrand: c.paymentBrand,
      email: input.email,
      ip,
      orderDescription: input.description
        .replace(/[^\p{L}\p{N} .-]/gu, " ")
        .slice(0, 255),
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(c.terminalId ? { terminalid: c.terminalId } : {}),
      checksum: requestChecksum(c, amount, ref, redirect),
    },
  };
}
const callbackSchema = z.object({
  paymentId: z.coerce.string().regex(/^\d{1,32}$/),
  merchantTransactionId: z.string().regex(/^[a-f0-9]{64}$/),
  amount: z.string().max(32),
  checksum: z.string().regex(/^[a-fA-F0-9]{32}$/),
  status: z
    .string()
    .regex(/^[A-Za-z0-9_]{1,64}$/)
    .optional(),
  transactionStatus: z.enum(["Y", "N", "P", "3D", "C"]).optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});
export function verifyGatewayCallback(
  body: unknown,
  ref: string,
  kind: "return" | "notify",
  c = requireTransactworldConfig(),
) {
  const data = callbackSchema.parse(body);
  const status = kind === "return" ? data.status : data.transactionStatus;
  if (
    !status ||
    data.merchantTransactionId !== ref ||
    (kind === "return" && !data.currency)
  )
    throw new HttpError(400, "Gateway reference or status mismatch.");
  decimalCents(data.amount);
  const expected = responseChecksum(
    c,
    data.paymentId,
    ref,
    data.amount,
    status,
  );
  if (
    !timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(data.checksum, "hex"),
    )
  )
    throw new HttpError(400, "Invalid payment confirmation signature.");
  return { ...data, signedStatus: status };
}
const inquirySchema = z.object({
  paymentId: z.coerce.string().regex(/^\d{1,32}$/),
  merchantTransactionId: z.string(),
  amount: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.string(),
  transactionStatus: z.enum(["Y", "N", "P", "3D", "C"]),
  refundamount: z.string().optional(),
  chargebackamount: z.string().optional(),
});
export async function inquirePayment(
  reference: string,
  idType: "PID" | "MID" = "PID",
  c = requireTransactworldConfig(),
) {
  if (!(idType === "PID" ? /^\d{1,32}$/ : /^[a-f0-9]{64}$/).test(reference))
    throw new HttpError(400, "Invalid payment reference.");
  let token = await gatewayAuthToken(c);
  const send = () =>
    fetch(`${c.origin}/transactionServices/REST/v1/inquiry`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        AuthToken: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "authentication.memberId": c.memberId,
        "authentication.checksum": md5(
          `${c.memberId}|${c.workingKey}|${reference}`,
        ),
        paymentType: "IN",
        idType,
        ...(idType === "PID"
          ? { paymentId: reference }
          : { merchantTransactionId: reference }),
      }),
    });
  try {
    let response = await send();
    if (!c.authToken && [401, 403].includes(response.status)) {
      await response.body?.cancel();
      token = await gatewayAuthToken(c, true);
      response = await send();
    }
    return inquirySchema.parse(await gatewayJson(response));
  } catch {
    throw new HttpError(
      503,
      "Payment verification is temporarily unavailable. Your payment remains pending.",
    );
  }
}
export type Inquiry = typeof inquirePayment;
