import { after, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  confirmPayment,
  expireCheckout,
  recordRefund,
} from "@/lib/orders/payment-confirmation";
import { runJobs } from "@/lib/orders/provision";
import { apiError, readBody, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    const raw = await readBody(request, 1000000);
    event = getStripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof HttpError) return apiError(error);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }
  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.payment_status !== "paid")
        return NextResponse.json({ received: true });
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      if (
        !session.metadata?.orderId ||
        !paymentIntent ||
        session.amount_total === null ||
        !session.currency
      )
        return NextResponse.json(
          { error: "Invalid payment reference" },
          { status: 400 },
        );
      await confirmPayment({
        eventId: event.id,
        eventType: event.type,
        orderId: session.metadata.orderId,
        sessionId: session.id,
        transactionId: paymentIntent,
        amount: session.amount_total,
        currency: session.currency,
      });
      // The durable DB job survives process termination; after() is only a low-latency kick.
      after(async () => {
        await runJobs(2);
      });
    } else if (event.type === "checkout.session.expired")
      await expireCheckout(event.data.object.id);
    else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      if (charge.refunded && charge.amount_refunded === charge.amount) {
        const intent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (intent) await recordRefund(intent, event.id);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
