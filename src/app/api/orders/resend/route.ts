import { after, NextResponse } from "next/server";
import { z } from "zod";
import { jsonBody, sameOrigin, apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requestOrderEmail } from "@/lib/orders/resend-email";
import { runJobs } from "@/lib/orders/provision";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "order-email-resend", 5, 300);
    const { orderId } = await jsonBody(
      request,
      z.object({ orderId: z.string().min(1).max(150) }).strict(),
    );
    await requestOrderEmail(orderId);
    after(async () => {
      await runJobs(1, { orderId, kind: "EMAIL" });
    });
    return NextResponse.json(
      {
        message:
          "Another installation email has been queued for the address used at checkout. Please check your inbox and spam folder.",
      },
      { status: 202 },
    );
  } catch (error) {
    return apiError(error);
  }
}
