import { NextResponse } from "next/server";
import { currencies } from "@/lib/currency";
import { release } from "@/lib/release";
import { checkoutConfigured } from "@/lib/payments/config";
import { authConfigured } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  // Public version/capabilities only. Credential names, failure reasons and
  // customer/supplier data remain in authenticated setup screens or the CLI.
  return NextResponse.json(
    {
      release,
      commit: process.env.NEXT_PUBLIC_RELEASE_ID || "local",
      currencies,
      checkoutAvailable: checkoutConfigured(),
      accountSignInAvailable:
        authConfigured() && Boolean(process.env.DATABASE_URL),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
