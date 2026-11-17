import { describe, expect, it, vi } from "vitest";
import { runScheduled } from "../netlify/lib/run-scheduled.mjs";
describe("Netlify scheduled workers", () => {
  const env = {
    CONTEXT: "production",
    CRON_SECRET: "unit-only-worker-secret-at-least-32-characters",
    URL: "https://site.netlify.app",
    NEXT_PUBLIC_APP_URL: "https://store.example.com",
  };
  const context = { deploy: { context: "production", published: true } };
  it("does no work in previews and never forwards a worker secret through redirects", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 202 }));
    expect(
      (
        await runScheduled(
          "/api/cron/payments",
          { deploy: { context: "deploy-preview", published: false } },
          env,
          fetcher,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await runScheduled(
          "/api/cron/payments",
          { deploy: { context: "production", published: false } },
          env,
          fetcher,
        )
      ).status,
    ).toBe(204);
    expect(fetcher).not.toHaveBeenCalled();
    await runScheduled("/api/cron/payments", context, env, fetcher);
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://site.netlify.app/api/cron/payments?background=1",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
  });
  it("fails closed for missing secrets, unknown paths, insecure URLs and failing workers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 503 }));
    for (const bad of [
      { ...env, CRON_SECRET: "" },
      { ...env, URL: "http://site.netlify.app" },
      { ...env, NEXT_PUBLIC_APP_URL: "https://user@store.example.com" },
    ])
      await expect(
        runScheduled("/api/cron/fulfill", context, bad, fetcher),
      ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      runScheduled("/api/admin", context, env, fetcher),
    ).rejects.toThrow();
    await expect(
      runScheduled("/api/cron/fulfill", context, env, fetcher),
    ).rejects.toThrow(/503/);
  });
});
