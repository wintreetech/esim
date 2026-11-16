import type { Metadata } from "next";
import { FaqList, faqs } from "@/components/ui/faq-list";
import { ButtonLink } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Your eSIM questions, answered",
  description:
    "Simple answers about travel eSIMs, compatible devices, installation, delivery and keeping your phone number.",
  alternates: { canonical: "/faq" },
};
export default function Faq() {
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">A little clarity for the road</div>
        <h1>
          Good questions.
          <br />
          Simple answers.
        </h1>
        <p>Get your bearings before your next adventure.</p>
      </div>
      <div style={{ maxWidth: 850, paddingBottom: 65 }}>
        <FaqList />
        <div style={{ marginTop: 30 }}>
          <ButtonLink secondary href="/support">
            Still need a hand? →
          </ButtonLink>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map(([q, a]) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
