import { esimQrImage } from "@/lib/esim/qr-image";
import Image from "next/image";
import Link from "next/link";
import type { accessibleEsim } from "@/lib/order-access";
import { UsageRefresh } from "./usage-refresh";
import { db } from "@/lib/db";
export async function EsimDetail({
  esim: e,
}: {
  esim: Awaited<ReturnType<typeof accessibleEsim>>;
}) {
  const qr = e.testMode ? null : await esimQrImage(e).catch(() => null);
  const topups =
    process.env.ENABLE_TOPUPS === "true" && e.orderItem.plan.supportsTopup
      ? await db().plan.findMany({
          where: {
            destinationId: e.orderItem.plan.destinationId,
            provider: e.orderItem.provider,
            active: true,
            supportsTopup: true,
          },
          select: { id: true, name: true },
        })
      : [];
  return (
    <>
      {e.testMode && (
        <p className="warning">
          API test order · ResellPortal did not issue a real eSIM or charge the
          wallet. These installation details cannot provide mobile data.
        </p>
      )}
      <div className="esim-detail">
        <div className="panel qr-box">
          <span className="eyebrow">Your private connection</span>
          <h2>{e.orderItem.destinationName}</h2>
          {qr ? (
            <Image
              src={qr.dataUrl}
              alt="Private eSIM installation QR code"
              width={230}
              height={230}
              unoptimized
            />
          ) : (
            <p className="warning">
              {e.testMode
                ? "Test orders do not contain an installable QR code."
                : "The installation image is temporarily unavailable. Please contact support with your order reference."}
            </p>
          )}
          <p style={{ fontSize: 11 }}>
            Scan this QR code from your phone’s Add eSIM settings using another
            screen. Keep it private.
          </p>
          <span className="status">{e.status.replaceAll("_", " ")}</span>
          <p style={{ fontSize: 11 }}>
            ICCID ending in {e.iccid.slice(-4).padStart(e.iccid.length, "•")}
          </p>
          <p style={{ fontSize: 11 }}>
            {e.dataUsedMb === null
              ? "Usage unavailable"
              : `${(e.dataUsedMb / 1024).toFixed(2)} GB used of ${(e.dataTotalMb / 1024).toFixed(1)} GB`}
          </p>
          <UsageRefresh id={e.id} />
        </div>
        <div className="panel">
          <h2>Make yourself at home.</h2>
          <p style={{ fontSize: 12, marginBottom: 20 }}>
            {e.orderItem.dataLabel} · {e.orderItem.validityDays} days. Connect
            to Wi-Fi before installing.
          </p>
          <div className="faq-list">
            <details open>
              <summary>
                Install on iPhone<span>+</span>
              </summary>
              <ol className="instruction-list">
                <li>Open Settings → Mobile Service / Cellular.</li>
                <li>Tap Add eSIM → Use QR Code.</li>
                <li>Scan your code and follow the prompts.</li>
                <li>Label the line “Travel” and use it for mobile data.</li>
                <li>
                  At your destination, enable data roaming on the travel line if
                  your provider instructions require it.
                </li>
                <li>Disable data roaming on your home SIM to avoid charges.</li>
              </ol>
            </details>
            <details>
              <summary>
                Install on Android<span>+</span>
              </summary>
              <ol className="instruction-list">
                <li>Open Settings → Connections / Network & internet.</li>
                <li>Choose SIM manager / SIMs → Add eSIM.</li>
                <li>Scan the QR code and follow the prompts.</li>
                <li>Select the travel eSIM for mobile data.</li>
                <li>
                  Follow your provider’s activation and roaming instructions.
                </li>
              </ol>
            </details>
            {!e.testMode && (e.activationCode || e.smdpAddress) && (
              <details>
                <summary>
                  Enter details manually<span>+</span>
                </summary>
                <p>
                  In Add eSIM, select the manual entry option and use these
                  details.
                </p>
                {e.smdpAddress && (
                  <label className="field">
                    SM-DP+ address
                    <span className="code-block">
                      {e.smdpAddress || "See provider instructions"}
                    </span>
                  </label>
                )}
                {e.activationCode && (
                  <label className="field">
                    Activation code
                    <span className="code-block">{e.activationCode}</span>
                  </label>
                )}
              </details>
            )}
          </div>
          <p className="warning">
            Do not delete your eSIM after installation unless instructed by
            support. Installation codes may only work once.
          </p>
          <p style={{ fontSize: 11 }}>
            Device menus vary by model and software. Your plan’s activation and
            expiry rules take precedence.{" "}
            {e.expiresAt
              ? `Expiry: ${e.expiresAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}.`
              : "The provider has not supplied an expiry date yet."}
          </p>
        </div>
      </div>
      {topups.length > 0 && (
        <div className="panel" style={{ marginBottom: 40 }}>
          <h2>A little further to go?</h2>
          <p style={{ fontSize: 12, marginBottom: 20 }}>
            Choose a top-up. We’ll confirm the price and take you to secure
            payment before adding data.
          </p>
          <div className="admin-actions">
            {topups.map((p) => (
              <Link
                key={p.id}
                className="button button-secondary"
                href={`/checkout?topup=${e.id}&plan=${p.id}`}
              >
                {p.name} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
