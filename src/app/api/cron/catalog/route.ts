import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { syncCatalog } from "@/lib/esim/sync";
import { apiError } from "@/lib/http";
export const maxDuration = 300;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
    ? Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
    : null;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (
    !expected ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (new URL(request.url).searchParams.get("background") === "1") {
      after(async () => {
        await syncCatalog();
      });
      return NextResponse.json({ accepted: true }, { status: 202 });
    }
    return NextResponse.json(await syncCatalog());
  } catch (error) {
    return apiError(error);
  }
}
