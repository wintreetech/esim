import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, ShoppingBag, Smartphone } from "lucide-react";
import { requireAccountPage } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccountPage();
  return (
    <div className="container account-layout">
      <aside className="account-nav" aria-label="Account navigation">
        <Link href="/account">
          <LayoutDashboard size={17} />
          Overview
        </Link>
        <Link href="/account/orders">
          <ShoppingBag size={17} />
          My orders
        </Link>
        <Link href="/account/esims">
          <Smartphone size={17} />
          My eSIMs
        </Link>
        <form action="/api/auth/logout" method="post">
          <button className="button button-secondary">Sign out</button>
        </form>
      </aside>
      <section className="account-content">{children}</section>
    </div>
  );
}
