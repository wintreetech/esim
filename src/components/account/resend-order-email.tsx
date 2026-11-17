"use client";
import { useState } from "react";
import { Mail, LoaderCircle } from "lucide-react";
export function ResendOrderEmail({
  orderId,
  configured,
}: {
  orderId: string;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/orders/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Could not request an email. Please try again.",
        );
      setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="email-resend">
      <button
        type="button"
        className="button button-secondary"
        onClick={resend}
        disabled={!configured || busy || Boolean(message)}
      >
        {busy ? (
          <LoaderCircle size={17} className="spin" aria-hidden="true" />
        ) : (
          <Mail size={17} aria-hidden="true" />
        )}
        {busy
          ? "Requesting email…"
          : message
            ? "Email requested"
            : "Resend installation email"}
      </button>
      <p>
        Sent only to the email used for this order. This does not purchase
        another eSIM.
      </p>
      {!configured && (
        <p>
          Email delivery is temporarily unavailable. Open the order to view your
          installation details.
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-text">
          {message}
        </p>
      )}
    </div>
  );
}
