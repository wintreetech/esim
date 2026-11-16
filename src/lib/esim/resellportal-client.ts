import "server-only";
import { z } from "zod";
import { ProviderError } from "./types";
import {
  requireOrderMode,
  requireResellPortalCredentials,
  resellPortalTestMode,
} from "./config";

const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

async function responseJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length") || 0) > MAX_RESPONSE_BYTES)
    throw new Error("Response too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export class ResellPortalClient {
  async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    return this.request(path, schema);
  }

  async post<T>(
    path: string,
    schema: z.ZodType<T>,
    input: Record<string, unknown>,
  ): Promise<T> {
    requireOrderMode();
    return this.request(path, schema, {
      ...input,
      skip_client_email: true,
      test_mode: resellPortalTestMode(),
    });
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const { key, secret, base } = requireResellPortalCredentials();
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new ProviderError("RESELLPORTAL_INVALID_PATH", false);
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-Key": key,
          "X-API-Secret": secret,
          ...(body && resellPortalTestMode() ? { "X-RP-Test-Mode": "1" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(25000),
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      // A timed-out POST could already have charged the wallet. Callers must reconcile,
      // not repeat a non-idempotent request. Never log credentials or upstream bodies.
      throw new ProviderError(
        body ? "RESELLPORTAL_OUTCOME_UNKNOWN" : "RESELLPORTAL_UNAVAILABLE",
        !body,
        Boolean(body),
      );
    }
    if (!response.ok) {
      const rejected = [400, 401, 403, 404, 422, 429].includes(response.status);
      throw new ProviderError(
        `RESELLPORTAL_HTTP_${response.status}`,
        !body && (response.status === 429 || response.status >= 500),
        Boolean(body) && !rejected,
      );
    }
    try {
      const raw = await responseJson(response);
      if (
        typeof raw === "object" &&
        raw !== null &&
        "success" in raw &&
        raw.success === false
      )
        throw new ProviderError("RESELLPORTAL_REQUEST_REJECTED", false);
      return schema.parse(raw);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        body ? "RESELLPORTAL_OUTCOME_UNKNOWN" : "RESELLPORTAL_RESPONSE_INVALID",
        !body,
        Boolean(body),
      );
    }
  }
}
