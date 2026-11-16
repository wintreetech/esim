"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import type { PublicDestination } from "@/lib/catalog";
export function DestinationSearch({
  destinations,
}: {
  destinations: Pick<PublicDestination, "name" | "slug" | "flagEmoji">[];
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const results = destinations.filter((d) =>
    `${d.name} ${d.slug}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="search-wrapper">
      <form className="hero-search" action="/destinations">
        <Search size={21} />
        <input
          name="q"
          placeholder="Where are you travelling?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoComplete="off"
          aria-label="Search destinations"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={focused}
          aria-controls="destination-results"
        />
        <button aria-label="Search destinations">
          <ArrowRight size={23} />
        </button>
      </form>
      {focused && (
        <div className="autocomplete" id="destination-results">
          {results.slice(0, 6).map((d) => (
            <Link key={d.slug} href={`/esim/${d.slug}`}>
              <span>
                {d.flagEmoji} &nbsp; {d.name}
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
          {!results.length && (
            <p>We haven’t landed there yet. Try another destination.</p>
          )}
        </div>
      )}
    </div>
  );
}
