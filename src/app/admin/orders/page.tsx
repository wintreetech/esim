import { requireAdminPage } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney, type Currency } from "@/lib/currency";
import { label } from "@/lib/utils";
export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage();
  const { q } = await searchParams;
  const orders = await db().order.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q.slice(0, 150) } },
            { email: { contains: q.slice(0, 150), mode: "insensitive" } },
          ],
        }
      : {},
    include: { items: { include: { supplierOrder: true } }, payment: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <h1>Orders.</h1>
      <p>Latest 100 orders. Search by email or order reference.</p>
      <form style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <label className="input-search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Email or order ID"
            maxLength={150}
          />
        </label>
        <button className="button button-secondary">Search</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order / email</th>
              <th>Destination / plan</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Provisioning</th>
              <th>Supplier order</th>
              <th>Created (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>#{o.id.slice(-8)}</Link>
                  <br />
                  {o.email}
                </td>
                <td>
                  {o.items.map((i) => (
                    <div key={i.id}>
                      {i.destinationName} · {i.name}
                    </div>
                  ))}
                </td>
                <td>{formatMoney(o.total, o.currency as Currency)}</td>
                <td>{o.payment?.status || "Unpaid"}</td>
                <td>
                  <span className={`status status-${o.status.toLowerCase()}`}>
                    {label(o.status)}
                  </span>
                </td>
                <td>
                  {o.items
                    .map((i) => i.supplierOrder?.externalOrderId || "—")
                    .join(", ")}
                </td>
                <td>
                  {o.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <div className="empty-state">
            <p>No matching orders.</p>
          </div>
        )}
      </div>
    </>
  );
}
