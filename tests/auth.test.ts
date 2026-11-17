import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { upsert: mocks.upsert } }) }));
import { getUser } from "@/lib/auth";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_unit_only",
  );
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/unit");
  mocks.getUser.mockReset();
  mocks.upsert.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("never authenticates an unverified email or user-editable admin metadata", async () => {
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: "auth1",
        email: "BUYER@example.com",
        email_confirmed_at: null,
        user_metadata: { role: "ADMIN" },
      },
    },
    error: null,
  });
  expect(await getUser()).toBeNull();
  expect(mocks.upsert).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: "auth1",
        email: "BUYER@example.com",
        email_confirmed_at: "2026-11-17",
        user_metadata: { role: "ADMIN" },
      },
    },
    error: null,
  });
  mocks.upsert.mockResolvedValue({
    id: "user1",
    role: "CUSTOMER",
    email: "buyer@example.com",
  });
  expect(await getUser()).toMatchObject({ role: "CUSTOMER" });
  expect(mocks.upsert.mock.calls[0][0]).toEqual({
    where: { authId: "auth1" },
    create: { authId: "auth1", email: "buyer@example.com" },
    update: { email: "buyer@example.com" },
  });
});
it("fails closed during an authentication outage", async () => {
  mocks.getUser.mockRejectedValue(new Error("provider unavailable"));
  expect(await getUser()).toBeNull();
  expect(mocks.upsert).not.toHaveBeenCalled();
});
