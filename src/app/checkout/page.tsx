import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { checkoutConfigured } from "@/lib/payments/config";
import { paymentProviderName } from "@/lib/payments/config";
import { requireTransactworldConfig } from "@/lib/payments/transactworld-config";
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
  const configured = checkoutConfigured();
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
        paymentCurrencies={
          configured && paymentProviderName() === "transactworld"
            ? requireTransactworldConfig().supportedCurrencies
            : undefined
        }
        topUpEsimId={p.topup}
        initialPlanId={p.plan}
      />
    </div>
  );
}
