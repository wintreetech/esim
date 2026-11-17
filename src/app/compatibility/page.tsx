import type { Metadata } from "next";
import { DeviceChecker } from "@/components/esim/device-checker";
import { deviceSeeds } from "@/lib/data/devices";
export const metadata: Metadata = {
  title: "Check your device",
  description:
    "Find out if your phone can use a travel eSIM. Check common Apple, Samsung, Google, Motorola and Xiaomi devices.",
  alternates: { canonical: "/compatibility" },
};
export const dynamic = "force-dynamic";
export default async function Compatibility({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnToCheckout = (await searchParams).returnTo === "checkout";
  // This curated help reference is available even before the store database is
  // connected. Search never claims to remotely inspect a device or carrier lock.
  const devices = deviceSeeds.map((d) => ({ ...d, supportsEsim: true }));
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">Let’s make sure you’re good to go</div>
        <h1>Will your phone work with an eSIM?</h1>
        <p>
          Check your model, find the eSIM option and confirm your phone is
          unlocked. We’ll guide you through each step before you choose a plan.
        </p>
      </div>
      <div className="compat-overview">
        <a href="#model-search-title">
          <strong>1.</strong> Find your model
        </a>
        <a href="#phone-check-title">
          <strong>2.</strong> Check eSIM support & unlock status
        </a>
        <a href="/destinations">
          <strong>3.</strong> Choose a destination
        </a>
      </div>
      <section style={{ padding: "20px 0 65px" }}>
        <DeviceChecker devices={devices} returnToCheckout={returnToCheckout} />
        <div
          className="compat-guides"
          id="phone-settings-guides"
          aria-label="Phone settings instructions"
        >
          <article className="panel">
            <span className="step-kicker">iPhone</span>
            <h2>Find the eSIM option.</h2>
            <ol>
              <li>Open Settings, then Cellular or Mobile Service.</li>
              <li>Look for Add eSIM or Set Up Cellular.</li>
              <li>
                Go to Settings → General → About. Check Carrier Lock / Network
                Provider Lock for “No SIM restrictions”.
              </li>
            </ol>
            <p>
              Country variants can differ. If the option is missing or a
              restriction is shown, ask Apple or your current carrier.
            </p>
            <a
              href="https://support.apple.com/en-us/109316"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Apple’s carrier unlock guide ↗
            </a>
          </article>
          <article className="panel">
            <span className="step-kicker">Android</span>
            <h2>Check SIM settings.</h2>
            <ol>
              <li>Samsung: Settings → Connections → SIM manager → Add eSIM.</li>
              <li>
                Google Pixel: Settings → Network & internet → SIMs → Add SIM →
                Set up an eSIM.
              </li>
              <li>
                For other brands, search Settings for eSIM and ask your carrier
                to confirm the phone is unlocked.
              </li>
            </ol>
            <p>
              Menu names depend on the model and software version. A phone
              listed in a model group is not a guarantee for every variant.
            </p>
            <div className="guide-links">
              <a
                href="https://www.samsung.com/uk/support/mobile-devices/galaxy-esim-and-supported-network-carriers/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Samsung instructions ↗
              </a>
              <a
                href="https://support.google.com/pixelphone/answer/16115470?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Pixel instructions ↗
              </a>
            </div>
          </article>
        </div>
        <div className="info-panel">
          <h2>What happens after you buy?</h2>
          <p>
            After payment is confirmed and your eSIM is issued, we email your
            installation QR code and a private order link. Install over reliable
            Wi-Fi and follow the plan’s activation instructions. Travel eSIM
            plans provide data; do not assume they include a phone number, calls
            or SMS.
          </p>
          <p>
            Buying for someone else? Run these checks on their phone. A model
            name alone cannot confirm a regional variant or a carrier lock. If
            you cannot confirm both checks, contact your carrier before paying.
          </p>
        </div>
      </section>
    </div>
  );
}
