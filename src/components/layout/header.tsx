"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Globe2,
  Menu,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { useCart } from "@/lib/cart";
const links = [
  ["Destinations", "/destinations"],
  ["Europe", "/esim/europe"],
  ["How it works", "/how-it-works"],
  ["Compatibility", "/compatibility"],
  ["FAQ", "/faq"],
  ["Support", "/support"],
];
export function Header() {
  const [open, setOpen] = useState(false);
  const { items, currency, setCurrency } = useCart();
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);
  return (
    <>
      <div className="announcement">
        A little less roaming. A lot more exploring.{" "}
        <Link href="/destinations">
          Find your next connection <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="header">
        <div className="container nav-inner">
          <Link className="brand" href="/" aria-label={`${brand.name} home`}>
            <span className="brand-icon">
              <Globe2 size={23} strokeWidth={1.8} />
            </span>
            {brand.name.toLowerCase()}
            <span className="brand-period">.</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(([name, href]) => (
              <Link key={href} href={href}>
                {name}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <label className="currency-select">
              <Globe2 size={15} />
              <span className="sr-only">Currency</span>
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "INR")}
              >
                <option>USD</option>
                <option>INR</option>
              </select>
            </label>
            <Link href="/account" className="icon-link" aria-label="My account">
              <UserRound size={20} />
            </Link>
            <Link
              className="cart-link"
              href="/checkout"
              aria-label={`Cart, ${items.length} plans`}
            >
              <ShoppingBag size={20} />
              <span>{items.length}</span>
            </Link>
            <button
              className="mobile-menu icon-link"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {links.map(([name, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {name}
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
