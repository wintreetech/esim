import { requireAdminPage } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney, type Currency } from "@/lib/currency";
export default async function Admin() {
  await requireAdminPage();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [today, completed, provisioning, failed, revenue, attention] =
    await Promise.all([
      db().order.count({ where: { createdAt: { gte: start } } }),
      db().order.count({ where: { status: "FULFILLED" } }),
      db().order.count({ where: { status: { in: ["PAID", "PROVISIONING"] } } }),
      db().order.count({
        where: { status: "FAILED", payment: { isNot: null } },
      }),
      db().order.groupBy({
        by: ["currency"],
        where: {
          status: { in: ["PAID", "PROVISIONING", "FULFILLED", "FAILED"] },
          payment: { status: "PAID" },
        },
        _sum: { total: true },
        _avg: { total: true },
        _count: true,
      }),
      db().fulfillmentJob.findMany({
        where: { status: "FAILED" },
        include: { order: { select: { email: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);
  return (
    <>
      <div className="eyebrow">A view from the control room</div>
      <h1>Store overview.</h1>
      <p>Money is grouped by payment currency. Today uses UTC.</p>
      <div className="stat-grid">
        {[
          ["Today’s orders (UTC)", today],
          ["Completed orders", completed],
          ["Awaiting provisioning", provisioning],
          ["Paid orders needing attention", failed],
        ].map(([name, value]) => (
          <div className="stat-card" key={name}>
            <p>{name}</p>
            <strong>{value}</strong>
          </div>
        ))}
        {revenue.map((r) => (
          <div className="stat-card" key={r.currency}>
            <p>Revenue · {r.currency}</p>
            <strong>
              {formatMoney(r._sum.total || 0, r.currency as Currency)}
            </strong>
            <p>
              Average order{" "}
              {formatMoney(
                Math.round(r._avg.total || 0),
                r.currency as Currency,
              )}{" "}
              · {r._count} payments
            </p>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 24, marginBottom: 20 }}>Needs a human</h2>
      {attention.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Step</th>
                <th>Attempts</th>
                <th>Safe error category</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link href={`/admin/orders/${j.orderId}`}>
                      {j.orderId.slice(-8)}
                    </Link>
                  </td>
                  <td>{j.kind}</td>
                  <td>{j.attempts}</td>
                  <td>{j.lastError}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h3>All clear for now.</h3>
          <p>
            Failed provisioning and email jobs will appear here for retry or
            refund review.
          </p>
        </div>
      )}
    </>
  );
}
