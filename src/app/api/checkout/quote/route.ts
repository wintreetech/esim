import { NextResponse } from "next/server";
import { jsonBody, sameOrigin, apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { quoteSchema } from "@/lib/validators/checkout";
import { quoteOrder, publicQuote } from "@/lib/orders/quote";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "quote", 40);
    return NextResponse.json(
      publicQuote(await quoteOrder(await jsonBody(request, quoteSchema))),
    );
  } catch (error) {
    return apiError(error);
  }
}
