import { NextResponse } from "next/server";
import { verifyOrderToken } from "@/lib/order-access";
import { brand } from "@/lib/brand";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "",
    id = verifyOrderToken(token);
  if (!id)
    return NextResponse.redirect(
      new URL("/login?error=link-expired", brand.url),
    );
  const response = NextResponse.redirect(new URL(`/order/${id}`, brand.url));
  response.cookies.set(`roamly_order_${id}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
