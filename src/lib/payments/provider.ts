import "server-only";
import type { PaymentProvider } from "./types";
import { StripePaymentProvider } from "./stripe-provider";
import { TransactworldPaymentProvider } from "./transactworld-provider";
import { paymentProviderName } from "./config";
export function getPaymentProvider(): PaymentProvider {
  return paymentProviderName() === "transactworld"
    ? new TransactworldPaymentProvider()
    : new StripePaymentProvider();
}
