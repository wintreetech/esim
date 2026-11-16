import type { Metadata } from "next";
import { BookOpen, Mail, Smartphone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "A little help along the way",
  description:
    "Get help with your travel eSIM, installation, payment or order.",
  alternates: { canonical: "/support" },
};
export default function Support() {
  const email = process.env.ADMIN_EMAIL;
  return (
    <div className="container">
      <div className="page-hero">
        <div className="eyebrow">We’re here for the little hiccups</div>
        <h1>Let’s get you connected.</h1>
        <p>
          Start with a guide, or get in touch about your order. Never share your
          QR code or activation details publicly.
        </p>
      </div>
      <div className="support-grid" style={{ paddingBottom: 65 }}>
        <div className="panel">
          <BookOpen color="#6747e8" />
          <h2 style={{ marginTop: 20 }}>A little guidance</h2>
          <p>
            From the basics to keeping your number, our answers will help you
            find your way.
          </p>
          <ButtonLink secondary href="/faq">
            Explore the FAQs →
          </ButtonLink>
        </div>
        <div className="panel">
          <Smartphone color="#6747e8" />
          <h2 style={{ marginTop: 20 }}>Your eSIM essentials</h2>
          <p>
            Sign in with your purchase email to find your QR code and
            installation instructions.
          </p>
          <ButtonLink secondary href="/account/esims">
            Find my eSIM →
          </ButtonLink>
        </div>
        <div className="panel">
          <Mail color="#6747e8" />
          <h2 style={{ marginTop: 20 }}>Talk to a human</h2>
          <p>
            Include your order reference and describe what’s happening. Please
            leave out card details and activation codes.
          </p>
          {email ? (
            <a
              className="button"
              href={`mailto:${email}?subject=Travel%20eSIM%20support`}
            >
              Email support →
            </a>
          ) : (
            <p className="preview-notice">
              Our support contact is being configured. The operator must add a
              support address before accepting live orders.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
