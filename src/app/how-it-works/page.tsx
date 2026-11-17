import type { Metadata } from "next";
import { MapPin, QrCode, Smartphone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "How travel eSIMs work",
  description:
    "Choose a destination, pick your data, and install your travel eSIM. A simple guide to getting connected.",
  alternates: { canonical: "/how-it-works" },
};
export default function HowItWorks() {
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">More exploring. Less explaining.</div>
        <h1>
          A good connection,
          <br />
          in a few little steps.
        </h1>
        <p>
          Your travel data lives on your phone. No SIM swapping, no shop to find
          when you land.
        </p>
      </div>
      <section className="steps-grid" style={{ padding: "25px 0 65px" }}>
        {[
          {
            icon: MapPin,
            title: "Choose your destination",
            text: "Find the country or region you’re visiting. Check coverage and make sure your phone supports eSIM.",
          },
          {
            icon: Smartphone,
            title: "Pick your data plan",
            text: "Choose your allowance and validity. Enter your email, review the total, and pay securely online.",
          },
          {
            icon: QrCode,
            title: "Install your eSIM",
            text: "Once your payment and provider order are confirmed, your QR code and private installation link arrive by email.",
          },
        ].map((s, i) => (
          <div className="step" key={s.title}>
            <div className="step-icon">
              <s.icon />
              <span className="step-number">0{i + 1}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </section>
      <div className="info-panel" style={{ marginBottom: 50 }}>
        <h2>Before takeoff</h2>
        <p>
          Install over a stable Wi-Fi connection. Your plan starts its validity
          when the eSIM first connects to a supported network at the
          destination. At your destination, select the travel eSIM for data and
          follow provider roaming settings. Turn off home-line data roaming to
          avoid your home carrier’s fees. Keep your eSIM installed for the
          duration of your trip.
        </p>
        <div
          style={{ marginTop: 25, display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <ButtonLink href="/destinations">Find my connection →</ButtonLink>
          <ButtonLink secondary href="/compatibility">
            Check my device
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
