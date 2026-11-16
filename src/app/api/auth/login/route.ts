import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/auth";
import { jsonBody, sameOrigin, apiError, HttpError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { brand } from "@/lib/brand";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "login", 5, 300);
    const { email } = await jsonBody(
      request,
      z.object({ email: z.email().max(254) }),
    );
    const client = await supabase();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${brand.url}/auth/callback` },
    });
    if (error)
      throw new HttpError(
        400,
        "We couldn’t send your sign-in email. Please try again shortly.",
      );
    return NextResponse.json({
      message: "Check your inbox for a secure sign-in link.",
    });
  } catch (error) {
    return apiError(error);
  }
}
