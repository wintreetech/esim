"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function UsageRefresh({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <>
      <Button
        secondary
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch(
              `/api/esim/usage?id=${encodeURIComponent(id)}`,
            );
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setMessage(
              d.dataUsedMb === null
                ? "This provider does not report usage for this eSIM."
                : "Usage updated.",
            );
            router.refresh();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Couldn’t refresh usage.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw size={14} />
        {busy ? "Checking…" : "Refresh usage"}
      </Button>
      {message && (
        <p
          className="muted"
          style={{ fontSize: 14, marginTop: 10 }}
          role="status"
        >
          {message}
        </p>
      )}
    </>
  );
}
