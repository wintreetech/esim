import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Signal,
  Smartphone,
  Sparkles,
  Wifi,
  Zap,
} from "lucide-react";
import { catalogContext } from "@/lib/catalog";
import { DestinationSearch } from "@/components/esim/destination-search";
import { DestinationExplorer } from "@/components/esim/destination-explorer";
import { PlanCard } from "@/components/esim/plan-card";
import { ButtonLink } from "@/components/ui/button";
import { FaqList } from "@/components/ui/faq-list";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { destinations } = await catalogContext();
  const featured = ["thailand", "japan", "indonesia", "europe"].flatMap(
    (slug) => {
      const d = destinations.find((x) => x.slug === slug);
      return d?.plans[2] ? [d.plans[2]] : [];
    },
  );
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                Your passport to better connections
              </div>
              <h1>
                Go somewhere.
                <br />
                Stay <em>connected.</em>
              </h1>
              <p className="hero-description">
                Big adventures. Tiny eSIM.
                <br />
                Travel data that’s ready when you are, so you can spend less
                time finding Wi-Fi and more time finding yourself.
              </p>
              <DestinationSearch
                destinations={destinations.map(({ name, slug, flagEmoji }) => ({
                  name,
                  slug,
                  flagEmoji,
                }))}
              />
              <div className="trending">
                <span>On your radar:</span>
                <Link href="/esim/japan">🇯🇵 Japan</Link>
                <Link href="/esim/thailand">🇹🇭 Thailand</Link>
                <Link href="/esim/europe">🇪🇺 Europe</Link>
              </div>
              <div className="hero-proof">
                <ShieldCheck size={15} />
                <span>No roaming surprises</span>
                <span>No SIM swaps</span>
                <Link
                  href="/compatibility"
                  className="text-link"
                  style={{ fontSize: 14 }}
                >
                  Check your phone <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
            <div className="hero-art">
              <div className="hero-orbit" />
              <div className="hero-photo">
                <Image
                  src="/images/hero-coast.webp"
                  alt="Turquoise water meeting a sunlit tropical coastline"
                  fill
                  priority
                  sizes="(max-width: 600px) 350px, 50vw"
                />
              </div>
              <div className="hero-stamp">
                <Globe2 />
                <span>LESS ROAMING</span>
                <strong>MORE LIVING</strong>
              </div>
              <div className="floating-card connected-card">
                <span>
                  <Signal size={20} />
                </span>
                <div>
                  <strong>You’re connected.</strong>
                  <p>Next stop? Anywhere.</p>
                </div>
                <CheckCircle2 size={16} color="#449767" />
              </div>
              <div className="floating-card destination-float">
                <span>🌴</span>
                <div>
                  <strong>Out of office. Online.</strong>
                  <p>A little data goes a long way.</p>
                </div>
              </div>
              <span className="hero-caption">
                Take the scenic route. We’ll keep up.
              </span>
            </div>
          </div>
          <div className="trust-strip">
            {[
              [Zap, "Digital delivery"],
              [Globe2, "10 places. Endless possibilities."],
              [LockKeyhole, "Secure checkout"],
              [HeartHandshake, "Here when you need us"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Zap;
              return (
                <div className="trust-item" key={String(text)}>
                  <I />
                  <span>{String(text)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section container" id="destinations">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A change of scenery</div>
            <h2>Where to next?</h2>
            <p>Pick a place. We’ll help you feel right at home.</p>
          </div>
          <Link href="/destinations" className="text-link">
            Explore all destinations
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <DestinationExplorer destinations={destinations} compact />
        <div className="destinations-footer">
          <ButtonLink secondary href="/destinations">
            Find your next destination
            <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>
      <section className="section steps-section">
        <div className="container">
          <div className="steps-top">
            <div className="eyebrow">Less setup. More sunsets.</div>
            <h2>Your trip starts in three little steps.</h2>
            <p>No shops. No plastic. No complicated goodbyes to your SIM.</p>
          </div>
          <div className="steps-grid">
            {[
              {
                icon: MapPin,
                title: "Choose your somewhere",
                text: "Find your destination and a connection for the places on your list.",
              },
              {
                icon: Smartphone,
                title: "Find your just-right plan",
                text: "A quick city break or a longer escape? Pick the data that fits your trip.",
              },
              {
                icon: QrCode,
                title: "Scan. Connect. Go.",
                text: "Get your eSIM digitally, follow the installation guide, and head out.",
              },
            ].map((s, i) => (
              <div className="step" key={s.title}>
                <div className="step-icon">
                  <s.icon />
                  <span className="step-number">0{i + 1}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section container">
        <div className="feature-heading">
          <div className="eyebrow">Room for the good stuff</div>
          <h2>Travel lighter. Connect easier.</h2>
          <p>All the essentials, without the extra baggage.</p>
        </div>
        <div className="benefits-grid">
          {[
            {
              icon: Zap,
              title: "Straight to your inbox",
              text: "Your eSIM is delivered digitally after payment and provider confirmation.",
            },
            {
              icon: Smartphone,
              title: "One less thing to pack",
              text: "Keep your physical SIM in place. Your new data plan lives on your phone.",
            },
            {
              icon: ShieldCheck,
              title: "Small prices. No surprises.",
              text: "See your total before you pay. Choose what you need for the way you travel.",
            },
            {
              icon: LockKeyhole,
              title: "A safer way to check out",
              text: "Pay securely online. We never store your card details.",
            },
            {
              icon: MessageCircle,
              title: "Same number. New memories.",
              text: "Keep your WhatsApp number and stay close to your favorite people.",
            },
            {
              icon: Globe2,
              title: "Your connection, on hand",
              text: "Find your plans and installation details in your account, whenever you need them.",
            },
          ].map((b) => (
            <div className="benefit" key={b.title}>
              <span>
                <b.icon size={21} />
              </span>
              <div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {!!featured.length && (
        <section className="section container" style={{ paddingTop: 10 }}>
          <div className="section-heading">
            <div>
              <div className="eyebrow">A few good connections</div>
              <h2>Little plans. Big possibilities.</h2>
            </div>
            <Link className="text-link" href="/destinations">
              Find your plan
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="plan-grid">
            {featured.map((p, i) => (
              <PlanCard key={p.id} plan={p} popular={i === 1} />
            ))}
          </div>
        </section>
      )}
      <section className="container">
        <div className="compat-banner">
          <div>
            <div className="eyebrow">
              <Sparkles size={13} />
              Before you set off
            </div>
            <h2>
              Ready for an eSIM?
              <br />
              Let’s check your phone.
            </h2>
            <p>
              Most newer phones are already on board. Find yours in our
              compatibility checker before you buy.
            </p>
            <ButtonLink href="/compatibility">
              Check my device
              <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
          <div className="phone-art" aria-hidden="true">
            <div className="phone-outline">
              <Globe2 size={40} />
              <span>Hello, world.</span>
              <Check size={18} />
            </div>
            <div className="phone-outline">
              <Wifi size={35} />
              <span>You’re good to go.</span>
            </div>
          </div>
        </div>
      </section>
      <section className="section container faq-section">
        <div className="faq-intro">
          <div className="eyebrow">A little clarity</div>
          <h2>
            Good questions.
            <br />
            Simple answers.
          </h2>
          <p>New to eSIMs? We’ll help you get your bearings.</p>
          <Link href="/faq" className="text-link">
            All your questions, answered
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <FaqList limit={4} />
      </section>
      <div className="container">
        <div className="newsletter-strip">
          <div>
            <h2>The world is calling. Pick up.</h2>
            <p>Find a little connection for your next big adventure.</p>
          </div>
          <ButtonLink href="/destinations">
            Let’s go somewhere
            <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
