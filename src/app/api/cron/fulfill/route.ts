import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runJobs } from "@/lib/orders/provision";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { cleanupCheckouts } from "@/lib/orders/cleanup";
export const maxDuration = 300;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
      ? Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
      : null,
    actual = Buffer.from(request.headers.get("authorization") || "");
  if (
    !expected ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runJobs(2);
    await cleanupCheckouts();
    await db().rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
