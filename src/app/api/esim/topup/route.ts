import { NextResponse } from "next/server";
import { z } from "zod";
import { accessibleEsim } from "@/lib/order-access";
import { apiError, HttpError } from "@/lib/http";
import { db } from "@/lib/db";
export async function GET(request: Request) {
  try {
    if (process.env.ENABLE_TOPUPS !== "true")
      throw new HttpError(404, "Top-ups are not enabled.");
    const id = z
      .string()
      .min(1)
      .max(150)
      .parse(new URL(request.url).searchParams.get("id"));
    const esim = await accessibleEsim(id);
    if (!esim.orderItem.plan.supportsTopup)
      return NextResponse.json({ plans: [] });
    const plans = await db().plan.findMany({
      where: {
        destinationId: esim.orderItem.plan.destinationId,
        active: true,
        supportsTopup: true,
        provider: esim.orderItem.provider,
      },
      select: { id: true, name: true, dataLabel: true, validityDays: true },
    });
    return NextResponse.json({ plans });
  } catch (error) {
    return apiError(error);
  }
}
// Top-up purchases use /api/checkout with topUpEsimId. Only the verified payment
// webhook enqueues provider.topUp(); there is deliberately no direct provisioning POST.
