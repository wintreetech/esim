import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { CouponForm } from "@/components/admin/coupon-form";
import { formatMoney } from "@/lib/currency";
export default async function Coupons() {
  await requireAdminPage();
  const coupons = await db().coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <h1>A little extra.</h1>
      <p>
        Coupon usage includes reservations from pending checkouts; expired
        sessions release their reservation.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Uses</th>
              <th>Active</th>
              <th>Expires (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>
                  {c.percentOff}% + {formatMoney(c.fixedOff)}
                </td>
                <td>
                  {c.usedCount} / {c.maxUses ?? "∞"}
                </td>
                <td>{c.active ? "Yes" : "No"}</td>
                <td>{c.expiresAt?.toISOString() || "No expiry"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CouponForm />
    </>
  );
}
