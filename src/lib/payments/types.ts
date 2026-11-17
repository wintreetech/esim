export type CheckoutSessionInput = {
  orderId: string;
  email: string;
  amount: number;
  currency: string;
  description: string;
  expiresAt: number;
  shopperIp?: string;
  firstName?: string;
  lastName?: string;
};
export type CheckoutSession = {
  id: string;
  url: string;
  method?: "POST";
  fields?: Record<string, string>;
};
export type ConfirmedPayment = {
  provider?: "stripe" | "transactworld";
  eventId: string;
  eventType: string;
  orderId: string;
  sessionId: string;
  transactionId: string;
  amount: number;
  currency: string;
};
export interface PaymentProvider {
  assertReady?(): Promise<void>;
  createCheckout(input: CheckoutSessionInput): Promise<CheckoutSession>;
  getCheckout(
    id: string,
    shopperIp?: string,
  ): Promise<Omit<CheckoutSession, "url"> & { url: string | null }>;
}
