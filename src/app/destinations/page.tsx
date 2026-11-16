import type { Metadata } from "next";
import { catalogContext } from "@/lib/catalog";
import { DestinationExplorer } from "@/components/esim/destination-explorer";
export const metadata: Metadata = {
  title: "Explore destinations",
  description:
    "Find a travel eSIM for Thailand, Japan, Europe, and more. Compare data plans for your next adventure.",
  alternates: { canonical: "/destinations" },
};
export const dynamic = "force-dynamic";
export default async function Destinations({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { destinations, rate } = await catalogContext();
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">A world of possibility</div>
        <h1>Find your somewhere.</h1>
        <p>
          From familiar favorites to first-time discoveries. Choose your
          destination, then find the data to take you there.
        </p>
      </div>
      <section style={{ paddingBottom: 80 }}>
        <DestinationExplorer
          destinations={destinations}
          rate={rate}
          initialQuery={q}
        />
      </section>
    </div>
  );
}
