import { NextResponse } from "next/server";
import { supabase } from "@/lib/auth";
import { sameOrigin, apiError } from "@/lib/http";
import { brand } from "@/lib/brand";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const client = await supabase();
    await client.auth.signOut();
    return NextResponse.redirect(new URL("/", brand.url), 303);
  } catch (error) {
    return apiError(error);
  }
}
