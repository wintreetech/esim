import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { accessibleOrder, accessibleEsim } from "@/lib/order-access";
import { EsimDetail } from "@/components/account/esim-detail";
import { formatMoney, type Currency } from "@/lib/currency";
import { label } from "@/lib/utils";
export const metadata: Metadata = {
  title: "Your private order",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await accessibleOrder(id).catch(() => null);
  if (!order) notFound();
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">Your private travel essentials</div>
        <h1>Your order.</h1>
        <p>
          #{order.id.slice(-8).toUpperCase()} ·{" "}
          {formatMoney(order.total, order.currency as Currency)} ·{" "}
          <span className={`status status-${order.status.toLowerCase()}`}>
            {label(order.status)}
          </span>
        </p>
      </div>
      <div className="panel" style={{ marginBottom: 30 }}>
        {order.items.map((i) => (
          <div className="cart-item" key={i.id}>
            <div>
              <h3>{i.destinationName}</h3>
              <p>
                {i.dataLabel} · {i.validityDays} days
              </p>
            </div>
            <strong>
              {formatMoney(i.unitPrice, order.currency as Currency)}
            </strong>
          </div>
        ))}
        {order.status === "PROVISIONING" || order.status === "PAID" ? (
          <p className="warning">
            Your payment is confirmed and your eSIM is being prepared. We’ll
            email you when it’s ready. You can refresh this page for updates.
          </p>
        ) : order.status === "FAILED" ? (
          <p className="warning">
            This order needs attention. If you paid, your payment remains
            recorded and our team can retry fulfillment or arrange a refund.
            Please <Link href="/support">contact support</Link> with this order
            reference.
          </p>
        ) : order.status === "PENDING_PAYMENT" ? (
          <p style={{ fontSize: 12, marginTop: 20 }}>
            We’re waiting for secure payment confirmation.
          </p>
        ) : order.status === "REFUNDED" ? (
          <p className="warning">
            A full refund has been recorded. Your supplier’s eSIM cancellation
            rules may still apply.
          </p>
        ) : null}
        {order.topUp && (
          <p className="success-text">
            Top-up status: {order.topUp.status.toLowerCase()}.
          </p>
        )}
      </div>
      {order.status !== "REFUNDED" &&
        (await Promise.all(
          order.esims.map(async (e) => {
            const full = await accessibleEsim(e.id);
            return <EsimDetail key={e.id} esim={full} />;
          }),
        ))}
      <div style={{ paddingBottom: 50 }}>
        <Link href="/support" className="text-link">
          Need a hand? We’re here →
        </Link>
      </div>
    </div>
  );
}
