import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PublicDestination } from "@/lib/catalog";
import { Price } from "@/components/ui/price";
export function DestinationCard({
  destination: d,
  rate,
}: {
  destination: PublicDestination;
  rate: number;
}) {
  const price = d.plans.length
    ? Math.min(...d.plans.map((p) => p.retailPrice))
    : null;
  return (
    <Link href={`/esim/${d.slug}`} className="destination-card">
      <div className="destination-image">
        <Image
          src={d.imageUrl}
          alt={`Explore ${d.name}`}
          fill
          sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 24vw"
        />
        <span className="flag-bubble">{d.flagEmoji}</span>
        {d.slug === "japan" && (
          <span className="photo-badge">A traveler favorite</span>
        )}
      </div>
      <div className="destination-info">
        <div>
          <h3>{d.name}</h3>
          <p>
            {price !== null ? (
              <>
                From{" "}
                <strong>
                  <Price cents={price} rate={rate} />
                </strong>
              </>
            ) : (
              "Plans coming soon"
            )}
            {price !== null && <span> / trip</span>}
          </p>
        </div>
        <span className="round-arrow" aria-label="View plans">
          <ArrowUpRight size={20} />
        </span>
      </div>
    </Link>
  );
}
