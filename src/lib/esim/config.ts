import "server-only";
import { ProviderError } from "./types";

export const RESELLPORTAL_PROVIDER = "resellportal";
export const RESELLPORTAL_BASE_URL =
  "https://panel.resellportal.com/wp-json/resellportal/v1";

export function providerName() {
  const name = process.env.ESIM_PROVIDER || RESELLPORTAL_PROVIDER;
  if (name !== RESELLPORTAL_PROVIDER)
    throw new ProviderError("LEGACY_PROVIDER_DISABLED", false);
  return name;
}

export function resellPortalConfigured() {
  return Boolean(
    process.env.RESELLPORTAL_API_KEY?.trim() &&
    process.env.RESELLPORTAL_API_SECRET?.trim(),
  );
}

export function resellPortalTestMode() {
  // Missing or misspelled configuration must never enable wallet charges.
  return process.env.RESELLPORTAL_TEST_MODE !== "false";
}

export function requireResellPortalCredentials() {
  const key = process.env.RESELLPORTAL_API_KEY?.trim();
  const secret = process.env.RESELLPORTAL_API_SECRET?.trim();
  if (!key || !secret)
    throw new ProviderError("RESELLPORTAL_NOT_CONFIGURED", false);
  const base = process.env.RESELLPORTAL_BASE_URL || RESELLPORTAL_BASE_URL;
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "panel.resellportal.com" ||
    (url.port && url.port !== "443") ||
    url.pathname.replace(/\/$/, "") !== "/wp-json/resellportal/v1" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new ProviderError("RESELLPORTAL_INVALID_BASE_URL", false);
  }
  return { key, secret, base: base.replace(/\/$/, "") };
}

export function requireOrderMode() {
  if (
    !resellPortalTestMode() &&
    process.env.RESELLPORTAL_ALLOW_LIVE_ORDERS !== "true"
  ) {
    throw new ProviderError("RESELLPORTAL_LIVE_ORDERS_DISABLED", false);
  }
}
