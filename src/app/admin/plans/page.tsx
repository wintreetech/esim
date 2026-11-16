import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { PlanEditor } from "@/components/admin/plan-editor";
import { formatMoney } from "@/lib/currency";
import { pricingConfig } from "@/lib/pricing/calculate-price";
export default async function AdminPlans() {
  await requireAdminPage();
  const plans = await db().plan.findMany({
    include: { destination: true },
    orderBy: [{ destination: { name: "asc" } }, { dataAmountMB: "asc" }],
  });
  const floor = pricingConfig().minMargin;
  return (
    <>
      <h1>Plans & pricing.</h1>
      <p>
        Supplier costs are private. Amounts below are USD. Blank override uses
        the synchronized retail price. Minimum margin: {formatMoney(floor)}.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Destination / plan</th>
              <th>Cost</th>
              <th>Retail</th>
              <th>Margin</th>
              <th>Override (USD) / active</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const retail = p.retailOverride ?? p.retailPrice,
                margin = retail - p.wholesalePrice;
              return (
                <tr key={p.id} className={margin < floor ? "low-margin" : ""}>
                  <td>
                    {p.destination.name}
                    <br />
                    {p.name}
                    <br />
                    <span className="muted">{p.provider}</span>
                  </td>
                  <td>{formatMoney(p.wholesalePrice)}</td>
                  <td>{formatMoney(retail)}</td>
                  <td>
                    {formatMoney(margin)}
                    {margin < floor ? " ⚠ Below floor" : ""}
                  </td>
                  <td>
                    <PlanEditor
                      id={p.id}
                      retail={p.retailOverride}
                      active={p.active}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
