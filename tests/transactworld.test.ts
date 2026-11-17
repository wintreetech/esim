import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { envBoolean } from "@/lib/env-boolean";
import { resellPortalTestMode, requireOrderMode } from "@/lib/esim/config";
import {
  transactworldConfig,
  requireTransactworldConfig,
} from "@/lib/payments/transactworld-config";
import {
  buildGatewayRequest,
  decimalCents,
  requestChecksum,
  responseChecksum,
  verifyGatewayCallback,
  inquirePayment,
  sessionReference,
} from "@/lib/payments/transactworld";
import { createGatewayTokenManager } from "@/lib/payments/transactworld-token";
import { validatePaymentRedirect } from "@/lib/payments/redirect";
import { requireCheckoutSetup } from "@/lib/payments/config";
import { checkoutSetupIssues } from "@/lib/payments/config";
import { shopperIp } from "@/lib/payments/shopper-ip";

const ref = "b".repeat(64);
const input = {
  orderId: "order1",
  email: "buyer@example.com",
  amount: 1234,
  currency: "EUR",
  description: "Travel eSIM",
  expiresAt: 0,
  shopperIp: "203.0.113.12",
};
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "test",
    MEMBER_ID: "1000",
    WORKING_KEY: "unit-test-key-only",
    TW_ENVIRONMENT: "sandbox",
    TW_SUPPORTED_CURRENCIES: "USD,EUR,AUD",
    TW_AUTH_TOKEN: "test-token",
    TW_MERCHANT_USERNAME: "",
    TW_PARTNER_ID: "",
    NEXT_PUBLIC_APP_URL: "https://store.example.com",
    TW_ALLOW_LOCAL_CHECKOUT: "no",
    RESELLPORTAL_TEST_MODE: "yes",
    RESELLPORTAL_ALLOW_LIVE_ORDERS: "no",
    PAYMENT_PROVIDER: "transactworld",
    PAYMENTS_ENABLED: "yes",
    DATABASE_URL: "postgresql://localhost/test",
    RESEND_API_KEY: "unit-only",
    EMAIL_FROM: "Roamly <hello@example.com>",
    ORDER_ACCESS_SECRET: "a".repeat(32),
    CRON_SECRET: "b".repeat(32),
    RESELLPORTAL_API_KEY: "unit-only",
    RESELLPORTAL_API_SECRET: "unit-only",
    RESELLPORTAL_BASE_URL:
      "https://panel.resellportal.com/wp-json/resellportal/v1",
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("explicit environment switches", () => {
  it("reports all setup blockers without exposing credentials", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "no");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "hello@your-verified-domain.com");
    vi.stubEnv("TW_ENVIRONMENT", "live");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3010");
    const issues = checkoutSetupIssues();
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "PAYMENTS_DISABLED",
        "EMAIL_KEY_MISSING",
        "EMAIL_SENDER_MISSING",
        "GATEWAY_SETUP",
        "MODE_MISMATCH",
      ]),
    );
    expect(JSON.stringify(issues)).not.toContain("unit-test-key-only");
  });
  it("accepts yes/no and preserves true/false; unknown values retain safe defaults", () => {
    for (const value of ["yes", " YES ", "true"])
      expect(envBoolean(value)).toBe(true);
    for (const value of ["no", " NO ", "false"])
      expect(envBoolean(value, true)).toBe(false);
    for (const value of [undefined, "", "offf", "yess", "0"]) {
      expect(envBoolean(value)).toBe(false);
      expect(envBoolean(value, true)).toBe(true);
      vi.stubEnv("RESELLPORTAL_TEST_MODE", value);
      expect(resellPortalTestMode()).toBe(true);
    }
  });
  it("requires an explicit live order opt-in and matching payment environment", () => {
    expect(() => requireCheckoutSetup()).not.toThrow();
    vi.stubEnv("RESELLPORTAL_TEST_MODE", "no");
    expect(() => requireOrderMode()).toThrow();
    vi.stubEnv("RESELLPORTAL_ALLOW_LIVE_ORDERS", "yes");
    expect(() => requireOrderMode()).not.toThrow();
    expect(() => requireCheckoutSetup()).toThrow(/must match/);
    vi.stubEnv("TW_ENVIRONMENT", "live");
    expect(() => requireCheckoutSetup()).not.toThrow();
    vi.stubEnv("PAYMENTS_ENABLED", "no");
    expect(() => requireCheckoutSetup()).toThrow(/configured/);
  });
});
describe("LexiHive Standard Checkout contract", () => {
  it("posts authoritative amounts, both currency fields and a signed callback URL without exposing secrets", () => {
    const c = requireTransactworldConfig();
    const form = buildGatewayRequest(input, ref, c);
    expect(form.url).toBe(
      "https://sandbox.transactworld.com/transaction/Checkout",
    );
    expect(form.fields).toMatchObject({
      amount: "12.34",
      TMPL_AMOUNT: "12.34",
      currency: "EUR",
      TMPL_CURRENCY: "EUR",
      paymentType: "DB",
      ip: "203.0.113.12",
      email: input.email,
    });
    expect(form.fields.checksum).toBe(
      createHash("md5")
        .update(
          `1000|Transactworld|12.34|${ref}|${form.fields.merchantRedirectUrl}|unit-test-key-only`,
        )
        .digest("hex"),
    );
    expect(
      requestChecksum(c, "12.34", ref, form.fields.merchantRedirectUrl),
    ).toBe(form.fields.checksum);
    expect(JSON.stringify(form)).not.toContain(c.workingKey);
    expect(JSON.stringify(form)).not.toContain(c.authToken);
    expect(validatePaymentRedirect(form).host).toBe(
      "sandbox.transactworld.com",
    );
  });
  it("only accepts merchant-approved currencies and exact integer minor units", () => {
    vi.stubEnv("TW_SUPPORTED_CURRENCIES", "USD,EUR");
    expect(() =>
      buildGatewayRequest({ ...input, currency: "AUD" }, ref),
    ).toThrow(/AUD payments/);
    for (const amount of [0, -2, 12.5, NaN])
      expect(() => buildGatewayRequest({ ...input, amount }, ref)).toThrow();
    expect(decimalCents("12.34")).toBe(1234);
    for (const amount of ["12", "12.345", "1e2", "-12.00", 12.34])
      expect(() => decimalCents(amount)).toThrow();
  });
  it("keeps sandbox/live session references separate", () => {
    expect(sessionReference(`tw_s_${ref}`)).toBe(ref);
    expect(() => sessionReference(`tw_l_${ref}`)).toThrow();
    expect(() => sessionReference("cs_test_1")).toThrow();
  });
  it("requires HTTPS callbacks and only allows explicit local sandbox development", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3010");
    expect(() => transactworldConfig()).toThrow();
    vi.stubEnv("TW_ALLOW_LOCAL_CHECKOUT", "yes");
    expect(transactworldConfig().appOrigin).toBe("http://127.0.0.1:3010");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => transactworldConfig()).toThrow();
    vi.stubEnv("TW_ENVIRONMENT", "live");
    expect(() => transactworldConfig()).toThrow();
    vi.stubEnv("TW_ENVIRONMENT", "liv");
    expect(() => transactworldConfig()).toThrow(/environment/);
  });
  it("validates distinct full-status returns and short-status notifications", () => {
    const c = requireTransactworldConfig();
    const signed = {
      paymentId: "123",
      merchantTransactionId: ref,
      amount: "12.34",
      currency: "EUR",
      status: "capturesuccess",
      transactionStatus: "Y",
      checksum: responseChecksum(c, "123", ref, "12.34", "capturesuccess"),
    };
    expect(verifyGatewayCallback(signed, ref, "return").signedStatus).toBe(
      "capturesuccess",
    );
    expect(() => verifyGatewayCallback(signed, ref, "notify")).toThrow(
      /signature/,
    );
    const notify = {
      ...signed,
      checksum: responseChecksum(c, "123", ref, "12.34", "Y"),
    };
    expect(verifyGatewayCallback(notify, ref, "notify").paymentId).toBe("123");
    for (const patch of [
      { amount: "99.00" },
      { paymentId: "456" },
      { transactionStatus: "N" },
      { checksum: "bad" },
      { merchantTransactionId: "a".repeat(64) },
    ])
      expect(() =>
        verifyGatewayCallback({ ...notify, ...patch }, ref, "notify"),
      ).toThrow();
  });
  it("blocks deceptive gateway URLs before browser submission", () => {
    for (const url of [
      "https://sandbox.transactworld.com.evil.com/transaction/Checkout",
      "https://sandbox.transactworld.com/evil",
      "https://user@sandbox.transactworld.com/transaction/Checkout",
      "http://sandbox.transactworld.com/transaction/Checkout",
      "https://sandbox.transactworld.com:444/transaction/Checkout",
    ])
      expect(() =>
        validatePaymentRedirect({ url, method: "POST", fields: {} }),
      ).toThrow();
  });
  it("uses the trusted Netlify connection IP in preference to supplied forwarded headers", () => {
    expect(
      shopperIp(
        new Request("https://store.example.com", {
          headers: {
            "x-nf-client-connection-ip": "203.0.113.3",
            "x-forwarded-for": "192.0.2.3",
          },
        }),
      ),
    ).toBe("203.0.113.3");
    vi.stubEnv("NODE_ENV", "production");
    expect(shopperIp(new Request("https://store.example.com"))).toBe("");
  });
  it("signs authenticated Inquiry and refuses malformed or redirected responses", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentId: "123",
          merchantTransactionId: ref,
          amount: "12.34",
          currency: "EUR",
          status: "capturesuccess",
          transactionStatus: "Y",
        }),
      ),
    );
    expect((await inquirePayment("123")).status).toBe("capturesuccess");
    const init = fetch.mock.calls[0][1]!;
    expect(init.redirect).toBe("error");
    expect(
      new URLSearchParams(init.body as URLSearchParams).get(
        "authentication.checksum",
      ),
    ).toBe(
      createHash("md5").update("1000|unit-test-key-only|123").digest("hex"),
    );
    fetch.mockResolvedValueOnce(new Response("{}"));
    await expect(inquirePayment("123")).rejects.toMatchObject({ status: 503 });
  });
  it("deduplicates token requests, refreshes before expiry, and never returns provider errors containing secrets", async () => {
    let now = 0;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ AuthToken: "issued-token" })),
      );
    const tokens = createGatewayTokenManager(fetcher, () => now);
    const c = { ...requireTransactworldConfig(), authToken: "" };
    expect(await Promise.all([tokens(c), tokens(c)])).toEqual([
      "issued-token",
      "issued-token",
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 56 * 60000;
    expect(await tokens(c)).toBe("issued-token");
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValueOnce(
      new Response(`secret ${c.workingKey}`, { status: 401 }),
    );
    await expect(tokens(c, true)).rejects.toThrow("Payment remains pending");
  });
});
