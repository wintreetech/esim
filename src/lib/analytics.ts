import "server-only";
export type AnalyticsEvent =
  | "destination_viewed"
  | "plan_selected"
  | "checkout_started"
  | "payment_completed"
  | "esim_provisioned"
  | "esim_provision_failed"
  | "topup_started"
  | "topup_completed";
export async function track(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean> = {},
) {
  const endpoint = process.env.ANALYTICS_ENDPOINT;
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ANALYTICS_API_KEY
          ? { Authorization: `Bearer ${process.env.ANALYTICS_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        event,
        properties,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* Analytics must never interrupt a purchase. No emails, tokens or activation data here. */
  }
}
