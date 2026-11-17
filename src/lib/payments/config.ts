import "server-only";
import { envBoolean } from "@/lib/env-boolean";
import { HttpError } from "@/lib/http";
import {
  requireOrderMode,
  requireResellPortalCredentials,
  resellPortalTestMode,
} from "@/lib/esim/config";
import { requireTransactworldConfig } from "./transactworld-config";
import { emailConfigured } from "@/lib/email-config";

export function checkoutSetupIssues() {
  const issues: { code: string; message: string }[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });
  if (!envBoolean(process.env.PAYMENTS_ENABLED))
    add(
      "PAYMENTS_DISABLED",
      "Set PAYMENTS_ENABLED=yes after completing the remaining setup checks.",
    );
  if (!process.env.DATABASE_URL?.trim())
    add("DATABASE_MISSING", "DATABASE_URL is missing.");
  if (!process.env.RESEND_API_KEY?.trim())
    add("EMAIL_KEY_MISSING", "RESEND_API_KEY is missing.");
  if (!emailConfigured() && process.env.RESEND_API_KEY?.trim())
    add(
      "EMAIL_SENDER_MISSING",
      "EMAIL_FROM must use your verified sending domain.",
    );
  else if (
    !process.env.EMAIL_FROM ||
    process.env.EMAIL_FROM.includes("your-verified-domain.com")
  )
    add(
      "EMAIL_SENDER_MISSING",
      "Replace the EMAIL_FROM placeholder with your verified sending address.",
    );
  for (const key of ["ORDER_ACCESS_SECRET", "CRON_SECRET"] as const)
    if (!process.env[key] || process.env[key]!.length < 32)
      add(`${key}_MISSING`, `${key} must contain at least 32 characters.`);
  try {
    requireResellPortalCredentials();
  } catch {
    add(
      "SUPPLIER_SETUP",
      "Check RESELLPORTAL_API_KEY, RESELLPORTAL_API_SECRET and the documented REST base URL.",
    );
  }
  try {
    requireOrderMode();
  } catch {
    add(
      "LIVE_SUPPLIER_DISABLED",
      "Live eSIM fulfillment requires RESELLPORTAL_ALLOW_LIVE_ORDERS=yes.",
    );
  }
  try {
    if (paymentProviderName() === "transactworld") {
      try {
        requireTransactworldConfig();
      } catch (error) {
        add(
          "GATEWAY_SETUP",
          error instanceof HttpError
            ? error.message
            : "Check the public HTTPS NEXT_PUBLIC_APP_URL and TransactWorld merchant settings.",
        );
      }
      const sandbox =
        (process.env.TW_ENVIRONMENT?.trim() || "sandbox") === "sandbox";
      if (sandbox !== resellPortalTestMode())
        add(
          "MODE_MISMATCH",
          "TW_ENVIRONMENT and RESELLPORTAL_TEST_MODE do not match: sandbox uses test mode yes; live uses test mode no with live orders yes.",
        );
    } else {
      const prefix = resellPortalTestMode()
        ? /^(sk|rk)_test_/
        : /^(sk|rk)_live_/;
      if (
        !prefix.test(process.env.STRIPE_SECRET_KEY || "") ||
        !process.env.STRIPE_WEBHOOK_SECRET
      )
        add(
          "LEGACY_GATEWAY_SETUP",
          "Legacy payment credentials or mode are incomplete.",
        );
    }
  } catch {
    add(
      "GATEWAY_UNKNOWN",
      "PAYMENT_PROVIDER must select an installed provider.",
    );
  }
  return issues;
}

export function paymentProviderName() {
  const name = process.env.PAYMENT_PROVIDER || "transactworld";
  if (!["transactworld", "stripe"].includes(name))
    throw new HttpError(503, "Payment provider is not configured.");
  return name;
}
export function requireCheckoutSetup() {
  if (
    !envBoolean(process.env.PAYMENTS_ENABLED) ||
    !process.env.DATABASE_URL ||
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    process.env.EMAIL_FROM.includes("your-verified-domain.com") ||
    !process.env.ORDER_ACCESS_SECRET ||
    process.env.ORDER_ACCESS_SECRET.length < 32 ||
    !process.env.CRON_SECRET ||
    process.env.CRON_SECRET.length < 32
  )
    throw new HttpError(
      503,
      "Checkout is being configured. Please come back soon.",
    );
  requireResellPortalCredentials();
  requireOrderMode();
  if (paymentProviderName() === "transactworld") {
    const c = requireTransactworldConfig();
    if ((c.environment === "sandbox") !== resellPortalTestMode())
      throw new HttpError(
        503,
        "Payment and eSIM test/live settings must match.",
      );
  } else {
    const prefix = resellPortalTestMode() ? /^(sk|rk)_test_/ : /^(sk|rk)_live_/;
    if (
      !prefix.test(process.env.STRIPE_SECRET_KEY || "") ||
      !process.env.STRIPE_WEBHOOK_SECRET
    )
      throw new HttpError(503, "Checkout is temporarily unavailable.");
  }
}
export function checkoutConfigured() {
  return checkoutSetupIssues().length === 0;
}
