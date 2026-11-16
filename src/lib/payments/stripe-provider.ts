import "server-only";
import { getStripe } from "@/lib/stripe";
import { brand } from "@/lib/brand";
import type { PaymentProvider, CheckoutSessionInput } from "./types";
export class StripePaymentProvider implements PaymentProvider {
  async createCheckout(input: CheckoutSessionInput) {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.email,
        client_reference_id: input.orderId,
        metadata: { orderId: input.orderId },
        payment_intent_data: { metadata: { orderId: input.orderId } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amount,
              product_data: { name: input.description },
            },
          },
        ],
        success_url: `${brand.url}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${brand.url}/checkout?cancelled=1`,
        expires_at: input.expiresAt,
      },
      { idempotencyKey: `checkout:${input.orderId}` },
    );
    if (!session.url) throw new Error("Checkout URL unavailable");
    return { id: session.id, url: session.url };
  }
  async getCheckout(id: string) {
    const session = await getStripe().checkout.sessions.retrieve(id);
    return {
      id: session.id,
      url: session.status === "open" ? session.url : null,
    };
  }
}
