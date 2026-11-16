"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function SupplierReconcile({ orderItemId }: { orderItemId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, orderItemId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage("Supplier reconciliation saved.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not reconcile this service.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ marginTop: 14, maxWidth: 600 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit({
            action: "reconcile-service",
            serviceId: new FormData(e.currentTarget).get("serviceId"),
          });
        }}
      >
        <label className="field">
          Existing ResellPortal service ID
          <input
            name="serviceId"
            required
            maxLength={150}
            placeholder="Service ID from the supplier order"
          />
        </label>
        <Button secondary disabled={busy}>
          {busy ? "Checking supplier…" : "Verify and link existing service"}
        </Button>
      </form>
      <details style={{ marginTop: 24 }}>
        <summary>No supplier purchase exists?</summary>
        <form
          style={{ marginTop: 15 }}
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void submit({
              action: "authorize-supplier-retry",
              confirmedNoPurchase: data.get("confirmed") === "on",
              reason: data.get("reason"),
            });
          }}
        >
          <p className="warning">
              Only use this after checking customer services and wallet
            transactions in ResellPortal. A new attempt can charge the wallet.
          </p>
          <label className="check-label">
            <input name="confirmed" type="checkbox" required />I verified that
            no supplier purchase was created and authorise one new attempt.
          </label>
          <label className="field">
            Reconciliation notes
            <textarea name="reason" required minLength={10} maxLength={500} />
          </label>
          <Button secondary disabled={busy}>
            Authorise a new supplier attempt
          </Button>
        </form>
      </details>
      {message && (
        <p style={{ fontSize: 12, marginTop: 10 }} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
