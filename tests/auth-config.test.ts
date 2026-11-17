import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authSettings } from "@/lib/auth-config";
const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
beforeEach(() => keys.forEach((key) => vi.stubEnv(key, "")));
afterEach(() => vi.unstubAllEnvs());
const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
describe("Supabase account configuration", () => {
  it("accepts the modern publishable setting and legacy anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_unit_only",
    );
    expect(authSettings()).toEqual({
      url: "https://project.supabase.co",
      key: "sb_publishable_unit_only",
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt("anon"));
    expect(authSettings()?.key).toBe(jwt("anon"));
  });
  it("supports server-side aliases without using privileged credentials", () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", jwt("service_role"));
    expect(authSettings()).toBeNull();
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_server_only");
    expect(authSettings()?.key).toBe("sb_publishable_server_only");
  });
  it("rejects secret keys, service-role JWTs and malformed URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    for (const key of [
      "sb_secret_never_public",
      jwt("service_role"),
      "eyJbad",
      "not-a-project-key",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
      expect(authSettings()).toBeNull();
    }
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_unit_only",
    );
    for (const url of [
      "http://project.supabase.co",
      "https://user@project.supabase.co",
      "https://project.supabase.co/path",
      "bad-url",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      expect(authSettings()).toBeNull();
    }
  });
});
