import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { exchangeRate } from "@/lib/currency";
import {
  resellPortalConfigured,
  resellPortalTestMode,
} from "@/lib/esim/config";
export const metadata: Metadata = {
  title: "Your travel bag",
  robots: { index: false, follow: false },
};
export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; plan?: string; cancelled?: string }>;
}) {
  const p = await searchParams;
  const configured = Boolean(
    process.env.DATABASE_URL &&
    process.env.STRIPE_SECRET_KEY &&
    process.env.RESEND_API_KEY &&
    process.env.ORDER_ACCESS_SECRET &&
    resellPortalConfigured() &&
    (resellPortalTestMode() ||
      process.env.RESELLPORTAL_ALLOW_LIVE_ORDERS === "true"),
  );
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">Next stop: connected</div>
        <h1>Your travel bag.</h1>
        <p>One less thing between you and your next adventure.</p>
        {p.cancelled && (
          <p className="preview-notice">
            Payment was cancelled. Your plans are still here when you’re ready.
          </p>
        )}
      </div>
      <CheckoutForm
        configured={configured}
        rate={exchangeRate()}
        topUpEsimId={p.topup}
        initialPlanId={p.plan}
      />
    </div>
  );
}
