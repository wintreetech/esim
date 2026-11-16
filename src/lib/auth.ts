import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { HttpError } from "./http";
export const authConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
export async function supabase() {
  if (!authConfigured())
    throw new HttpError(
      503,
      "Account sign-in is being configured. Guest checkout is still available when the store is ready.",
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Cookie refresh is handled by proxy.ts for server components. */
          }
        },
      },
    },
  );
}
export const getUser = cache(async () => {
  if (!authConfigured() || !process.env.DATABASE_URL) return null;
  const client = await supabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return null;
  // Role comes only from our database, never from user-editable Supabase metadata.
  return db().user.upsert({
    where: { authId: user.id },
    create: { authId: user.id, email: user.email.toLowerCase() },
    update: { email: user.email.toLowerCase() },
  });
});
export async function requireUser() {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required.");
  return user;
}
export async function requireAccountPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdminPage() {
  const user = await requireAccountPage();
  if (user.role !== "ADMIN") redirect("/account");
  return user;
}
