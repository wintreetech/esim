"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { DestinationCard } from "./destination-card";
import type { PublicDestination } from "@/lib/catalog";
export function DestinationExplorer({
  destinations,
  rate,
  initialQuery = "",
  compact = false,
}: {
  destinations: PublicDestination[];
  rate: number;
  initialQuery?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState(initialQuery);
  const [region, setRegion] = useState("All destinations");
  const results = destinations.filter(
    (d) =>
      `${d.name} ${d.slug}`.toLowerCase().includes(q.toLowerCase()) &&
      (region === "All destinations" ||
        (region === "Regional"
          ? d.isoCode === "EU"
          : d.region === region && d.isoCode !== "EU")),
  );
  return (
    <>
      <div className="explorer-toolbar">
        <div className="filter-tabs" aria-label="Filter destinations">
          {[
            "All destinations",
            "Asia",
            "Europe",
            "Americas",
            "Middle East",
            "Regional",
          ].map((r) => (
            <button
              key={r}
              className={region === r ? "active" : ""}
              aria-pressed={region === r}
              onClick={() => setRegion(r)}
            >
              {r}
            </button>
          ))}
        </div>
        {!compact && (
          <label className="input-search">
            <Search size={18} />
            <input
              placeholder="Search a country or region"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="destination-grid">
        {results.map((d) => (
          <div key={d.id}>
            <DestinationCard destination={d} rate={rate} />
            {!compact && (
              <p className="plan-count">
                {d.plans.length} data plans ·{" "}
                {d.isoCode === "EU" ? "Regional" : d.region}
              </p>
            )}
          </div>
        ))}
      </div>
      {!results.length && (
        <div className="empty-state">
          <Search size={30} />
          <h3>No destinations found</h3>
          <p>Try another country or choose a different region.</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setQ("");
              setRegion("All destinations");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
