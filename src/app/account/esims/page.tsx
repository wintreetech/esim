import Link from "next/link";
import { Smartphone } from "lucide-react";
import { requireAccountPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { label } from "@/lib/utils";
export default async function Esims() {
  const user = await requireAccountPage();
  const esims = await db().esim.findMany({
    where: { order: { OR: [{ userId: user.id }, { email: user.email }] } },
    include: { orderItem: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <h1>Your connections.</h1>
      <p>Installation details and data, ready when you are.</p>
      {!esims.length ? (
        <div className="empty-state">
          <Smartphone />
          <h3>No eSIMs here yet.</h3>
          <p>Your eSIMs will appear once your order is fulfilled.</p>
          <Link href="/destinations" className="button">
            Explore plans →
          </Link>
        </div>
      ) : (
        <div className="account-esim-grid">
          {esims.map((e) => (
            <article className="order-card" key={e.id}>
              <div className="order-card-top">
                <h3>{e.orderItem.destinationName}</h3>
                <span className="status">{label(e.status)}</span>
              </div>
              <p>
                {e.orderItem.dataLabel} · {e.orderItem.validityDays} days
              </p>
              <p>
                Purchased{" "}
                {e.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}
              </p>
              <p>
                {e.expiresAt
                  ? `Expires ${e.expiresAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}`
                  : "Expiry available after activation, if provided"}
              </p>
              <p style={{ marginTop: 10 }}>
                {e.dataUsedMb === null
                  ? "Usage not available"
                  : `${(e.dataUsedMb / 1024).toFixed(2)} GB used of ${(e.dataTotalMb / 1024).toFixed(1)} GB`}
              </p>
              <Link
                className="button button-secondary"
                style={{ marginTop: 20, fontSize: 14 }}
                href={`/account/esims/${e.id}`}
              >
                View eSIM & installation →
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
