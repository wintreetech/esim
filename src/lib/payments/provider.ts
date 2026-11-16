import "server-only";
import type { PaymentProvider } from "./types";
import { StripePaymentProvider } from "./stripe-provider";
export function getPaymentProvider(): PaymentProvider {
  return new StripePaymentProvider();
}
