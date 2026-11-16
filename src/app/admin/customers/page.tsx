import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
export default async function Customers() {
  await requireAdminPage();
  const users = await db().user.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const guests = await db().order.groupBy({
    by: ["email"],
    where: { userId: null },
    _count: true,
    orderBy: { email: "asc" },
    take: 100,
  });
  return (
    <>
      <h1>Customers.</h1>
      <p>
        Latest 100 registered accounts and up to 100 guest email groups. A guest
        can access previous purchases by signing in with the same verified
        email.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role / type</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u._count.orders}</td>
              </tr>
            ))}
            {guests.map((g) => (
              <tr key={g.email}>
                <td>{g.email}</td>
                <td>Guest checkout</td>
                <td>{g._count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
