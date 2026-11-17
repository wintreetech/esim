import "server-only";
import { db } from "@/lib/db";
export const ordersPerPage = 20;
export const accountOrderWhere = (user: { id: string; email: string }) => ({
  OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
});
export async function accountOrders(
  user: { id: string; email: string },
  requestedPage?: string,
) {
  const where = accountOrderWhere(user);
  const count = await db().order.count({ where });
  const pages = Math.max(1, Math.ceil(count / ordersPerPage));
  const parsed =
    requestedPage && /^\d{1,8}$/.test(requestedPage)
      ? Number(requestedPage)
      : 1;
  const page = Math.max(1, Math.min(parsed, pages));
  const orders = await db().order.findMany({
    where,
    include: { items: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ordersPerPage,
    take: ordersPerPage,
  });
  return { orders, count, pages, page };
}
