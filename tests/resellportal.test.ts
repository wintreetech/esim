import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { ResellPortalProvider } from "@/lib/esim/resellportal-provider";
import { ResellPortalClient } from "@/lib/esim/resellportal-client";
import {
  ResellPortalCatalog,
  normalizePackage,
} from "@/lib/esim/resellportal-catalog";
import { getProvider } from "@/lib/esim/provider";
import { esimQrImage } from "@/lib/esim/qr-image";
const pkg = {
  package_code: "JC063",
  name: "Japan 1GB 7Days",
  price: 1.3999999999999999,
  description: "Japan 1GB 7Days",
  location: "JP",
  data_volume: "1 GB",
  duration: "7 day",
  speed: "3G/4G/5G",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const testOrder = {
  success: true,
  service_id: "test_svc_789",
  test_mode: true,
  would_charge: 1.4,
  esim_details: {
    qr_code_url: "https://panel.resellportal.com/qr/789.png",
    activation_url: "https://panel.resellportal.com/activate/789",
    iccid: "8901234567890123456",
    esim_status: "AVAILABLE",
  },
};
beforeEach(() => {
  vi.stubEnv("RESELLPORTAL_API_KEY", "test-key-only");
  vi.stubEnv("RESELLPORTAL_API_SECRET", "test-secret-only");
  vi.stubEnv(
    "RESELLPORTAL_BASE_URL",
    "https://panel.resellportal.com/wp-json/resellportal/v1",
  );
  vi.stubEnv("ESIM_PROVIDER", "resellportal");
  vi.stubEnv("RESELLPORTAL_TEST_MODE", "true");
  vi.stubEnv("RESELLPORTAL_ALLOW_LIVE_ORDERS", "false");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("documented ResellPortal contract", () => {
  it("requires both server-only credentials and refuses legacy mock providers", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("RESELLPORTAL_API_SECRET", "");
    await expect(
      new ResellPortalClient().get("/balance", z.unknown()),
    ).rejects.toMatchObject({ code: "RESELLPORTAL_NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
    expect(() => getProvider("mock")).toThrow();
  });
  it("normalizes real wholesale dollars without inventing hotspot or network claims", () => {
    expect(normalizePackage(pkg)).toMatchObject({
      id: "JC063",
      wholesalePrice: 140,
      dataAmountMB: 1024,
      validityDays: 7,
      supports5G: true,
      supportsHotspot: null,
      network: null,
      supportsTopup: false,
    });
    expect(
      normalizePackage({ ...pkg, name: "Japan 1GB/Day FUP1Mbps" }),
    ).toBeNull();
    expect(normalizePackage({ ...pkg, data_volume: "Unlimited" })).toBeNull();
  });
  it("uses the documented headers and fetches a complete catalog only once", async () => {
    const europe = {
      ...pkg,
      package_code: "EU1",
      name: "Europe 1GB 7Days",
      location: "DE,FR,ES",
    };
    const fetch = vi.fn(async () =>
      json({ success: true, total_packages: 2, packages: [pkg, europe] }),
    );
    vi.stubGlobal("fetch", fetch);
    const catalog = new ResellPortalCatalog();
    await catalog.getDestinations();
    expect(await catalog.getPlans("JP")).toHaveLength(1);
    expect((await catalog.getPlans("EU"))[0].coverage).toEqual([
      "DE",
      "FR",
      "ES",
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://panel.resellportal.com/wp-json/resellportal/v1/esim-packages",
    );
    expect(init.headers).toMatchObject({
      "X-API-Key": "test-key-only",
      "X-API-Secret": "test-secret-only",
    });
    expect(init.headers).not.toHaveProperty("Authorization");
  });
  it("rejects incomplete inventory before sync can deactivate unseen packages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ success: true, total_packages: 60, packages: [pkg] }),
      ),
    );
    await expect(new ResellPortalCatalog().packages()).rejects.toMatchObject({
      code: "RESELLPORTAL_CATALOG_INCOMPLETE",
    });
  });
  it("creates a customer using only documented fields and discards portal credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ success: true, clients: [] }))
      .mockResolvedValueOnce(
        json({
          success: true,
          client_id: "test_cli_123",
          portal_credentials: { password: "must-not-be-stored" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const client = await new ResellPortalProvider().prepareOrder({
      supplierPlanId: "JC063",
      reference: "order-1",
      email: "traveler@example.com",
      firstName: "Travel",
      lastName: "Guest",
    });
    expect(client).toEqual({ clientId: "test_cli_123" });
    const body = JSON.parse(String(fetch.mock.calls[1][1].body));
    expect(body).toEqual({
      name: "Travel Guest",
      email: "traveler@example.com",
      send_setup_email: false,
      skip_client_email: true,
      test_mode: true,
    });
    expect(body).not.toHaveProperty("portal_password");
  });
  it("reuses the matching client without creating another account", async () => {
    const fetch = vi.fn(async () =>
      json({
        success: true,
        clients: [
          { id: 123, name: "Travel Guest", email: "traveler@example.com" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await new ResellPortalProvider().prepareOrder({
        supplierPlanId: "JC063",
        reference: "order-1",
        email: "traveler@example.com",
      }),
    ).toEqual({ clientId: "123" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("posts package_code and suppresses supplier email while keeping QR image semantics", async () => {
    const fetch = vi.fn(async () => json(testOrder));
    vi.stubGlobal("fetch", fetch);
    const order = await new ResellPortalProvider().createOrder({
      clientId: "123",
      supplierPlanId: "JC063",
      reference: "local-reservation",
      email: "traveler@example.com",
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/orders$/);
    expect(JSON.parse(String(init.body))).toEqual({
      client_id: 123,
      product_key: "esim",
      package_code: "JC063",
      skip_client_email: true,
      test_mode: true,
    });
    expect(init.headers).toMatchObject({ "X-RP-Test-Mode": "1" });
    expect(order).toMatchObject({
      orderId: "test_svc_789",
      qrCodeUrl: testOrder.esim_details.qr_code_url,
      qrCodeData: null,
      activationCode: null,
      testMode: true,
      status: "READY",
    });
  });
  it("never claims an undocumented remote idempotency guarantee", () =>
    expect(new ResellPortalProvider().supportsIdempotentOrders).toBe(false));
  it("blocks live wallet orders unless both mode flags are explicitly set", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("RESELLPORTAL_TEST_MODE", "false");
    await expect(
      new ResellPortalProvider().createOrder({
        clientId: "123",
        supplierPlanId: "JC063",
        reference: "id",
        email: "traveler@example.com",
      }),
    ).rejects.toMatchObject({ code: "RESELLPORTAL_LIVE_ORDERS_DISABLED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("marks timeouts and malformed POST responses as ambiguous, never automatically retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout with private upstream details");
      }),
    );
    await expect(
      new ResellPortalProvider().createOrder({
        clientId: "123",
        supplierPlanId: "JC063",
        reference: "id",
        email: "traveler@example.com",
      }),
    ).rejects.toMatchObject({
      code: "RESELLPORTAL_OUTCOME_UNKNOWN",
      outcomeUnknown: true,
      retryable: false,
    });
  });
  it("preserves exact byte-to-MB usage and timezone-aware expiry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          success: true,
          service_id: 456,
          usage: {
            status: "Active",
            esim_status: "IN_USE",
            total_bytes: 5368709120,
            used_bytes: 1234567890,
            expires_at: "2026-11-12T00:00:00+00:00",
          },
          cached_for_seconds: 300,
        }),
      ),
    );
    const usage = await new ResellPortalProvider().getUsage("456");
    expect(usage.dataTotalMb).toBe(5120);
    expect(usage.dataUsedMb).toBe(1234567890 / (1024 * 1024));
    expect(usage.expiresAt).toBe("2026-11-12T00:00:00.000Z");
  });
  it("does not invent usage when the carrier reports 409 or 503", async () => {
    for (const status of [409, 503]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          json({ message: "private carrier response" }, status),
        ),
      );
      await expect(
        new ResellPortalProvider().getUsage("456"),
      ).rejects.toMatchObject({ code: `RESELLPORTAL_HTTP_${status}` });
    }
  });
  it("safely reads a single documented esim_details object regardless of a transport wrapper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          success: true,
          service: {
            service_id: 789,
            client_id: 123,
            package: { code: "JC063" },
            esim_details: testOrder.esim_details,
          },
        }),
      ),
    );
    const order = await new ResellPortalProvider().getOrder("789");
    expect(order).toMatchObject({
      orderId: "789",
      clientId: "123",
      packageCode: "JC063",
      qrCodeData: null,
      status: "READY",
    });
  });
  it("refuses ambiguous service details or mismatched IDs", async () => {
    for (const body of [
      { success: true, service_id: 999, esim_details: testOrder.esim_details },
      {
        success: true,
        one: { esim_details: testOrder.esim_details },
        two: { esim_details: testOrder.esim_details },
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => json(body)),
      );
      await expect(
        new ResellPortalProvider().getOrder("789"),
      ).rejects.toMatchObject({ retryable: false });
    }
  });
  it("leaves undocumented top-up purchases disabled", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      new ResellPortalProvider().topUp({
        esimId: "789",
        supplierPlanId: "JC063",
        reference: "topup",
      }),
    ).rejects.toMatchObject({ code: "RESELLPORTAL_TOPUPS_NOT_SUPPORTED" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("private supplier QR images", () => {
  it("fetches and embeds the actual QR image rather than re-encoding its URL", async () => {
    const png = await import("qrcode").then((m) =>
      m.default.toBuffer("LPA:1$carrier.example$activation"),
    );
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array(png), {
          headers: { "Content-Type": "image/png" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const qr = await esimQrImage({
      qrCodeData: null,
      qrCodeUrl: "https://panel.resellportal.com/qr/789.png",
    });
    expect(qr.buffer.equals(png)).toBe(true);
    expect(qr.mime).toBe("image/png");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects unapproved hosts and URL-as-activation payloads before fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      esimQrImage({
        qrCodeData: null,
        qrCodeUrl: "https://not-allowed.example/qr.png",
      }),
    ).rejects.toMatchObject({ code: "ESIM_QR_HOST_NOT_ALLOWED" });
    await expect(
      esimQrImage({
        qrCodeData: "https://panel.resellportal.com/qr/789.png",
        qrCodeUrl: null,
      }),
    ).rejects.toMatchObject({ code: "ESIM_QR_PAYLOAD_INVALID" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
