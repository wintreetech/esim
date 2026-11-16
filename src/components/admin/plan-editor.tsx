"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PlanEditor({
  id,
  retail,
  active,
}: {
  id: string;
  retail: number | null;
  active: boolean;
}) {
  const [price, setPrice] = useState(
      retail === null ? "" : (retail / 100).toFixed(2),
    ),
    [enabled, setEnabled] = useState(active),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      style={{ display: "flex", gap: 10, alignItems: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("Saving…");
        try {
          const r = await fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "plan",
              id,
              retailOverride:
                price === "" ? null : Math.round(Number(price) * 100),
              active: enabled,
            }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          setMessage("Saved");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Failed");
        }
      }}
    >
      <input
        className="table-input"
        type="number"
        min="0"
        step=".01"
        placeholder="Auto"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        aria-label="USD retail override"
      />
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Active
      </label>
      <button type="submit" className="text-link">
        Save
      </button>
      <span style={{ maxWidth: 180, whiteSpace: "normal" }} role="status">
        {message}
      </span>
    </form>
  );
}
