import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { resellPortalTestMode } from "@/lib/esim/config";
import { buildGatewayRequest, sessionReference } from "./transactworld";
import { requireTransactworldConfig } from "./transactworld-config";
import type { PaymentProvider, CheckoutSessionInput } from "./types";
import { gatewayAuthToken } from "./transactworld-token";

export class TransactworldPaymentProvider implements PaymentProvider {
  async assertReady() {
    // Verify Inquiry access before a customer can submit card details. Invalid
    // merchant credentials must not leave a paid customer without fulfillment.
    await gatewayAuthToken(requireTransactworldConfig());
  }
  async createCheckout(input: CheckoutSessionInput) {
    const c = requireTransactworldConfig();
    const ref = createHash("sha256")
      .update(
        JSON.stringify(["roamly", c.environment, c.memberId, input.orderId]),
      )
      .digest("hex");
    return buildGatewayRequest(input, ref, c);
  }
  async getCheckout(id: string, shopperIp?: string) {
    const c = requireTransactworldConfig();
    const ref = sessionReference(id, c);
    const order = await db().order.findUnique({
      where: { checkoutSessionId: id },
    });
    if (!order || order.status !== "PENDING_PAYMENT") return { id, url: null };
    if (order.supplierTestMode !== resellPortalTestMode())
      throw new HttpError(
        409,
        "This checkout belongs to a different test/live mode.",
      );
    return buildGatewayRequest(
      {
        orderId: order.id,
        email: order.email,
        amount: order.total,
        currency: order.currency,
        description: `Travel eSIM order ${order.id.slice(-8).toUpperCase()}`,
        expiresAt: 0,
        shopperIp,
        firstName: order.firstName || undefined,
        lastName: order.lastName || undefined,
      },
      ref,
      c,
    );
  }
}
