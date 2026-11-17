import "server-only";
import { envBoolean } from "@/lib/env-boolean";
import { currencies } from "@/lib/currency";
import { HttpError } from "@/lib/http";

export function transactworldConfig(appOriginOverride?: string) {
  const environment = process.env.TW_ENVIRONMENT?.trim() || "sandbox";
  if (!["sandbox", "live"].includes(environment))
    throw new HttpError(503, "Invalid payment gateway environment.");
  const origin =
    environment === "live"
      ? "https://secure.transactworld.com"
      : "https://sandbox.transactworld.com";
  const appUrl = new URL(
    appOriginOverride ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3010",
  );
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    appUrl.hostname,
  );
  const local =
    process.env.NODE_ENV !== "production" &&
    environment === "sandbox" &&
    envBoolean(process.env.TW_ALLOW_LOCAL_CHECKOUT) &&
    loopback;
  if (
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash ||
    appUrl.pathname !== "/" ||
    (!local && (appUrl.protocol !== "https:" || loopback))
  )
    throw new HttpError(
      503,
      "Configure a public HTTPS website URL for payment callbacks.",
    );
  const supportedCurrencies = [
    ...new Set(
      (process.env.TW_SUPPORTED_CURRENCIES || "")
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => Boolean(value) && value !== "INR"),
    ),
  ];
  if (
    !supportedCurrencies.length ||
    supportedCurrencies.some(
      (value) => !currencies.includes(value as (typeof currencies)[number]),
    )
  )
    throw new HttpError(
      503,
      "Configure the currencies approved for this payment merchant.",
    );
  const mode = (process.env.PAYMENT_MODE || "CC").trim().toUpperCase();
  const brand = (process.env.PAYMENT_BRAND || "VISA").trim().toUpperCase();
  return {
    environment,
    origin,
    appOrigin: appUrl.origin,
    supportedCurrencies,
    memberId: process.env.MEMBER_ID?.trim() || "",
    workingKey: process.env.WORKING_KEY?.trim() || "",
    merchantUsername: process.env.TW_MERCHANT_USERNAME?.trim() || "",
    partnerId: process.env.TW_PARTNER_ID?.trim() || "",
    authToken: process.env.TW_AUTH_TOKEN?.trim() || "",
    toType: process.env.TO_TYPE?.trim() || "Transactworld",
    language: process.env.LANGUAGE?.trim() || "ENG",
    paymentMode: mode === "1" ? "CC" : mode,
    paymentBrand: brand === "VISAS" ? "VISA" : brand,
    terminalId: process.env.TERMINAL_ID?.trim() || "",
  };
}
export type TransactworldConfig = ReturnType<typeof transactworldConfig>;

export function requireTransactworldConfig(appOriginOverride?: string) {
  const c = transactworldConfig(appOriginOverride);
  if (
    !/^\d{1,10}$/.test(c.memberId) ||
    !c.workingKey ||
    c.workingKey.includes("|")
  )
    throw new HttpError(
      503,
      "Payment merchant credentials are not configured.",
    );
  return c;
}
