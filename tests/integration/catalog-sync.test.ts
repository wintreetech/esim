import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFile, readdir } from "node:fs/promises";
import net from "node:net";
import { Transform } from "node:stream";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { db } from "@/lib/db";
import { syncCatalog } from "@/lib/esim/sync";
import { destinationSeeds } from "@/lib/data/destinations";
import type { EsimPlan } from "@/lib/esim/types";

const supplier = vi.hoisted(() => ({ plans: [] as EsimPlan[], fail: false }));
vi.mock("@/lib/esim/provider", () => ({
  getProvider: () => ({
    getDestinations: async () => {
      const { isoCode, ...destination } = destinationSeeds.find(
        (d) => d.isoCode === "JP",
      )!;
      return [{ ...destination, code: isoCode }];
    },
    getPlans: async () => {
      if (supplier.fail) throw new Error("Supplier catalog unavailable");
      return supplier.plans;
    },
  }),
}));

let pg: PGlite,
  server: PGLiteSocketServer,
  proxy: net.Server,
  destinationId: string;
let responseDelayMs = 0;
const sockets = new Set<net.Socket>();

beforeAll(async () => {
  pg = await PGlite.create();
  for (const folder of (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((f) => f.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pg.exec(
      await readFile(`prisma/migrations/${folder.name}/migration.sql`, "utf8"),
    );
  server = new PGLiteSocketServer({
    db: pg,
    host: "127.0.0.1",
    port: 0,
    maxConnections: 10,
  });
  await server.start();
  const [host, port] = server.getServerConn().split(":");
  proxy = net.createServer((socket) => {
    const upstream = net.connect({ host, port: Number(port) });
    sockets.add(socket);
    sockets.add(upstream);
    const delayed = new Transform({
      transform(chunk, _encoding, callback) {
        setTimeout(() => callback(null, chunk), responseDelayMs);
      },
    });
    socket.on("error", () => upstream.destroy());
    upstream.on("error", () => socket.destroy());
    socket.on("close", () => {
      sockets.delete(socket);
      upstream.destroy();
    });
    upstream.on("close", () => {
      sockets.delete(upstream);
      socket.destroy();
    });
    socket.pipe(upstream);
    upstream.pipe(delayed).pipe(socket);
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  vi.stubEnv(
    "DATABASE_URL",
    `postgresql://postgres:postgres@127.0.0.1:${(proxy.address() as net.AddressInfo).port}/postgres?sslmode=disable`,
  );
  vi.stubEnv("ESIM_PROVIDER", "resellportal");
  vi.stubEnv("MARKUP_PERCENT", "40");
  vi.stubEnv("FIXED_MARKUP_CENTS", "50");
  vi.stubEnv("MIN_MARGIN_CENTS", "100");
  const destination = await db().destination.create({
    data: destinationSeeds.find((d) => d.isoCode === "JP")!,
  });
  destinationId = destination.id;
}, 30000);

beforeEach(async () => {
  responseDelayMs = 0;
  supplier.fail = false;
  supplier.plans = Array.from({ length: 120 }, (_, i) => ({
    id: `fixture-${i}`,
    destinationCode: "JP",
    name: `Fixture Japan plan ${i}`,
    dataAmountMB: 1024,
    dataLabel: "1 GB",
    validityDays: 7,
    network: null,
    speed: i % 2 ? "4G/5G" : null,
    coverage: i % 2 ? ["JP"] : [],
    supports5G: i % 2 ? true : null,
    supportsHotspot: null,
    supportsTopup: false,
    wholesalePrice: 300,
    currency: "USD",
  }));
  await db().auditLog.deleteMany();
  await db().plan.deleteMany();
});

afterAll(async () => {
  responseDelayMs = 0;
  await db().$disconnect();
  for (const socket of sockets) socket.destroy();
  if (proxy) await new Promise<void>((resolve) => proxy.close(() => resolve()));
  await server?.stop();
  await pg?.close();
  vi.unstubAllEnvs();
});

function seedPlan(
  supplierPlanId: string,
  extra: { active?: boolean; retailOverride?: number; provider?: string } = {},
) {
  return db().plan.create({
    data: {
      destinationId,
      supplierPlanId,
      provider: "resellportal",
      name: "Existing plan",
      dataAmountMB: 512,
      dataLabel: "512 MB",
      validityDays: 1,
      wholesalePrice: 100,
      retailPrice: 250,
      ...extra,
    },
  });
}

describe("atomic catalog import over PostgreSQL", () => {
  it("syncs 120 plans over a delayed connection while preserving IDs, overrides, hidden plans and margin protection", async () => {
    const stale = await seedPlan("stale");
    const hidden = await seedPlan("fixture-0", { active: false });
    const safe = await seedPlan("fixture-1", { retailOverride: 1000 });
    const unsafe = await seedPlan("fixture-2", { retailOverride: 200 });
    const otherProvider = await seedPlan("foreign", {
      provider: "legacy-fixture",
    });
    supplier.plans[3].name = 'Japan\'; DROP TABLE "Plan"; --';
    responseDelayMs = 150;

    // Confirm this connection reproduces the default five-second failure for
    // sequential queries, then exercise the import against the same latency.
    await expect(
      db().$transaction(async (tx) => {
        for (let i = 0; i < 50; i++) await tx.plan.count();
      }),
    ).rejects.toMatchObject({ code: "P2028" });

    expect(await syncCatalog()).toEqual({
      destinations: 1,
      plans: 120,
      deactivatedPlans: 1,
    });
    responseDelayMs = 0;
    expect(await db().plan.count({ where: { provider: "resellportal" } })).toBe(
      121,
    );
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: hidden.id } }),
    ).toMatchObject({
      active: false,
      dataAmountMB: 1024,
      retailOverride: null,
    });
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: safe.id } }),
    ).toMatchObject({
      active: true,
      retailOverride: 1000,
      coverage: ["JP"],
      supports5G: true,
    });
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: unsafe.id } }),
    ).toMatchObject({
      active: false,
      retailOverride: 200,
      wholesalePrice: 300,
    });
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: stale.id } }),
    ).toMatchObject({ active: false });
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: otherProvider.id } }),
    ).toMatchObject({ active: true });
    expect(
      await db().auditLog.count({
        where: { action: "PLAN_MARGIN_REVIEW_REQUIRED", detail: unsafe.id },
      }),
    ).toBe(1);
    const literal = await db().plan.findUniqueOrThrow({
      where: {
        provider_supplierPlanId: {
          provider: "resellportal",
          supplierPlanId: "fixture-3",
        },
      },
    });
    expect(literal.name).toBe(supplier.plans[3].name);
    expect(literal.retailPrice).toBe(470);
    expect(await syncCatalog()).toEqual({
      destinations: 1,
      plans: 120,
      deactivatedPlans: 0,
    });
    expect(await db().plan.count({ where: { provider: "resellportal" } })).toBe(
      121,
    );
    expect(
      (await db().plan.findUniqueOrThrow({ where: { id: safe.id } })).createdAt,
    ).toEqual(safe.createdAt);
  });

  it("rolls back earlier batches and leaves stale stock active if a later batch fails", async () => {
    const stale = await seedPlan("stale");
    const original = await seedPlan("fixture-0");
    supplier.plans[110].dataAmountMB = 2 ** 31; // PostgreSQL Int overflow in the second batch.
    await expect(syncCatalog()).rejects.toThrow();
    expect(await db().plan.count()).toBe(2);
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: stale.id } }),
    ).toMatchObject({ active: true });
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: original.id } }),
    ).toMatchObject({ name: "Existing plan", dataAmountMB: 512 });
    expect(await db().auditLog.count()).toBe(0);
  });

  it("preserves inventory when the supplier cannot return the catalog", async () => {
    const stale = await seedPlan("stale");
    supplier.fail = true;
    await expect(syncCatalog()).rejects.toThrow("Supplier catalog unavailable");
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: stale.id } }),
    ).toMatchObject({ active: true });
  });

  it("retires absent plans when the supplier confirms an empty destination catalog", async () => {
    const stale = await seedPlan("stale");
    supplier.plans = [];
    expect(await syncCatalog()).toEqual({
      destinations: 1,
      plans: 0,
      deactivatedPlans: 1,
    });
    expect(
      await db().plan.findUniqueOrThrow({ where: { id: stale.id } }),
    ).toMatchObject({ active: false });
  });
});
