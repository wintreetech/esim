import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Store administration",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <div className="container account-layout">
      <aside className="account-nav" aria-label="Admin navigation">
        {[
          ["Overview", "/admin"],
          ["Store setup", "/admin/setup"],
          ["Orders", "/admin/orders"],
          ["Destinations", "/admin/destinations"],
          ["Plans & pricing", "/admin/plans"],
          ["Customers", "/admin/customers"],
          ["Coupons", "/admin/coupons"],
          ["← Customer account", "/account"],
        ].map(([text, url]) => (
          <Link key={url} href={url}>
            {text}
          </Link>
        ))}
      </aside>
      <section className="account-content">{children}</section>
    </div>
  );
}
