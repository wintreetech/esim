import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { requireAccountPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, type Currency } from "@/lib/currency";
import { label } from "@/lib/utils";
export default async function Orders() {
  const user = await requireAccountPage();
  const orders = await db().order.findMany({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <h1>Your adventures, all here.</h1>
      <p>Orders placed with {user.email}. Showing your latest 100.</p>
      {!orders.length && (
        <div className="empty-state">
          <ShoppingBag />
          <h3>No orders just yet.</h3>
          <p>A new connection is only a destination away.</p>
          <Link className="button" href="/destinations">
            Find my first plan
          </Link>
        </div>
      )}
      {orders.map((o) => (
        <article key={o.id} className="order-card">
          <div className="order-card-top">
            <div>
              <h3>{o.items.map((i) => i.destinationName).join(" + ")}</h3>
              <p>
                {o.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })} ·
                #{o.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <span className={`status status-${o.status.toLowerCase()}`}>
              {label(o.status)}
            </span>
          </div>
          <div className="order-lines">
            <div>
              <p>{o.items.map((i) => i.name).join(", ")}</p>
              <strong>{formatMoney(o.total, o.currency as Currency)}</strong>
            </div>
            <Link className="button button-secondary" href={`/order/${o.id}`}>
              View order →
            </Link>
          </div>
        </article>
      ))}
    </>
  );
}
