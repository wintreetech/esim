"use client";
import { useState } from "react";
import { Search, Smartphone } from "lucide-react";
type Device = {
  brand: string;
  model: string;
  notes: string;
  supportsEsim: boolean;
};
export function DeviceChecker({ devices }: { devices: Device[] }) {
  const [q, setQ] = useState(""),
    [brand, setBrand] = useState("All brands");
  const results = devices.filter(
    (d) =>
      (brand === "All brands" || d.brand === brand) &&
      `${d.brand} ${d.model}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="device-toolbar">
        <label className="input-search">
          <Search size={18} />
          <input
            placeholder="Search your phone model"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search devices"
          />
        </label>
        <div className="filter-tabs">
          {[
            "All brands",
            "Apple",
            "Samsung",
            "Google",
            "Motorola",
            "Xiaomi",
          ].map((b) => (
            <button
              key={b}
              className={brand === b ? "active" : ""}
              aria-pressed={brand === b}
              onClick={() => setBrand(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
      <div className="device-grid">
        {results.map((d) => (
          <article className="device-card" key={`${d.brand}-${d.model}`}>
            <Smartphone size={28} />
            <div>
              <span>{d.brand}</span>
              <h3>{d.model}</h3>
              <p>{d.notes}</p>
              <p
                style={{
                  marginTop: 8,
                  color: d.supportsEsim ? "#42805b" : "#ae5645",
                }}
              >
                {d.supportsEsim
                  ? "Selected variants support eSIM"
                  : "Does not support eSIM"}
              </p>
            </div>
          </article>
        ))}
      </div>
      {!results.length && (
        <div className="empty-state">
          <Search />
          <h3>Can’t find your phone?</h3>
          <p>
            This list is a starting point. Check your exact model with its
            manufacturer or carrier before purchasing.
          </p>
        </div>
      )}
    </>
  );
}
