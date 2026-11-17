export async function runScheduled(
  path,
  context,
  env = process.env,
  fetcher = fetch,
) {
  // Scheduled functions execute only on published production deploys. Keep the
  // context guard for manual invocations from previews and local tooling too.
  // CONTEXT is a build-only variable. Runtime deploy metadata comes from Context.
  if (context?.deploy?.context !== "production" || !context.deploy.published)
    return new Response(null, { status: 204 });
  const secret = env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new Error("Configure CRON_SECRET for scheduled workers.");
  const base = new URL(env.NEXT_PUBLIC_APP_URL || env.URL || "");
  const deployed = new URL(env.URL || "");
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    deployed.protocol !== "https:" ||
    !["/api/cron/fulfill", "/api/cron/payments", "/api/cron/catalog"].includes(
      path,
    )
  )
    throw new Error("Invalid scheduled worker URL.");
  // Use Netlify's configured primary URL; aliases may redirect to a custom domain.
  // Credentials must never follow a redirect to another origin.
  const target = new URL(path, deployed.origin);
  target.searchParams.set("background", "1");
  const response = await fetcher(target, {
    headers: { Authorization: `Bearer ${secret}` },
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  await response.body?.cancel();
  if (!response.ok)
    throw new Error(`Scheduled worker returned HTTP ${response.status}.`);
  return new Response(null, { status: 204 });
}
