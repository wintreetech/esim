import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { requireAccountPage } from "@/lib/auth";
import { accountOrders, ordersPerPage } from "@/lib/account-orders";
import { ResendOrderEmail } from "@/components/account/resend-order-email";
import { emailConfigured } from "@/lib/email-config";
import { formatMoney, type Currency } from "@/lib/currency";
import { label } from "@/lib/utils";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireAccountPage();
  const { orders, page, pages, count } = await accountOrders(
    user,
    (await searchParams).page,
  );
  return (
    <>
      <h1>Your adventures, all here.</h1>
      <p>Orders placed with {user.email}, including guest purchases.</p>
      {count > 0 && (
        <p className="order-count">
          Showing {(page - 1) * ordersPerPage + 1}–
          {Math.min(page * ordersPerPage, count)} of {count} orders.
        </p>
      )}
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
          {o.status === "FULFILLED" && (
            <ResendOrderEmail orderId={o.id} configured={emailConfigured()} />
          )}
        </article>
      ))}
      {pages > 1 && (
        <nav className="orders-pagination" aria-label="Order pages">
          {page > 1 && (
            <Link
              className="button button-secondary"
              href={`/account/orders?page=${page - 1}`}
            >
              ← Previous
            </Link>
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              className="button button-secondary"
              href={`/account/orders?page=${page + 1}`}
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
