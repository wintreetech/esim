// Shared with the request proxy; never fall back to a service-role or secret key.
export function authSettings() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key || key.startsWith("sb_secret_")) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    )
      return null;
    const local =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
      return null;
    // Reject accidentally pasted privileged legacy JWTs, without decoding/logging them server-side.
    if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ"))
      return null;
    if (key.startsWith("eyJ")) {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") return null;
    }
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}
