import { NextResponse } from "next/server";
import { supabase } from "@/lib/auth";
import { brand } from "@/lib/brand";
// Compatible with Supabase's recommended token-hash magic-link email template.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const hash = query.get("token_hash");
  if (
    query.get("type") === "email" &&
    hash &&
    /^[A-Za-z0-9_-]{20,2048}$/.test(hash)
  ) {
    try {
      const client = await supabase();
      const { error } = await client.auth.verifyOtp({
        token_hash: hash,
        type: "email",
      });
      if (!error)
        return NextResponse.redirect(new URL("/account/orders", brand.url));
    } catch {}
  }
  return NextResponse.redirect(new URL("/login?error=sign-in", brand.url));
}
