import { NextResponse } from "next/server";
import { supabase } from "@/lib/auth";
import { brand } from "@/lib/brand";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code && code.length < 2048) {
    try {
      const client = await supabase();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/account", brand.url));
    } catch {}
  }
  return NextResponse.redirect(new URL("/login?error=sign-in", brand.url));
}
