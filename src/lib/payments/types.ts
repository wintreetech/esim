export type CheckoutSessionInput = {
  orderId: string;
  email: string;
  amount: number;
  currency: string;
  description: string;
  expiresAt: number;
};
export type ConfirmedPayment = {
  eventId: string;
  eventType: string;
  orderId: string;
  sessionId: string;
  transactionId: string;
  amount: number;
  currency: string;
};
export interface PaymentProvider {
  createCheckout(
    input: CheckoutSessionInput,
  ): Promise<{ id: string; url: string }>;
  getCheckout(id: string): Promise<{ id: string; url: string | null }>;
}
