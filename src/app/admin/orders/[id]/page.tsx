import { requireAdminPage } from "@/lib/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AdminAction } from "@/components/admin/admin-action";
import { formatMoney, type Currency } from "@/lib/currency";
import { SupplierReconcile } from "@/components/admin/supplier-reconcile";
export default async function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const o = await db().order.findUnique({
    where: { id },
    include: {
      payment: true,
      items: { include: { supplierOrder: true } },
      jobs: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!o) notFound();
  return (
    <>
      <h1>Order #{o.id.slice(-8).toUpperCase()}</h1>
      <p>
        {o.email} · {formatMoney(o.total, o.currency as Currency)}
      </p>
      <div className="panel">
        <dl className="detail-list">
          <dt>Order status</dt>
          <dd>{o.status}</dd>
          <dt>Payment status</dt>
          <dd>{o.payment?.status || "Unpaid"}</dd>
          <dt>Payment gateway</dt>
          <dd>
            {o.payment?.provider ||
              (o.checkoutSessionId?.startsWith("tw_") ? "transactworld" : "—")}
          </dd>
          <dt>Gateway transaction</dt>
          <dd>{o.payment?.transactionId || o.stripePaymentIntentId || "—"}</dd>
          <dt>Email delivered</dt>
          <dd>{o.emailSentAt?.toISOString() || "Not recorded"}</dd>
          <dt>Created</dt>
          <dd>{o.createdAt.toISOString()}</dd>
        </dl>
        <div className="admin-actions">
          <AdminAction payload={{ action: "retry", orderId: id }}>
            Retry provisioning
          </AdminAction>
          <AdminAction payload={{ action: "resend", orderId: id }}>
            Resend ready email
          </AdminAction>
          <AdminAction payload={{ action: "refund-marker", orderId: id }}>
            Reconcile gateway refund
          </AdminAction>
        </div>
        <p style={{ fontSize: 14 }}>
          Refund reconciliation checks an existing full refund with the payment
          gateway. Issue any money refund through your merchant dashboard. An
          uncertain supplier purchase is paused for reconciliation, so retrying
          cannot charge the wallet twice.
        </p>
      </div>
      {o.items
        .filter(
          (i) =>
            i.supplierOrder &&
            ["SUBMITTING", "RECONCILE_REQUIRED"].includes(
              i.supplierOrder.status,
            ),
        )
        .map((i) => (
          <div className="panel" key={i.id} style={{ marginTop: 20 }}>
            <h2>Verify the existing supplier purchase</h2>
            <p style={{ fontSize: 14 }}>
              Check ResellPortal for this customer and package before retrying.
              Link the existing service here; the server verifies customer,
              package and test/live mode.
            </p>
            <SupplierReconcile orderItemId={i.id} />
          </div>
        ))}
      <h2 style={{ fontSize: 23, margin: "30px 0 18px" }}>Supplier status</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Provider</th>
              <th>Reference</th>
              <th>Remote order</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.destinationName} · {i.name}
                </td>
                <td>{i.provider}</td>
                <td>{i.supplierOrder?.reference || "—"}</td>
                <td>{i.supplierOrder?.externalOrderId || "—"}</td>
                <td>{i.supplierOrder?.status || "Not started"}</td>
                <td>{i.supplierOrder?.errorCode || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ fontSize: 23, margin: "30px 0 18px" }}>Audit trail</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {o.auditLogs.map((a) => (
              <tr key={a.id}>
                <td>{a.createdAt.toISOString()}</td>
                <td>{a.action}</td>
                <td style={{ whiteSpace: "normal" }}>{a.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
