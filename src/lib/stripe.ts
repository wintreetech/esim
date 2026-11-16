import "server-only";
import Stripe from "stripe";
let stripe: Stripe | undefined;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("Stripe is not configured");
  return (stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 15000,
  }));
}
