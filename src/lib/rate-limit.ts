import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http";
export async function rateLimit(
  request: Request,
  bucket: string,
  max = 15,
  windowSeconds = 60,
) {
  // Vercel overwrites x-vercel-forwarded-for. Self-hosting must overwrite x-forwarded-for at the trusted proxy.
  const ip = (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    "local"
  )
    .split(",")[0]
    .trim();
  const hash = createHash("sha256").update(`${bucket}:${ip}`).digest("hex");
  const key = `${hash}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const count = await db().rateLimit.upsert({
    where: { key },
    create: {
      key,
      count: 1,
      expiresAt: new Date(Date.now() + windowSeconds * 2000),
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  if (count.count > max)
    throw new HttpError(
      429,
      "Too many requests. Please wait a moment and try again.",
    );
}
