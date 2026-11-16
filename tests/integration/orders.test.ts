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
import { getCatalog } from "@/lib/catalog";
import { canAccessOrder, createOrderToken } from "@/lib/order-access";
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route";
import { POST as adminMutation } from "@/app/api/admin/route";
import { HttpError } from "@/lib/http";
import {
  reconcileSupplierOrder,
  authorizeSupplierRetry,
} from "@/lib/orders/reconcile-supplier";
const mocks = vi.hoisted(() => ({
  useRealProvider: false,
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
  getPaymentProvider: () => ({
    createCheckout: async (input: { orderId: string }) => ({
      id: `cs_test_${input.orderId}`,
      url: `https://checkout.stripe.com/test/${input.orderId}`,
    }),
    getCheckout: async (id: string) => ({
      id,
      url: `https://checkout.stripe.com/test/${id}`,
    }),
  }),
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
describe("payment and fulfillment with a real PostgreSQL engine", () => {
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
