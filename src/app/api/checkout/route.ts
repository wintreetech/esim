import { NextResponse } from "next/server";
import { jsonBody, sameOrigin, apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/validators/checkout";
import { startCheckout } from "@/lib/orders/checkout";
import { shopperIp } from "@/lib/payments/shopper-ip";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "checkout", 10);
    return NextResponse.json(
      await startCheckout(
        await jsonBody(request, checkoutSchema),
        shopperIp(request),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
