import "server-only";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { expireCheckout } from "./payment-confirmation";
// Repair abandoned coupon reservations after a failed Stripe/session DB write.
// Never expire a session merely because of a local clock: ask Stripe when its ID exists.
export async function cleanupCheckouts() {
  const stale = await db().order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: new Date(Date.now() - 2 * 3600000) },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });
  for (const order of stale) {
    if (order.checkoutSessionId) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(
          order.checkoutSessionId,
        );
        if (session.status === "expired") await expireCheckout(session.id);
      } catch {
        /* Leave money-affecting uncertainty for a later retry / operator review. */
      }
    } else {
      // Sessions are created with a fixed 31-minute expiry. A session whose response was
      // lost cannot still accept payment after two hours. A verified late webhook is
      // still recorded and recovered by confirmPayment(), so paid orders are not lost.
      await db().$transaction(async (tx) => {
        const changed = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_PAYMENT",
            checkoutSessionId: null,
          },
          data: { status: "FAILED" },
        });
        if (changed.count) {
          if (order.couponId)
            await tx.coupon.update({
              where: { id: order.couponId },
              data: { usedCount: { decrement: 1 } },
            });
          await tx.auditLog.create({
            data: {
              orderId: order.id,
              action: "ABANDONED_CHECKOUT_REVIEW",
              detail:
                "No checkout session reference persisted; reconcile any late Stripe events.",
            },
          });
        }
      });
    }
  }
}
