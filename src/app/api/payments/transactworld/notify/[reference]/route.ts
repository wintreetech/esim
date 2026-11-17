import { after, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { processTransactworldCallback } from "@/lib/payments/transactworld-confirmation";
import { runJobs } from "@/lib/orders/provision";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const result = await processTransactworldCallback(
      request,
      reference,
      "notify",
    );
    if (result.paid)
      after(async () => {
        await runJobs(2);
      });
    return NextResponse.json({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
