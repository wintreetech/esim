import type { Metadata } from "next";
import { DeviceChecker } from "@/components/esim/device-checker";
import { db } from "@/lib/db";
import { deviceSeeds } from "@/lib/data/devices";
export const metadata: Metadata = {
  title: "Check your device",
  description:
    "Find out if your phone can use a travel eSIM. Check common Apple, Samsung, Google, Motorola and Xiaomi devices.",
  alternates: { canonical: "/compatibility" },
};
export const dynamic = "force-dynamic";
export default async function Compatibility() {
  const devices = process.env.DATABASE_URL
    ? await db().device.findMany({
        orderBy: [{ brand: "asc" }, { model: "asc" }],
      })
    : deviceSeeds.map((d) => ({ ...d, supportsEsim: true }));
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">Let’s make sure you’re good to go</div>
        <h1>A quick phone check.</h1>
        <p>
          You’ll need an eSIM compatible, carrier-unlocked device. Find your
          phone below, then double-check your exact model before buying.
        </p>
      </div>
      <p className="warning">
        Compatibility depends on region, carrier, and device variant. This is a
        starting list, not a guarantee. Confirm an “Add eSIM” option in your
        phone settings and check with your manufacturer. Your phone must be
        unlocked.
      </p>
      <section style={{ padding: "20px 0 65px" }}>
        <DeviceChecker devices={devices} />
        <div className="info-panel">
          <h2>Check directly on your phone</h2>
          <p>
            iPhone: Settings → Mobile Service / Cellular → Add eSIM. Android:
            Settings → Connections / Network & internet → SIM manager / SIMs →
            Add eSIM. Menu names vary. An EID in your device settings is another
            useful indicator, but your carrier can confirm compatibility and
            unlock status.
          </p>
        </div>
      </section>
    </div>
  );
}
