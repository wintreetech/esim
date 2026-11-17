import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authSettings } from "@/lib/auth-config";
export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/checkout/gateway-preview" ||
    request.nextUrl.pathname.startsWith("/api/payments/transactworld/preview")
  )
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  let response = NextResponse.next({ request });
  const settings = authSettings();
  if (!settings) return response;
  const client = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  try {
    await client.auth.getUser();
  } catch {
    /* Server-side identity checks still require a verified user. */
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/order/:path*",
    "/api/esim/:path*",
    "/api/checkout/:path*",
    "/checkout/gateway-preview",
    "/api/payments/transactworld/preview/:path*",
  ],
};
