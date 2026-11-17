import type { Metadata } from "next";
import { notFound } from "next/navigation";
const pages: Record<string, { title: string; text: string[] }> = {
  terms: {
    title: "Terms of Service",
    text: [
      "This draft describes a proposed travel data reseller service. An eSIM plan provides data connectivity according to its supplier’s coverage, activation, validity, and fair use rules. Data-only plans do not include standard voice calls or SMS.",
      "Before purchase, customers must check device compatibility, carrier unlock status, supported destinations, and plan details. Orders are fulfilled only after verified payment. Delivery depends on provider availability. The final terms must define operator identity, applicable law, dispute resolution, service limits, and consumer rights.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    text: [
      "The application processes purchase email, optional name, order history, payment references, and eSIM details to deliver the service. The payment provider handles payment card information; this application does not store full card details. Supabase supports sign-in, the supplier provisions data plans, and Resend delivers transactional email.",
      "The operator must document legal bases, processors, data locations, retention periods, deletion requests, user rights, security controls, analytics configuration, and a privacy contact before launch. Activation details and private access links should be treated as confidential.",
    ],
  },
  refunds: {
    title: "Refund Policy",
    text: [
      "Refund eligibility may depend on whether an eSIM has been issued, installed, or used, and on applicable consumer law. Contact support with your order reference if you cannot use a purchased plan. Keep your eSIM installed while troubleshooting.",
      "If payment succeeds and provisioning fails, the order is retained for retry or a refund decision. This draft is not a blanket promise or restriction of refunds. The operator must publish specific timelines, eligibility, statutory rights, and a working contact channel before selling live plans.",
    ],
  },
  cookies: {
    title: "Cookie Policy",
    text: [
      "Essential cookies maintain secure authentication and private guest-order access. Browser local storage remembers the shopping cart and currency choice. These storage mechanisms support the requested shopping experience.",
      "Optional analytics are disabled unless the operator configures an analytics collector. The operator must assess local consent requirements, disclose storage lifetimes and any third parties, and implement consent before enabling tracking that requires it.",
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    text: [
      "Use connectivity lawfully and follow the local network and plan rules. Do not use the service for fraud, network abuse, or prohibited activity. Do not distribute private activation codes or attempt to access other customers’ orders.",
      "The operator must define fair use, prohibited uses, enforcement, suspension, appeals, and supplier-specific restrictions in a reviewed final policy. Coverage, tethering and speed limitations must be accurately reflected in each plan.",
    ],
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: pages[slug]?.title || "Legal",
    robots: { index: false, follow: true },
    alternates: { canonical: `/legal/${slug}` },
  };
}
export default async function Legal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  return (
    <div className="container">
      <article className="prose">
        <div className="eyebrow">The small print</div>
        <h1>{page.title}</h1>
        <p className="warning">
          Placeholder draft. This content requires professional legal review,
          operator details, and jurisdiction-specific terms before production
          use.
        </p>
        {page.text.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <h2>Questions or requests</h2>
        <p>
          Visit <a href="/support">support</a> for the operator’s contact
          information. This draft is for development and does not replace a
          reviewed legal policy.
        </p>
      </article>
    </div>
  );
}
