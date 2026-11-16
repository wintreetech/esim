"use client";
import { useEffect } from "react";
export function DestinationViewed({ slug }: { slug: string }) {
  useEffect(() => {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "destination_viewed", destination: slug }),
    });
  }, [slug]);
  return null;
}
