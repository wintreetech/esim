import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { db } from "@/lib/db";
import { MockEsimProvider } from "../fixtures/mock-esim-provider";
import { ProviderError } from "@/lib/esim/types";
import {
  confirmPayment,
  expireCheckout,
  recordRefund,
} from "@/lib/orders/payment-confirmation";
import { fulfillOrder, runJobs } from "@/lib/orders/provision";
import { startCheckout } from "@/lib/orders/checkout";
import { quoteOrder } from "@/lib/orders/quote";
import { checkoutSchema } from "@/lib/validators/checkout";
import { confirmedDevice } from "../fixtures/device-check";
import { getCatalog } from "@/lib/catalog";
import { canAccessOrder, createOrderToken } from "@/lib/order-access";
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route";
import { POST as adminMutation } from "@/app/api/admin/route";
import { HttpError } from "@/lib/http";
import {
  reconcileTransactworld,
  processTransactworldCallback,
} from "@/lib/payments/transactworld-confirmation";
import { responseChecksum, type Inquiry } from "@/lib/payments/transactworld";
import { requireTransactworldConfig } from "@/lib/payments/transactworld-config";
import { TransactworldPaymentProvider } from "@/lib/payments/transactworld-provider";
import { requestOrderEmail } from "@/lib/orders/resend-email";
import { accountOrders } from "@/lib/account-orders";
import {
  reconcileSupplierOrder,
  authorizeSupplierRetry,
} from "@/lib/orders/reconcile-supplier";
const mocks = vi.hoisted(() => ({
  useRealProvider: false,
  useRealPayment: false,
  fxAvailable: true,
  eurRate: 0.9,
  user: vi.fn(
    async (): Promise<{ id: string; email: string; role: string } | null> =>
      null,
  ),
  cookies: new Map<string, string>(),
  send: vi.fn(async () => {}),
  admin: vi.fn(async () => {
    throw new Error("uninitialized");
  }),
}));
vi.mock("@/lib/auth", () => ({
  getUser: mocks.user,
  requireAdmin: mocks.admin,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) =>
      mocks.cookies.has(key) ? { value: mocks.cookies.get(key) } : undefined,
  }),
}));
vi.mock("@/lib/email", () => ({ sendEsimEmail: mocks.send }));
vi.mock("@/lib/exchange-rates", () => ({
  getExchangeRates: vi.fn(async () => ({
    base: "USD",
    rates: { USD: 1, EUR: mocks.eurRate, AUD: 1.5 },
    source: "Frankfurter",
    rateDate: new Date().toISOString().slice(0, 10),
    checkedAt: new Date().toISOString(),
    status: mocks.fxAvailable ? "current" : "unavailable",
  })),
}));
vi.mock("@/lib/esim/provider", async () => {
  const { MockEsimProvider } = await import("../fixtures/mock-esim-provider");
  const { ResellPortalProvider } =
    await import("@/lib/esim/resellportal-provider");
  return {
    getProvider: () =>
      mocks.useRealProvider
        ? new ResellPortalProvider()
        : new MockEsimProvider(),
  };
});
vi.mock("@/lib/payments/provider", () => ({
  getPaymentProvider: () =>
    mocks.useRealPayment
      ? new TransactworldPaymentProvider()
      : {
          createCheckout: async (input: { orderId: string }) => ({
            id: `cs_test_${input.orderId}`,
            url: `https://checkout.stripe.com/test/${input.orderId}`,
          }),
          getCheckout: async (id: string) => ({
            id,
            url: `https://checkout.stripe.com/test/${id}`,
          }),
        },
}));
let pg: PGlite, server: PGLiteSocketServer, planId: string;
beforeAll(async () => {
  pg = await PGlite.create();
  for (const folder of (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((f) => f.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pg.exec(
      await readFile(`prisma/migrations/${folder.name}/migration.sql`, "utf8"),
    );
  }
  server = new PGLiteSocketServer({
    db: pg,
    port: 0,
    host: "127.0.0.1",
    maxConnections: 10,
  });
  await server.start();
  vi.stubEnv(
    "DATABASE_URL",
    `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`,
  );
  vi.stubEnv("ESIM_PROVIDER", "resellportal");
  vi.stubEnv("RESELLPORTAL_API_KEY", "integration-key");
  vi.stubEnv("RESELLPORTAL_API_SECRET", "integration-secret");
  vi.stubEnv("RESELLPORTAL_TEST_MODE", "true");
  vi.stubEnv(
    "ORDER_ACCESS_SECRET",
    "integration-only-secret-at-least-32-characters",
  );
  vi.stubEnv("RESEND_API_KEY", "re_integration_fake");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("PAYMENTS_ENABLED", "yes");
  vi.stubEnv("EMAIL_FROM", "Roamly <hello@example.com>");
  vi.stubEnv(
    "CRON_SECRET",
    "integration-only-worker-secret-at-least-32-characters",
  );
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  const provider = new MockEsimProvider();
  for (const d of await provider.getDestinations()) {
    const destination = await db().destination.create({
      data: {
        name: d.name,
        slug: d.slug,
        isoCode: d.code,
        region: d.region,
        flagEmoji: d.flagEmoji,
        imageUrl: d.imageUrl,
        description: d.description,
      },
    });
    for (const p of await provider.getPlans(d.code)) {
      const row = await db().plan.create({
        data: {
          destinationId: destination.id,
          provider: "resellportal",
          supplierPlanId: p.id,
          name: p.name,
          dataAmountMB: p.dataAmountMB,
          dataLabel: p.dataLabel,
          validityDays: p.validityDays,
          network: p.network,
          supports5G: p.supports5G,
          supportsHotspot: p.supportsHotspot,
          supportsTopup: true,
          wholesalePrice: p.wholesalePrice,
          retailPrice: Math.max(1000, p.wholesalePrice + 100),
        },
      });
      if (!planId) planId = row.id;
    }
  }
}, 30000);
afterAll(async () => {
  await db().$disconnect();
  await server?.stop();
  await pg?.close();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  mocks.useRealProvider = false;
  mocks.useRealPayment = false;
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("PAYMENTS_ENABLED", "yes");
  vi.stubEnv("RESELLPORTAL_TEST_MODE", "true");
  vi.stubEnv("RESELLPORTAL_ALLOW_LIVE_ORDERS", "false");
  mocks.fxAvailable = true;
  mocks.eurRate = 0.9;
  vi.restoreAllMocks();
  mocks.user.mockResolvedValue(null);
  mocks.cookies.clear();
  mocks.send.mockClear();
  mocks.admin.mockRejectedValue(new HttpError(401, "Sign in required."));
});
async function pendingOrder() {
  const key = randomUUID();
  await startCheckout(
    checkoutSchema.parse({
      email: "traveler@example.com",
      planIds: [planId],
      currency: "USD",
      idempotencyKey: key,
      acceptedTerms: true,
      deviceCheck: confirmedDevice(),
    }),
  );
  return db().order.findUniqueOrThrow({ where: { checkoutKey: key } });
}
function payment(
  o: Awaited<ReturnType<typeof pendingOrder>>,
  eventId = `evt_${randomUUID()}`,
) {
  return {
    eventId,
    eventType: "checkout.session.completed",
    orderId: o.id,
    sessionId: o.checkoutSessionId!,
    transactionId: `pi_${o.id}`,
    amount: o.total,
    currency: o.currency,
  };
}
describe("TransactWorld checkout and independently verified capture", () => {
  let paymentSequence = 900000;
  beforeEach(() => {
    mocks.useRealPayment = true;
    for (const [key, value] of Object.entries({
      PAYMENT_PROVIDER: "transactworld",
      MEMBER_ID: "1000",
      WORKING_KEY: "integration-only-working-key",
      TW_ENVIRONMENT: "sandbox",
      TW_SUPPORTED_CURRENCIES: "USD,EUR,AUD",
      TW_AUTH_TOKEN: "integration-only-token",
      NEXT_PUBLIC_APP_URL: "https://store.example.com",
      RESELLPORTAL_TEST_MODE: "yes",
      RESELLPORTAL_ALLOW_LIVE_ORDERS: "no",
    }))
      vi.stubEnv(key, value);
  });
  async function twOrder(currency: "USD" | "EUR" | "AUD" = "USD") {
    const key = randomUUID();
    const quote = await quoteOrder({ planIds: [planId], currency });
    const input = checkoutSchema.parse({
      email: "gateway@example.com",
      planIds: [planId],
      currency,
      expectedTotal: quote.total,
      idempotencyKey: key,
      acceptedTerms: true,
      deviceCheck: confirmedDevice(),
    });
    const form = await startCheckout(input, "203.0.113.10");
    const order = await db().order.findUniqueOrThrow({
      where: { checkoutKey: key },
    });
    return { order, form, input };
  }
  function verified(
    order: Awaited<ReturnType<typeof twOrder>>["order"],
    patch = {},
  ) {
    return {
      paymentId: String(++paymentSequence),
      merchantTransactionId: order.checkoutSessionId!.slice(5),
      amount: (order.total / 100).toFixed(2),
      currency: order.currency,
      status: "capturesuccess",
      transactionStatus: "Y" as const,
      refundamount: "0.00",
      chargebackamount: "0.00",
      ...patch,
    };
  }
  it("returns a real signed hosted form and keeps retry reference, currency and locked amount stable", async () => {
    const { order, form, input } = await twOrder("EUR");
    expect(form.method).toBe("POST");
    expect(form.url).toBe(
      "https://sandbox.transactworld.com/transaction/Checkout",
    );
    expect(form.fields).toMatchObject({
      email: "gateway@example.com",
      currency: "EUR",
      amount: (order.total / 100).toFixed(2),
    });
    expect(JSON.stringify(form)).not.toContain("integration-only-working-key");
    mocks.eurRate = 0.95;
    const retry = await startCheckout(input, "203.0.113.11");
    expect(retry.fields?.merchantTransactionId).toBe(
      form.fields?.merchantTransactionId,
    );
    expect(retry.fields?.amount).toBe(form.fields?.amount);
    expect(
      await db().fulfillmentJob.count({ where: { orderId: order.id } }),
    ).toBe(0);
  });
  it("rejects an unapproved payment currency before reserving an order or coupon", async () => {
    vi.stubEnv("TW_SUPPORTED_CURRENCIES", "USD,EUR");
    const count = await db().order.count();
    await expect(twOrder("AUD")).rejects.toMatchObject({ status: 400 });
    expect(await db().order.count()).toBe(count);
  });
  it("rejects invalid merchant authentication before creating a payable order", async () => {
    vi.stubEnv("TW_AUTH_TOKEN", "");
    vi.stubEnv("WORKING_KEY", `unverified-${randomUUID()}`);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ paymentId: null, result: { code: 20016 } }),
      ),
    );
    const count = await db().order.count();
    await expect(twOrder()).rejects.toMatchObject({ status: 503 });
    expect(await db().order.count()).toBe(count);
  });
  it("confirms duplicate and concurrent captures once and provisions only one eSIM", async () => {
    const { order } = await twOrder("AUD");
    const result = verified(order);
    const inquiry = vi.fn<Inquiry>().mockResolvedValue(result);
    await Promise.all([
      reconcileTransactworld(order.checkoutSessionId!, inquiry),
      reconcileTransactworld(order.checkoutSessionId!, inquiry),
    ]);
    expect(
      await db().payment.count({
        where: { orderId: order.id, provider: "transactworld" },
      }),
    ).toBe(1);
    expect(
      await db().fulfillmentJob.count({
        where: { orderId: order.id, kind: "PROVISION" },
      }),
    ).toBe(1);
    await fulfillOrder(order.id);
    await fulfillOrder(order.id);
    expect(await db().esim.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: order.id } }))
        .stripePaymentIntentId,
    ).toBeNull();
  });
  it("leaves preauthorization, pending and declined responses unfulfilled", async () => {
    for (const [status, transactionStatus] of [
      ["preauthsuccess", "Y"],
      ["pending", "P"],
      ["capturefailed", "N"],
    ] as const) {
      const { order } = await twOrder();
      await reconcileTransactworld(
        order.checkoutSessionId!,
        vi
          .fn<Inquiry>()
          .mockResolvedValue(verified(order, { status, transactionStatus })),
      );
      expect(await db().payment.count({ where: { orderId: order.id } })).toBe(
        0,
      );
      expect(
        await db().fulfillmentJob.count({ where: { orderId: order.id } }),
      ).toBe(0);
    }
  });
  it("rejects independently verified amount, currency, reference and provider-ID mismatches", async () => {
    const { order } = await twOrder();
    for (const patch of [
      { amount: "0.01" },
      { currency: "EUR" },
      { merchantTransactionId: "a".repeat(64) },
      { paymentId: "bad" },
    ]) {
      await expect(
        reconcileTransactworld(
          order.checkoutSessionId!,
          vi.fn<Inquiry>().mockResolvedValue(verified(order, patch)),
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      reconcileTransactworld(
        order.checkoutSessionId!,
        vi
          .fn<Inquiry>()
          .mockResolvedValue(verified(order, { paymentId: "123" })),
        "456",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db().payment.count({ where: { orderId: order.id } })).toBe(0);
  });
  it("requires authenticated Inquiry even for a signed successful hosted return and recovers after an outage", async () => {
    const { order, form } = await twOrder();
    const remote = verified(order);
    const c = requireTransactworldConfig();
    const body = {
      paymentId: remote.paymentId,
      merchantTransactionId: form.fields!.merchantTransactionId,
      amount: remote.amount,
      currency: remote.currency,
      status: "capturesuccess",
      checksum: responseChecksum(
        c,
        remote.paymentId,
        form.fields!.merchantTransactionId,
        remote.amount,
        "capturesuccess",
      ),
    };
    const request = () =>
      new Request("https://store.example.com/return", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("gateway unavailable"));
    await expect(
      processTransactworldCallback(
        request(),
        body.merchantTransactionId,
        "return",
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(await db().payment.count({ where: { orderId: order.id } })).toBe(0);
    fetch.mockImplementation(async () => new Response(JSON.stringify(remote)));
    await expect(
      processTransactworldCallback(
        request(),
        body.merchantTransactionId,
        "return",
      ),
    ).resolves.toMatchObject({ paid: true });
    await expect(
      processTransactworldCallback(
        request(),
        body.merchantTransactionId,
        "return",
      ),
    ).resolves.toMatchObject({ paid: true });
    expect(await db().payment.count({ where: { orderId: order.id } })).toBe(1);
  });
  it("does not trust short notification Y as captured funds", async () => {
    const { order, form } = await twOrder();
    const remote = verified(order, { status: "preauthsuccess" });
    const body = {
      paymentId: remote.paymentId,
      merchantTransactionId: form.fields!.merchantTransactionId,
      amount: remote.amount,
      transactionStatus: "Y",
      checksum: responseChecksum(
        requireTransactworldConfig(),
        remote.paymentId,
        form.fields!.merchantTransactionId,
        remote.amount,
        "Y",
      ),
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(remote)),
    );
    await processTransactworldCallback(
      new Request("https://store.example.com/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      body.merchantTransactionId,
      "notify",
    );
    expect(await db().payment.count({ where: { orderId: order.id } })).toBe(0);
  });
  it("rejects forged callbacks before performing Inquiry", async () => {
    const { order, form } = await twOrder();
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(
      processTransactworldCallback(
        new Request("https://store.example.com/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: "123",
            merchantTransactionId: form.fields!.merchantTransactionId,
            amount: (order.total / 100).toFixed(2),
            transactionStatus: "Y",
            checksum: "0".repeat(32),
          }),
        }),
        form.fields!.merchantTransactionId,
        "notify",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never fulfills a fully refunded capture or a partial refund needing review", async () => {
    const { order } = await twOrder();
    const remote = verified(order);
    const inquiry = vi.fn<Inquiry>().mockResolvedValue({
      ...remote,
      refundamount: remote.amount,
      status: "refundsuccess",
    });
    await expect(
      reconcileTransactworld(order.checkoutSessionId!, inquiry),
    ).resolves.toMatchObject({ refunded: true });
    inquiry.mockResolvedValue(remote);
    await reconcileTransactworld(order.checkoutSessionId!, inquiry);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("REFUNDED");
    expect(
      await db().fulfillmentJob.count({
        where: { orderId: order.id, kind: "PROVISION" },
      }),
    ).toBe(0);
    const partial = await twOrder();
    await expect(
      reconcileTransactworld(
        partial.order.checkoutSessionId!,
        vi
          .fn<Inquiry>()
          .mockResolvedValue(verified(partial.order, { refundamount: "0.01" })),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("blocks a sandbox payment after a live environment switch and before any wallet or gateway call", async () => {
    const { order } = await twOrder();
    vi.stubEnv("TW_ENVIRONMENT", "live");
    const inquiry = vi.fn<Inquiry>();
    await expect(
      reconcileTransactworld(order.checkoutSessionId!, inquiry),
    ).rejects.toMatchObject({ status: 409 });
    expect(inquiry).not.toHaveBeenCalled();
  });
});
describe("Customer order history and email recovery", () => {
  async function readyOrder() {
    mocks.user.mockResolvedValue(null);
    const order = await pendingOrder();
    await confirmPayment(payment(order));
    await fulfillOrder(order.id);
    await db().order.update({
      where: { id: order.id },
      data: {
        emailRequestedAt: new Date(Date.now() - 61000),
        emailSentAt: new Date(Date.now() - 60000),
      },
    });
    await db().fulfillmentJob.updateMany({
      where: { orderId: order.id, kind: "EMAIL" },
      data: { status: "DONE" },
    });
    return order;
  }
  it("only lets the order owner or a valid guest link request an email", async () => {
    const order = await readyOrder();
    await expect(requestOrderEmail(order.id)).rejects.toMatchObject({
      status: 404,
    });
    mocks.user.mockResolvedValue({
      id: "stranger",
      email: "someone-else@example.com",
      role: "CUSTOMER",
    });
    await expect(requestOrderEmail(order.id)).rejects.toMatchObject({
      status: 404,
    });
    mocks.user.mockResolvedValue(null);
    mocks.cookies.set(`roamly_order_${order.id}`, createOrderToken(order.id));
    await requestOrderEmail(order.id);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: order.id } }))
        .emailVersion,
    ).toBe(1);
  });
  it("queues one email for concurrent resend requests without provisioning another eSIM", async () => {
    const order = await readyOrder();
    mocks.user.mockResolvedValue({
      id: "verified-buyer",
      email: order.email,
      role: "CUSTOMER",
    });
    const purchase = vi.spyOn(MockEsimProvider.prototype, "createOrder");
    const results = await Promise.allSettled([
      requestOrderEmail(order.id),
      requestOrderEmail(order.id),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const stored = await db().order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(stored).toMatchObject({
      email: order.email,
      emailVersion: 1,
      status: "FULFILLED",
      emailSentAt: null,
    });
    await runJobs(1, { orderId: order.id, kind: "EMAIL" });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith(order.id);
    expect(purchase).not.toHaveBeenCalled();
    expect(await db().esim.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db().payment.count({ where: { orderId: order.id } })).toBe(1);
  });
  it("refuses email recovery for unpaid and refunded orders", async () => {
    const unpaid = await pendingOrder();
    mocks.user.mockResolvedValue({
      id: "buyer",
      email: unpaid.email,
      role: "CUSTOMER",
    });
    await expect(requestOrderEmail(unpaid.id)).rejects.toMatchObject({
      status: 409,
    });
    const refunded = await readyOrder();
    await recordRefund(`pi_${refunded.id}`, `resend-refund-${randomUUID()}`);
    mocks.user.mockResolvedValue({
      id: "buyer",
      email: refunded.email,
      role: "CUSTOMER",
    });
    await expect(requestOrderEmail(refunded.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("does not overwrite an email being delivered by a worker", async () => {
    const order = await readyOrder();
    mocks.user.mockResolvedValue({
      id: "buyer",
      email: order.email,
      role: "CUSTOMER",
    });
    await db().fulfillmentJob.updateMany({
      where: { orderId: order.id, kind: "EMAIL" },
      data: {
        status: "RUNNING",
        lockedUntil: new Date(Date.now() + 60000),
        lockToken: "owned-worker",
      },
    });
    await expect(requestOrderEmail(order.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: order.id } }))
        .emailVersion,
    ).toBe(0);
  });
  it("shows all guest and account purchases across pages without disclosing another buyer's orders", async () => {
    const email = `history-${randomUUID()}@example.com`;
    const user = await db().user.create({
      data: { authId: randomUUID(), email },
    });
    await db().order.createMany({
      data: Array.from({ length: 106 }, (_, index) => ({
        email: index === 105 ? "old-purchase-email@example.com" : email,
        userId: index === 105 ? user.id : null,
        status: "PENDING_PAYMENT",
        subtotal: 1000,
        total: 1000,
        checkoutKey: randomUUID(),
        checkoutFingerprint: randomUUID(),
      })),
    });
    const other = await pendingOrder();
    const first = await accountOrders(user, "1"),
      last = await accountOrders(user, "9999");
    expect(first.count).toBe(106);
    expect(first.orders).toHaveLength(20);
    expect(last).toMatchObject({ count: 106, pages: 6, page: 6 });
    expect(last.orders).toHaveLength(6);
    expect(first.orders.some((order) => order.id === other.id)).toBe(false);
    const ids = new Set<string>();
    for (let page = 1; page <= first.pages; page++)
      for (const order of (await accountOrders(user, String(page))).orders)
        ids.add(order.id);
    expect(ids.size).toBe(106);
  });
});
describe("payment and fulfillment with a real PostgreSQL engine", () => {
  it("records device confirmations as self-reports alongside the order", async () => {
    const order = await pendingOrder();
    const audit = await db().auditLog.findFirstOrThrow({
      where: { orderId: order.id, action: "DEVICE_CHECK_CONFIRMED" },
    });
    expect(JSON.parse(audit.detail!)).toMatchObject({
      model: "iPhone 13 Pro",
      esim: "yes",
      unlocked: "yes",
      source: "customer_self_report",
    });
  });
  it("runs the actual ResellPortal adapter through a paid database order without duplicate purchases", async () => {
    const plan = await db().plan.findFirstOrThrow({
      where: { destination: { isoCode: "US" } },
      include: { destination: true },
    });
    const oldCode = plan.supplierPlanId;
    await db().plan.update({
      where: { id: plan.id },
      data: { supplierPlanId: "PHAJHEAYP" },
    });
    const key = randomUUID();
    mocks.useRealProvider = true;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/clients"))
          return new Response(
            JSON.stringify({
              success: true,
              clients: [
                {
                  id: 123,
                  name: "Travel Guest",
                  email: "traveler@example.com",
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        if (url.endsWith("/orders") && init?.method === "POST")
          return new Response(
            JSON.stringify({
              success: true,
              service_id: "test_svc_contract789",
              would_charge: 1.8,
              esim_details: {
                qr_code_url: "https://panel.resellportal.com/qr/contract.png",
                activation_url:
                  "https://panel.resellportal.com/activate/contract",
                iccid: "8901234567890123456",
                esim_status: "AVAILABLE",
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        throw new Error("Unexpected supplier network call in test");
      });
    try {
      await startCheckout(
        checkoutSchema.parse({
          email: "traveler@example.com",
          planIds: [plan.id],
          currency: "USD",
          idempotencyKey: key,
          acceptedTerms: true,
          deviceCheck: confirmedDevice(),
        }),
      );
      const order = await db().order.findUniqueOrThrow({
        where: { checkoutKey: key },
      });
      await confirmPayment(payment(order));
      await fulfillOrder(order.id);
      await fulfillOrder(order.id);
      const esim = await db().esim.findFirstOrThrow({
        where: { orderId: order.id },
      });
      expect(esim).toMatchObject({
        providerEsimId: "test_svc_contract789",
        qrCodeUrl: "https://panel.resellportal.com/qr/contract.png",
        qrCodeData: null,
        testMode: true,
      });
      const requests = fetch.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith("/orders") && init?.method === "POST",
      );
      expect(requests).toHaveLength(1);
      expect(JSON.parse(String(requests[0][1]?.body))).toMatchObject({
        client_id: 123,
        product_key: "esim",
        package_code: "PHAJHEAYP",
        test_mode: true,
        skip_client_email: true,
      });
      expect(
        (await db().order.findUniqueOrThrow({ where: { id: order.id } }))
          .status,
      ).toBe("FULFILLED");
    } finally {
      await db().plan.update({
        where: { id: plan.id },
        data: { supplierPlanId: oldCode },
      });
      mocks.useRealProvider = false;
    }
  });
  it("quotes and locks EUR and AUD amounts using the server's reference rates", async () => {
    for (const currency of ["EUR", "AUD"] as const) {
      const q = await quoteOrder({ planIds: [planId], currency });
      const key = randomUUID();
      await startCheckout(
        checkoutSchema.parse({
          email: "currency@example.com",
          planIds: [planId],
          currency,
          expectedTotal: q.total,
          idempotencyKey: key,
          acceptedTerms: true,
          deviceCheck: confirmedDevice(),
        }),
      );
      const order = await db().order.findUniqueOrThrow({
        where: { checkoutKey: key },
        include: { items: true, auditLogs: true },
      });
      expect(order.currency).toBe(currency);
      expect(order.total).toBe(q.total);
      expect(order.items[0].unitPrice).toBe(q.items[0].unitPrice);
      const audit = order.auditLogs.find(
        (entry) => entry.action === "EXCHANGE_RATE_LOCKED",
      );
      expect(JSON.parse(audit!.detail!)).toMatchObject({
        currency,
        rate: q.rate,
        source: "Frankfurter",
      });
      mocks.eurRate = 1.1;
      // Retrying an existing checkout must not reprice an already-created order.
      await startCheckout(
        checkoutSchema.parse({
          email: "currency@example.com",
          planIds: [planId],
          currency,
          expectedTotal: q.total,
          idempotencyKey: key,
          acceptedTerms: true,
          deviceCheck: confirmedDevice(),
        }),
      );
      expect(
        (await db().order.findUniqueOrThrow({ where: { checkoutKey: key } }))
          .total,
      ).toBe(q.total);
      mocks.eurRate = 0.9;
    }
  });
  it("totals the individually rounded displayed item prices in a converted cart", async () => {
    mocks.eurRate = 0.9004;
    const plans = await db().plan.findMany({
      where: { retailPrice: 1000 },
      take: 2,
    });
    expect(plans).toHaveLength(2);
    const q = await quoteOrder({
      planIds: plans.map((p) => p.id),
      currency: "EUR",
    });
    expect(q.subtotal).toBe(1800);
    expect(q.subtotal).toBe(
      q.items.reduce((sum, item) => sum + item.unitPrice, 0),
    );
  });
  it("requires a review when the rate changes after the displayed quote", async () => {
    const q = await quoteOrder({ planIds: [planId], currency: "EUR" });
    const before = await db().order.count();
    mocks.eurRate = 1.1;
    await expect(
      startCheckout(
        checkoutSchema.parse({
          email: "currency@example.com",
          planIds: [planId],
          currency: "EUR",
          expectedTotal: q.total,
          idempotencyKey: randomUUID(),
          acceptedTerms: true,
          deviceCheck: confirmedDevice(),
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db().order.count()).toBe(before);
  });
  it("keeps USD checkout available and stops converted quotes when rates are unavailable", async () => {
    mocks.fxAvailable = false;
    await expect(
      quoteOrder({ planIds: [planId], currency: "EUR" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      (await quoteOrder({ planIds: [planId], currency: "USD" })).rate,
    ).toBe(1);
  });
  it("seeds the ten-destination catalog without exposing wholesale fields", async () => {
    const catalog = await getCatalog();
    expect(catalog).toHaveLength(10);
    expect(catalog.every((d) => d.plans.length === 4)).toBe(true);
    expect(JSON.stringify(catalog)).not.toMatch(
      /wholesale|supplierPlanId|retailOverride/,
    );
  });
  it("never fabricates plans when the database is unconfigured", async () => {
    const url = process.env.DATABASE_URL!;
    vi.stubEnv("DATABASE_URL", "");
    try {
      const catalog = await getCatalog();
      expect(catalog).toHaveLength(10);
      expect(catalog[0]).not.toHaveProperty("base");
      expect(catalog.every((d) => d.plans.length === 0)).toBe(true);
      expect(JSON.stringify(catalog)).not.toContain("wholesale");
    } finally {
      vi.stubEnv("DATABASE_URL", url);
    }
  });
  it("rejects an invalid or disabled plan", async () => {
    await expect(
      quoteOrder({ planIds: ["not-a-plan"], currency: "USD" }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("ignores frontend prices and creates an idempotent checkout", async () => {
    const key = randomUUID();
    const input = checkoutSchema.parse({
      email: "traveler@example.com",
      planIds: [planId],
      currency: "USD",
      idempotencyKey: key,
      acceptedTerms: true,
      deviceCheck: confirmedDevice(),
      price: 1,
      total: 1,
    });
    await Promise.all([startCheckout(input), startCheckout(input)]);
    const rows = await db().order.findMany({ where: { checkoutKey: key } });
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(1000);
    expect(
      await db().supplierOrder.count({
        where: { orderItem: { orderId: rows[0].id } },
      }),
    ).toBe(0);
  });
  it("does not provision an unpaid order", async () => {
    const o = await pendingOrder();
    await expect(fulfillOrder(o.id)).rejects.toMatchObject({
      code: "PAYMENT_NOT_CONFIRMED",
    });
    expect(await db().esim.count({ where: { orderId: o.id } })).toBe(0);
  });
  it("rejects amount mismatch without committing an event or payment", async () => {
    const o = await pendingOrder();
    const p = { ...payment(o), amount: 1 };
    await expect(confirmPayment(p)).rejects.toMatchObject({ status: 400 });
    expect(
      await db().webhookEvent.findUnique({ where: { id: p.eventId } }),
    ).toBe(null);
    expect(await db().payment.findUnique({ where: { orderId: o.id } })).toBe(
      null,
    );
  });
  it("deduplicates simultaneous webhook deliveries and distinct events for one payment", async () => {
    const o = await pendingOrder();
    const p = payment(o);
    const results = await Promise.allSettled([
      confirmPayment(p),
      confirmPayment(p),
    ]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    await confirmPayment(p);
    await confirmPayment({ ...p, eventId: `evt_${randomUUID()}` });
    expect(await db().payment.count({ where: { orderId: o.id } })).toBe(1);
    expect(
      await db().fulfillmentJob.count({
        where: { orderId: o.id, kind: "PROVISION" },
      }),
    ).toBe(1);
  });
  it("fulfills and stores one eSIM despite duplicate worker runs", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    const spy = vi.spyOn(MockEsimProvider.prototype, "createOrder");
    await Promise.all([runJobs(100), runJobs(100)]);
    await fulfillOrder(o.id);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("FULFILLED");
    expect(await db().esim.count({ where: { orderId: o.id } })).toBe(1);
    expect(
      await db().supplierOrder.count({
        where: { orderItem: { orderId: o.id } },
      }),
    ).toBe(1);
    const item = await db().orderItem.findFirstOrThrow({
      where: { orderId: o.id },
    });
    expect(
      spy.mock.calls.filter(([p]) => p.reference === `esim:${item.id}`),
    ).toHaveLength(1);
    expect(
      await db().fulfillmentJob.count({
        where: { orderId: o.id, kind: "EMAIL" },
      }),
    ).toBe(1);
  });
  it("retains payment and retries a supplier timeout with the same reference", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    const spy = vi
      .spyOn(MockEsimProvider.prototype, "createOrder")
      .mockRejectedValueOnce(new ProviderError("SUPPLIER_UNAVAILABLE"));
    await runJobs(100);
    const job = await db().fulfillmentJob.findUniqueOrThrow({
      where: { orderId_kind: { orderId: o.id, kind: "PROVISION" } },
    });
    expect(job.status).toBe("PENDING");
    expect(job.lastError).toBe("SUPPLIER_UNAVAILABLE");
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("PROVISIONING");
    expect(
      (await db().payment.findUniqueOrThrow({ where: { orderId: o.id } }))
        .status,
    ).toBe("PAID");
    const reference = (
      await db().supplierOrder.findFirstOrThrow({
        where: { orderItem: { orderId: o.id } },
      })
    ).reference;
    await db().fulfillmentJob.update({
      where: { id: job.id },
      data: { runAfter: new Date(0) },
    });
    await runJobs(100);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("FULFILLED");
    expect(
      spy.mock.calls.filter(([p]) => p.reference === reference),
    ).toHaveLength(2);
  });
  it("surfaces permanent supplier failure as a paid order needing attention", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    vi.spyOn(MockEsimProvider.prototype, "createOrder").mockRejectedValueOnce(
      new ProviderError("PLAN_RETIRED", false),
    );
    await runJobs(100);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("FAILED");
    expect(
      (
        await db().fulfillmentJob.findUniqueOrThrow({
          where: { orderId_kind: { orderId: o.id, kind: "PROVISION" } },
        })
      ).status,
    ).toBe("FAILED");
    expect(
      await db().auditLog.count({
        where: { orderId: o.id, action: "PROVISION_NEEDS_ATTENTION" },
      }),
    ).toBe(1);
  });
  it("never repeats an ambiguous non-idempotent supplier purchase, even after a manual retry", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    vi.spyOn(
      MockEsimProvider.prototype,
      "supportsIdempotentOrders",
      "get",
    ).mockReturnValue(false);
    const purchase = vi
      .spyOn(MockEsimProvider.prototype, "createOrder")
      .mockRejectedValueOnce(
        new ProviderError("RESELLPORTAL_OUTCOME_UNKNOWN", false, true),
      );
    await runJobs(100);
    const reservation = await db().supplierOrder.findFirstOrThrow({
      where: { orderItem: { orderId: o.id } },
    });
    expect(reservation.status).toBe("RECONCILE_REQUIRED");
    await expect(fulfillOrder(o.id)).rejects.toMatchObject({
      code: "SUPPLIER_RECONCILIATION_REQUIRED",
    });
    expect(
      purchase.mock.calls.filter(
        ([input]) => input.reference === reservation.reference,
      ),
    ).toHaveLength(1);
    expect(
      (await db().payment.findUniqueOrThrow({ where: { orderId: o.id } }))
        .status,
    ).toBe("PAID");
  });
  it("treats a crashed submission as uncertain instead of making another wallet purchase", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    const item = await db().orderItem.findFirstOrThrow({
      where: { orderId: o.id },
    });
    await db().supplierOrder.create({
      data: {
        orderItemId: item.id,
        provider: item.provider,
        reference: `esim:${item.id}`,
        status: "SUBMITTING",
      },
    });
    vi.spyOn(
      MockEsimProvider.prototype,
      "supportsIdempotentOrders",
      "get",
    ).mockReturnValue(false);
    const purchase = vi.spyOn(MockEsimProvider.prototype, "createOrder");
    await expect(fulfillOrder(o.id)).rejects.toMatchObject({
      code: "SUPPLIER_RECONCILIATION_REQUIRED",
    });
    expect(purchase).not.toHaveBeenCalled();
  });
  it("links a verified existing supplier service without another purchase", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    const item = await db().orderItem.findFirstOrThrow({
      where: { orderId: o.id },
    });
    await db().order.update({
      where: { id: o.id },
      data: { status: "FAILED" },
    });
    await db().supplierOrder.create({
      data: {
        orderItemId: item.id,
        provider: item.provider,
        reference: `esim:${item.id}`,
        clientId: "123",
        status: "RECONCILE_REQUIRED",
      },
    });
    const original = await new MockEsimProvider().getOrder("789");
    vi.spyOn(MockEsimProvider.prototype, "getOrder").mockResolvedValue({
      ...original,
      clientId: "123",
      packageCode: item.supplierPlanId,
    });
    const purchase = vi.spyOn(MockEsimProvider.prototype, "createOrder");
    await reconcileSupplierOrder(item.id, "789", "operator");
    await fulfillOrder(o.id);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("FULFILLED");
    expect(purchase).not.toHaveBeenCalled();
  });
  it("refuses to link another customer's supplier service", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    const item = await db().orderItem.findFirstOrThrow({
      where: { orderId: o.id },
    });
    await db().order.update({
      where: { id: o.id },
      data: { status: "FAILED" },
    });
    await db().supplierOrder.create({
      data: {
        orderItemId: item.id,
        provider: item.provider,
        reference: `esim:${item.id}`,
        clientId: "123",
        status: "RECONCILE_REQUIRED",
      },
    });
    const original = await new MockEsimProvider().getOrder("789");
    vi.spyOn(MockEsimProvider.prototype, "getOrder").mockResolvedValue({
      ...original,
      clientId: "different-client",
      packageCode: item.supplierPlanId,
    });
    await expect(
      reconcileSupplierOrder(item.id, "789", "operator"),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await db().supplierOrder.findUniqueOrThrow({
          where: { orderItemId: item.id },
        })
      ).externalOrderId,
    ).toBeNull();
  });
  it("permits a new purchase only after the operator explicitly reconciles a no-purchase result", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    const item = await db().orderItem.findFirstOrThrow({
      where: { orderId: o.id },
    });
    await db().order.update({
      where: { id: o.id },
      data: { status: "FAILED" },
    });
    await db().supplierOrder.create({
      data: {
        orderItemId: item.id,
        provider: item.provider,
        reference: `esim:${item.id}`,
        status: "RECONCILE_REQUIRED",
      },
    });
    vi.spyOn(
      MockEsimProvider.prototype,
      "supportsIdempotentOrders",
      "get",
    ).mockReturnValue(false);
    const purchase = vi.spyOn(MockEsimProvider.prototype, "createOrder");
    await authorizeSupplierRetry(
      item.id,
      "Checked supplier services and wallet; no purchase exists.",
      "operator",
    );
    await fulfillOrder(o.id);
    expect(purchase).toHaveBeenCalledTimes(1);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("FULFILLED");
    expect(
      await db().auditLog.count({
        where: {
          orderId: o.id,
          action: "OPERATOR_CONFIRMED_NO_SUPPLIER_PURCHASE",
        },
      }),
    ).toBe(1);
  });
  it("never spends live supplier funds against a Stripe test payment", async () => {
    vi.stubEnv("RESELLPORTAL_TEST_MODE", "false");
    vi.stubEnv("RESELLPORTAL_ALLOW_LIVE_ORDERS", "true");
    try {
      await expect(pendingOrder()).rejects.toMatchObject({ status: 503 });
    } finally {
      vi.stubEnv("RESELLPORTAL_TEST_MODE", "true");
      vi.stubEnv("RESELLPORTAL_ALLOW_LIVE_ORDERS", "false");
    }
  });
  it("does not fulfill refunded orders", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    await recordRefund(`pi_${o.id}`, `evt_refund_${randomUUID()}`);
    await fulfillOrder(o.id);
    expect(await db().esim.count({ where: { orderId: o.id } })).toBe(0);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("REFUNDED");
  });
  it("releases coupon reservations once on checkout expiry", async () => {
    const code = `TEST_${randomUUID().slice(0, 8)}`.toUpperCase();
    const coupon = await db().coupon.create({
      data: { code, percentOff: 10, maxUses: 1 },
    });
    const key = randomUUID();
    await startCheckout(
      checkoutSchema.parse({
        email: "traveler@example.com",
        planIds: [planId],
        currency: "USD",
        coupon: code,
        idempotencyKey: key,
        acceptedTerms: true,
        deviceCheck: confirmedDevice(),
      }),
    );
    const o = await db().order.findUniqueOrThrow({
      where: { checkoutKey: key },
    });
    await expireCheckout(o.checkoutSessionId!);
    await expireCheckout(o.checkoutSessionId!);
    expect(
      (await db().coupon.findUniqueOrThrow({ where: { id: coupon.id } }))
        .usedCount,
    ).toBe(0);
  });
  it("requires the owner or a signed guest cookie to read order secrets", async () => {
    const o = await pendingOrder();
    expect(await canAccessOrder(o)).toBe(false);
    mocks.user.mockResolvedValue({
      id: "another",
      email: "wrong@example.com",
      role: "CUSTOMER",
    });
    expect(await canAccessOrder(o)).toBe(false);
    mocks.user.mockResolvedValue(null);
    mocks.cookies.set(`roamly_order_${o.id}`, createOrderToken(o.id));
    expect(await canAccessOrder(o)).toBe(true);
    mocks.cookies.clear();
    mocks.user.mockResolvedValue({
      id: "owner",
      email: o.email,
      role: "CUSTOMER",
    });
    expect(await canAccessOrder(o)).toBe(true);
  });
  it("rejects forged Stripe webhooks", async () => {
    const r = await stripeWebhook(
      new Request("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "forged" },
        body: '{"type":"checkout.session.completed"}',
      }),
    );
    expect(r.status).toBe(400);
  });
  it("rejects unauthenticated admin mutations", async () => {
    const r = await adminMutation(
      new Request("http://localhost:3000/api/admin", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "sync" }),
      }),
    );
    expect(r.status).toBe(401);
  });
  it("renders and sends a private QR email once through Resend", async () => {
    const o = await pendingOrder();
    await confirmPayment(payment(o));
    await fulfillOrder(o.id);
    await db().esim.updateMany({
      where: { orderId: o.id },
      data: { testMode: false },
    });
    vi.stubEnv("EMAIL_FROM", "Roamly <test@example.com>");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { sendEsimEmail } =
      await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    await sendEsimEmail(o.id);
    await sendEsimEmail(o.id);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = String(fetchSpy.mock.calls[0][1]?.body);
    expect(sent).toContain("Your travel eSIM is ready");
    expect(sent).toContain("cid:qr-");
    expect(sent).toContain("/api/orders/access?token=");
    expect(sent).not.toMatch(/wholesalePrice|SUPPLIER_HTTP/);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).emailSentAt,
    ).not.toBeNull();
  });
  it("preserves a full refund delivered before payment confirmation", async () => {
    const o = await pendingOrder();
    const p = payment(o);
    await recordRefund(p.transactionId, `evt_early_refund_${randomUUID()}`);
    await confirmPayment(p);
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("REFUNDED");
    expect(
      (await db().payment.findUniqueOrThrow({ where: { orderId: o.id } }))
        .status,
    ).toBe("REFUNDED");
    expect(
      await db().fulfillmentJob.count({
        where: { orderId: o.id, kind: "PROVISION" },
      }),
    ).toBe(0);
  });
  it("recovers a valid late payment after local checkout expiry", async () => {
    const o = await pendingOrder();
    await expireCheckout(o.checkoutSessionId!);
    await confirmPayment(payment(o));
    expect(
      (await db().order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("PAID");
    expect(
      await db().auditLog.count({
        where: { orderId: o.id, action: "LATE_PAYMENT_RECOVERED" },
      }),
    ).toBe(1);
  });
  it("applies a paid top-up once, bound to the owner and original SKU snapshot", async () => {
    vi.stubEnv("ENABLE_TOPUPS", "true");
    const original = await pendingOrder();
    await confirmPayment(payment(original));
    await fulfillOrder(original.id);
    const esim = await db().esim.findFirstOrThrow({
      where: { orderId: original.id },
    });
    mocks.cookies.set(
      `roamly_order_${original.id}`,
      createOrderToken(original.id),
    );
    const key = randomUUID();
    await startCheckout(
      checkoutSchema.parse({
        email: original.email,
        planIds: [planId],
        currency: "USD",
        idempotencyKey: key,
        acceptedTerms: true,
        deviceCheck: confirmedDevice(),
        topUpEsimId: esim.id,
      }),
    );
    const topupOrder = await db().order.findUniqueOrThrow({
      where: { checkoutKey: key },
    });
    expect(
      (await db().esim.findUniqueOrThrow({ where: { id: esim.id } }))
        .dataTotalMb,
    ).toBe(1024);
    await confirmPayment(payment(topupOrder));
    await fulfillOrder(topupOrder.id);
    await fulfillOrder(topupOrder.id);
    expect(
      (await db().esim.findUniqueOrThrow({ where: { id: esim.id } }))
        .dataTotalMb,
    ).toBe(2048);
    expect(
      (
        await db().topUp.findUniqueOrThrow({
          where: { orderId: topupOrder.id },
        })
      ).status,
    ).toBe("COMPLETED");
    mocks.cookies.clear();
    await expect(
      quoteOrder({ planIds: [planId], currency: "USD", topUpEsimId: esim.id }),
    ).rejects.toMatchObject({ status: 404 });
    vi.stubEnv("ENABLE_TOPUPS", "false");
  });
  it("runs the actual seed CLI twice without duplicating inventory or granting admin roles", async () => {
    for (let i = 0; i < 2; i++)
      await promisify(execFile)(
        process.execPath,
        ["--import", "tsx", "prisma/seed.ts"],
        { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL } },
      );
    expect(await db().destination.count()).toBe(10);
    expect(await db().plan.count()).toBe(40);
    expect(await db().plan.count({ where: { provider: "mock" } })).toBe(0);
    expect(await db().device.count()).toBe(7);
    expect(await db().user.count({ where: { role: "ADMIN" } })).toBe(0);
  });
});
