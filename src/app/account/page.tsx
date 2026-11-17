import { requireAccountPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/button";
export default async function Account() {
  const user = await requireAccountPage();
  const [orders, esims] = await Promise.all([
    db().order.count({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
    }),
    db().esim.count({
      where: { order: { OR: [{ userId: user.id }, { email: user.email }] } },
    }),
  ]);
  return (
    <>
      <div className="eyebrow">Your little corner of the world</div>
      <h1>Welcome back.</h1>
      <p>{user.email} · All your connections, in one place.</p>
      <div className="stat-grid">
        <div className="stat-card">
          <p>Your orders</p>
          <strong>{orders}</strong>
        </div>
        <div className="stat-card">
          <p>Your eSIMs</p>
          <strong>{esims}</strong>
        </div>
        <div className="stat-card">
          <p>Next adventure</p>
          <strong>Up to you ↗</strong>
        </div>
      </div>
      <div className="panel">
        <h2>Your orders and installation details</h2>
        <p style={{ marginBottom: 24 }}>
          See purchases made with your verified email, open your eSIM details
          and request another installation email.
        </p>
        <div className="account-quick-links">
          <ButtonLink href="/account/orders">View all orders</ButtonLink>
          <ButtonLink secondary href="/account/esims">
            View my eSIMs
          </ButtonLink>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 24 }}>
        <h2>Ready for your next somewhere?</h2>
        <p style={{ fontSize: 14, marginBottom: 25 }}>
          Find a little data for the places you’ve been dreaming of.
        </p>
        <ButtonLink href="/destinations">Explore destinations →</ButtonLink>
        {user.role === "ADMIN" && (
          <ButtonLink secondary href="/admin" className="ml-3">
            Admin dashboard
          </ButtonLink>
        )}
      </div>
    </>
  );
}
