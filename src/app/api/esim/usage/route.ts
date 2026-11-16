import { NextResponse } from "next/server";
import { z } from "zod";
import { accessibleEsim } from "@/lib/order-access";
import { apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getProvider } from "@/lib/esim/provider";
import { usageSchema, ProviderError } from "@/lib/esim/types";
import { db } from "@/lib/db";
export async function GET(request: Request) {
  try {
    await rateLimit(request, "usage", 15);
    const id = z
      .string()
      .min(1)
      .max(150)
      .parse(new URL(request.url).searchParams.get("id"));
    const esim = await accessibleEsim(id);
    if (esim.testMode)
      return NextResponse.json({
        dataTotalMb: esim.dataTotalMb,
        dataUsedMb: null,
        status: "TEST_ORDER",
        expiresAt: null,
      });
    const usage = usageSchema.parse(
      await getProvider(esim.orderItem.provider).getUsage(esim.providerEsimId),
    );
    await db().esim.update({
      where: { id },
      data: {
        dataUsedMb:
          usage.dataUsedMb === null ? null : Math.floor(usage.dataUsedMb),
        dataTotalMb: Math.floor(usage.dataTotalMb),
        status: usage.status,
        expiresAt: usage.expiresAt ? new Date(usage.expiresAt) : null,
      },
    });
    return NextResponse.json(usage);
  } catch (error) {
    if (
      error instanceof ProviderError &&
      error.code === "RESELLPORTAL_HTTP_409"
    )
      return NextResponse.json(
        {
          error: "Your eSIM has not been issued yet. Please try again shortly.",
        },
        { status: 409 },
      );
    if (
      error instanceof ProviderError &&
      error.code === "RESELLPORTAL_HTTP_503"
    )
      return NextResponse.json(
        {
          error:
            "Your carrier has not made usage data available yet. Please try again later.",
        },
        { status: 503 },
      );
    return apiError(error);
  }
}
