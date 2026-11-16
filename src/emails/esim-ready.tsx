/* eslint-disable @next/next/no-img-element -- email clients require standard HTML images. */
import { brand } from "@/lib/brand";
export function EsimReadyEmail({
  orderLink,
  items,
  topUp = false,
  testMode = false,
}: {
  orderLink: string;
  items: {
    destinationName: string;
    name: string;
    dataLabel: string;
    validityDays: number;
    qrCid?: string;
  }[];
  topUp?: boolean;
  testMode?: boolean;
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          backgroundColor: "#f5f3ed",
          fontFamily: "Arial, sans-serif",
          color: "#25222f",
        }}
      >
        <table
          role="presentation"
          style={{ width: "100%", padding: "30px 15px" }}
        >
          <tbody>
            <tr>
              <td>
                <table
                  role="presentation"
                  style={{
                    maxWidth: 560,
                    width: "100%",
                    margin: "0 auto",
                    backgroundColor: "white",
                    borderRadius: 16,
                    padding: 30,
                  }}
                >
                  <tbody>
                    <tr>
                      <td>
                        <h1 style={{ color: "#6747e8", fontSize: 28 }}>
                          {brand.name.toLowerCase()}.
                        </h1>
                        <h2>
                          {testMode
                            ? "Your API test completed."
                            : topUp
                              ? "A little more exploring power."
                              : "Your next adventure is connected."}
                        </h2>
                        {testMode && (
                          <p>
                            This is an integration test. No real eSIM was issued
                            and the supplier wallet was not charged. There is no
                            installable QR code in this email.
                          </p>
                        )}
                        <p style={{ fontSize: 14, lineHeight: 1.8 }}>
                          Thanks for choosing {brand.name}.{" "}
                          {testMode
                            ? "Use the private order link below to review the test result."
                            : topUp
                              ? "Your data top-up is complete."
                              : "Your travel eSIM is ready. Keep this email safe, and install over a reliable Wi-Fi connection."}
                        </p>
                        {items.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "18px 0",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            <h3>{item.destinationName}</h3>
                            <p>
                              {item.dataLabel} · {item.validityDays} days ·{" "}
                              {item.name}
                            </p>
                            {item.qrCid && (
                              <p>
                                <img
                                  src={`cid:${item.qrCid}`}
                                  alt="Your eSIM installation QR code"
                                  width={200}
                                  height={200}
                                />
                              </p>
                            )}
                          </div>
                        ))}
                        <p style={{ margin: "28px 0" }}>
                          <a
                            href={orderLink}
                            style={{
                              backgroundColor: "#6747e8",
                              color: "white",
                              padding: "15px 22px",
                              borderRadius: 8,
                              textDecoration: "none",
                              display: "inline-block",
                            }}
                          >
                            View order & installation guide →
                          </a>
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: "#777",
                            lineHeight: 1.8,
                          }}
                        >
                          This private link expires in 7 days. You can also sign
                          in with your purchase email to view your order. Don’t
                          share your QR code or activation details.
                        </p>
                        <p style={{ fontSize: 12, color: "#777" }}>
                          Do not delete your installed eSIM unless support asks
                          you to.
                        </p>
                        <p>
                          <a
                            href={`${brand.url}/support`}
                            style={{ color: "#6747e8" }}
                          >
                            Need a hand?
                          </a>{" "}
                          ·{" "}
                          <a
                            href={`${brand.url}/account`}
                            style={{ color: "#6747e8" }}
                          >
                            Your account
                          </a>
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
