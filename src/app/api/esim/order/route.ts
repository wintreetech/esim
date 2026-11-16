import { NextResponse } from "next/server";
import { z } from "zod";
import { accessibleOrder } from "@/lib/order-access";
import { apiError } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const id = z
      .string()
      .min(1)
      .max(150)
      .parse(new URL(request.url).searchParams.get("id"));
    const order = await accessibleOrder(id);
    return NextResponse.json({
      id: order.id,
      status: order.status,
      total: order.total,
      currency: order.currency,
      esims: order.esims.map((e) => ({ id: e.id, status: e.status })),
    });
  } catch (error) {
    return apiError(error);
  }
}
