import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ClearPaidCart } from "@/components/checkout/clear-paid-cart";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
export const metadata: Metadata = {
  title: "Thanks for exploring with us",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Success({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let paid = false;
  try {
    if (session_id && /^tw_[sl]_[a-f0-9]{64}$/.test(session_id)) {
      const order = await db().order.findUnique({
        where: { checkoutSessionId: session_id },
        select: { payment: { select: { status: true } } },
      });
      paid = order?.payment?.status === "PAID";
    }
    if (session_id?.startsWith("cs_") && session_id.length < 256)
      paid =
        (await getStripe().checkout.sessions.retrieve(session_id))
          .payment_status === "paid";
  } catch {
    /* No order secrets or buyer data are returned from this public receipt. */
  }
  return (
    <div className="container server-error">
      <MailCheck size={50} color="#6747e8" style={{ margin: "0 auto 25px" }} />
      <h1>{paid ? "You’re one step closer." : "Thanks for stopping by."}</h1>
      <p>
        {paid
          ? "Your payment has been received. We’re confirming your eSIM with the provider. Watch your inbox for a private order link and installation details."
          : "Payment confirmation may still be on its way. Check your email or sign in with your purchase email to see your orders."}
      </p>
      <p style={{ fontSize: 14, marginTop: 18 }}>
        This page never activates an eSIM. We fulfill orders after secure
        server-side payment confirmation.
      </p>
      {paid && <ClearPaidCart />}
      <ButtonLink href="/account/orders">View my orders →</ButtonLink>
      <p style={{ fontSize: 14, marginTop: 25 }}>
        Need a hand?{" "}
        <a className="text-link" href="/support">
          Visit support
        </a>
      </p>
    </div>
  );
}
