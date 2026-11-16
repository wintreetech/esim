import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { brand } from "./brand";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody(request: Request, limit = 16384) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new HttpError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function jsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await readBody(request);
  try {
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new HttpError(400, "Please check the information you entered.");
    throw new HttpError(400, "Invalid request body.");
  }
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(brand.url).origin)
    throw new HttpError(403, "This request is not allowed.");
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: "Please check your request." },
      { status: 400 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: "We couldn’t complete this request. Please try again shortly." },
    { status: 503 },
  );
}
