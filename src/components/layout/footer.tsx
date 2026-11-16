import Link from "next/link";
import { ArrowUpRight, Globe2, Heart, LockKeyhole } from "lucide-react";
import { brand } from "@/lib/brand";
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Globe2 size={23} />
            </span>
            {brand.name.toLowerCase()}.
          </Link>
          <p>
            A little data.
            <br />A world of possibility.
          </p>
          <span className="footer-note">
            Made for the way you wander <Heart size={13} />
          </span>
        </div>
        {[
          {
            title: "Explore",
            links: [
              ["All destinations", "/destinations"],
              ["Japan eSIM", "/esim/japan"],
              ["Thailand eSIM", "/esim/thailand"],
              ["Europe eSIM", "/esim/europe"],
            ],
          },
          {
            title: "Good to know",
            links: [
              ["How it works", "/how-it-works"],
              ["Compatible devices", "/compatibility"],
              ["Your account", "/account"],
              ["Help & support", "/support"],
              ["FAQs", "/faq"],
            ],
          },
          {
            title: "The small print",
            links: [
              ["Terms of service", "/legal/terms"],
              ["Privacy policy", "/legal/privacy"],
              ["Refund policy", "/legal/refunds"],
              ["Cookie policy", "/legal/cookies"],
              ["Acceptable use", "/legal/acceptable-use"],
            ],
          },
        ].map((group) => (
          <div key={group.title}>
            <h3>{group.title}</h3>
            {group.links.map(([name, href]) => (
              <Link href={href} key={href}>
                {name}
                <ArrowUpRight size={12} />
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {brand.name}. Go somewhere good.
        </span>
        <span>
          <LockKeyhole size={13} /> Secure payments powered by Stripe
        </span>
        <span>Visa &nbsp; Mastercard &nbsp; Apple Pay</span>
      </div>
    </footer>
  );
}
