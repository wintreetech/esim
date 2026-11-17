import "server-only";
import { createHash } from "node:crypto";
import { HttpError } from "@/lib/http";
import type { TransactworldConfig } from "./transactworld-config";

export async function gatewayJson(response: Response): Promise<unknown> {
  if (!response.ok)
    throw new HttpError(
      503,
      "Payment verification is temporarily unavailable.",
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new HttpError(503, "Invalid payment verification response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new HttpError(503, "Invalid payment verification response.");
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(503, "Invalid payment verification response.");
  }
}

export function createGatewayTokenManager(
  fetcher: typeof fetch = (...args) => fetch(...args),
  now = Date.now,
) {
  const cache = new Map<
    string,
    { token?: string; expiresAt: number; pending?: Promise<string> }
  >();
  return async (c: TransactworldConfig, refresh = false): Promise<string> => {
    if (c.authToken) return c.authToken;
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          c.origin,
          c.memberId,
          c.workingKey,
          c.merchantUsername,
          c.partnerId,
        ]),
      )
      .digest("hex");
    const previous = cache.get(key);
    if (previous?.pending) return previous.pending;
    if (!refresh && previous?.token && previous.expiresAt > now())
      return previous.token;
    const row: {
      token?: string;
      expiresAt: number;
      pending?: Promise<string>;
    } = { expiresAt: 0 };
    cache.set(key, row);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    row.pending = (async () => {
      try {
        const response = await fetcher(
          `${c.origin}/transactionServices/REST/v1/authToken`,
          {
            method: "POST",
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              "authentication.memberId": c.memberId,
              "authentication.sKey": c.workingKey,
              ...(c.merchantUsername
                ? { "merchant.username": c.merchantUsername }
                : {}),
              ...(c.partnerId
                ? { "authentication.partnerId": c.partnerId }
                : {}),
            }),
          },
        );
        const data = (await gatewayJson(response)) as Record<string, unknown>;
        const token = data?.AuthToken ?? data?.authToken;
        if (
          typeof token !== "string" ||
          !/^[A-Za-z0-9._~+/-]+=*$/.test(token) ||
          token.length > 8192
        )
          throw new Error("Invalid token");
        row.token = token;
        row.expiresAt = now() + 55 * 60000;
        return token;
      } catch {
        if (cache.get(key) === row) cache.delete(key);
        throw new HttpError(
          503,
          "The gateway could not verify the merchant. Payment remains pending.",
        );
      } finally {
        row.pending = undefined;
      }
    })();
    return row.pending;
  };
}
export const gatewayAuthToken = createGatewayTokenManager();
