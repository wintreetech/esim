import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminAction } from "@/components/admin/admin-action";
export default async function AdminDestinations() {
  await requireAdminPage();
  const destinations = await db().destination.findMany({
    include: { _count: { select: { plans: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <h1>Destinations.</h1>
      <p>
        Manage visibility. New inventory is imported through the provider’s
        catalog sync.
      </p>
      <div className="admin-actions">
        <AdminAction payload={{ action: "sync" }}>
          Sync provider catalog
        </AdminAction>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Destination</th>
              <th>Region</th>
              <th>ISO</th>
              <th>Plans</th>
              <th>Visibility</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.flagEmoji} {d.name}
                </td>
                <td>{d.region}</td>
                <td>{d.isoCode}</td>
                <td>{d._count.plans}</td>
                <td>
                  <AdminAction
                    payload={{
                      action: "destination",
                      id: d.id,
                      active: !d.active,
                    }}
                  >
                    {d.active ? "Active · hide" : "Hidden · activate"}
                  </AdminAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
