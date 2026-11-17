import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/exchange-rates";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await getExchangeRates(), {
    headers: { "Cache-Control": "no-store" },
  });
}
