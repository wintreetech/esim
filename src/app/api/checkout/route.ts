import { NextResponse } from "next/server";
import { jsonBody, sameOrigin, apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/validators/checkout";
import { startCheckout } from "@/lib/orders/checkout";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "checkout", 10);
    return NextResponse.json(
      await startCheckout(await jsonBody(request, checkoutSchema)),
    );
  } catch (error) {
    return apiError(error);
  }
}
