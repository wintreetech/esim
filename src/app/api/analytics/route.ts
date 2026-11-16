import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonBody, sameOrigin, apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
const schema = z.object({
  event: z.enum(["destination_viewed", "plan_selected"]),
  planId: z.string().max(150).optional(),
  destination: z.string().max(100).optional(),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!process.env.ANALYTICS_ENDPOINT)
      return new NextResponse(null, { status: 204 });
    await rateLimit(request, "analytics", 60);
    const { event, ...properties } = await jsonBody(request, schema);
    await track(event, properties);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
