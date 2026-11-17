import { after, NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/http";
import { processTransactworldCallback } from "@/lib/payments/transactworld-confirmation";
import { requireTransactworldConfig } from "@/lib/payments/transactworld-config";
import { sessionId } from "@/lib/payments/transactworld";
import { runJobs } from "@/lib/orders/provision";
export const runtime = "nodejs";
export const maxDuration = 60;
function receipt(reference: string) {
  if (!/^[a-f0-9]{64}$/.test(reference))
    throw new HttpError(400, "Invalid payment reference.");
  const c = requireTransactworldConfig();
  return NextResponse.redirect(
    `${c.appOrigin}/order/success?session_id=${sessionId(reference, c)}`,
    303,
  );
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    return receipt((await params).reference);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  try {
    const result = await processTransactworldCallback(
      request,
      reference,
      "return",
    );
    if (result.paid)
      after(async () => {
        await runJobs(2);
      });
    return receipt(reference);
  } catch (error) {
    // A temporary Inquiry outage must not strand the browser on an API error.
    // The durable pending order is reconciled independently by the scheduled worker.
    if (error instanceof HttpError && error.status === 503)
      return receipt(reference);
    return apiError(error);
  }
}
