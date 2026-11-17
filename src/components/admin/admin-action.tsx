"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function AdminAction({
  payload,
  children,
}: {
  payload: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <Button
        secondary
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setMessage("Saved.");
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Request failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : children}
      </Button>
      {message && (
        <p style={{ fontSize: 14, marginTop: 8 }} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
