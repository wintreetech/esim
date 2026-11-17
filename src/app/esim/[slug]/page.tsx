import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ShieldCheck, Wifi, Zap } from "lucide-react";
import { catalogContext } from "@/lib/catalog";
import { PlanCard } from "@/components/esim/plan-card";
import { Price } from "@/components/ui/price";
import { FaqList } from "@/components/ui/faq-list";
import { brand } from "@/lib/brand";
import { DestinationViewed } from "@/components/esim/destination-viewed";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { destinations } = await catalogContext();
  const d = destinations.find((d) => d.slug === slug);
  if (!d) return {};
  return {
    title: `${d.name} eSIM — Flexible travel data`,
    description: `Explore ${d.name} with a digital travel eSIM. Compare data plans and get installation details delivered to your inbox.`,
    alternates: { canonical: `/esim/${slug}` },
    openGraph: {
      title: `${d.name} eSIM | ${brand.name}`,
      description: d.description,
      images: [d.imageUrl],
    },
  };
}
export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { destinations } = await catalogContext();
  const d = destinations.find((d) => d.slug === slug);
  if (!d) notFound();
  return (
    <div className="container">
      <DestinationViewed slug={slug} />
      <div className="page-hero" style={{ paddingBottom: 0 }}>
        <nav className="breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={12} />
          <Link href="/destinations">Destinations</Link>
          <ChevronRight size={12} />
          <span>{d.name}</span>
        </nav>
      </div>
      <section className="destination-hero">
        <div>
          <div className="eyebrow">{d.flagEmoji} Your next good connection</div>
          <h1>{d.name} eSIM</h1>
          <p>{d.description}</p>
          <div className="destination-specs">
            <span>
              <Zap size={14} />
              Digital delivery
            </span>
            <span>
              <ShieldCheck size={14} />
              Secure payment
            </span>
            <span>
              <Wifi size={14} />
              Data-only plans
            </span>
          </div>
          <p style={{ fontSize: 14 }}>
            Network capabilities vary by plan and local coverage.{" "}
            <Link
              href="/compatibility"
              className="text-link"
              style={{ fontSize: 14 }}
            >
              Check your device before buying ↗
            </Link>
          </p>
        </div>
        <div className="destination-hero-image">
          <Image
            src={d.imageUrl}
            alt={`Travel in ${d.name}`}
            fill
            priority
            sizes="(max-width: 600px) 100vw, 50vw"
          />
        </div>
      </section>
      <section id="plans">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A plan for your kind of trip</div>
            <h2>How much adventure?</h2>
            <p>Choose your data. Pay once. Keep exploring.</p>
          </div>
        </div>
        {d.plans.length ? (
          <div className="plan-grid">
            {d.plans.map((p, i) => (
              <PlanCard key={p.id} plan={p} popular={i === 2} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>We’re getting connected.</h3>
            <p>
              No active plans for this destination yet. Please check back soon.
            </p>
          </div>
        )}
        <div className="info-panel">
          <h2>A few things before you go</h2>
          <p>
            These plans provide mobile data, without a local voice number or
            SMS. Your device must be eSIM compatible and carrier unlocked.
            Network:{" "}
            {[...new Set(d.plans.map((p) => p.network).filter(Boolean))].join(
              ", ",
            ) || "To be confirmed"}
            . Speed and coverage depend on your location. Validity and
            activation rules are included with your eSIM.{" "}
            {d.isoCode === "EU" &&
              "Regional coverage is supplier specific; confirm your exact countries with support before purchasing."}
          </p>
        </div>
      </section>
      <section className="section faq-section">
        <div>
          <div className="eyebrow">Travel with a little clarity</div>
          <h2>Before you take off.</h2>
        </div>
        <FaqList limit={4} />
      </section>
      {!!d.plans.length && (
        <div className="mobile-buy">
          <div>
            Plans from
            <strong>
              <Price cents={Math.min(...d.plans.map((p) => p.retailPrice))} />
            </strong>
          </div>
          <a className="button" href="#plans">
            Choose your plan ↑
          </a>
        </div>
      )}
    </div>
  );
}
