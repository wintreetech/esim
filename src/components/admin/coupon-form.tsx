"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function CouponForm() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="panel"
      style={{ marginTop: 30 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          const expiry = String(f.get("expiresAt") || "");
          const r = await fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "coupon",
              code: f.get("code"),
              percentOff: Number(f.get("percentOff")),
              fixedOff: Math.round(Number(f.get("fixedOff")) * 100),
              minSubtotal: Math.round(Number(f.get("minSubtotal")) * 100),
              maxUses: f.get("maxUses") ? Number(f.get("maxUses")) : null,
              expiresAt: expiry ? new Date(expiry).toISOString() : null,
              active: f.get("active") === "on",
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setMessage("Coupon saved. Existing codes are updated.");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Couldn’t save coupon.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Create or update a coupon</h2>
      <div className="field-row">
        <label className="field">
          Code
          <input name="code" required pattern="[A-Za-z0-9_-]{3,40}" />
        </label>
        <label className="field">
          Percent off
          <input
            name="percentOff"
            type="number"
            min="0"
            max="100"
            defaultValue="0"
            required
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          Fixed discount (USD)
          <input
            name="fixedOff"
            type="number"
            min="0"
            step=".01"
            defaultValue="0"
            required
          />
        </label>
        <label className="field">
          Minimum spend (USD)
          <input
            name="minSubtotal"
            type="number"
            min="0"
            step=".01"
            defaultValue="0"
            required
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          Maximum uses (blank = unlimited)
          <input name="maxUses" type="number" min="1" />
        </label>
        <label className="field">
          Expiry (your local time)
          <input name="expiresAt" type="datetime-local" />
        </label>
      </div>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked />
        Active
      </label>
      <p style={{ fontSize: 11, marginBottom: 20 }}>
        Discounts are capped to preserve the configured minimum margin. Uses
        include pending checkout reservations.
      </p>
      <Button disabled={busy}>{busy ? "Saving…" : "Save coupon"}</Button>
      {message && (
        <p style={{ fontSize: 12, marginTop: 15 }} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
