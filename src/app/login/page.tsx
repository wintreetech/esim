import type { Metadata } from "next";
import { LoginForm } from "@/components/account/login-form";
import { authConfigured } from "@/lib/auth";
import { MailCheck, ShoppingBag, Smartphone, ShieldCheck } from "lucide-react";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="container">
      <div className="login-layout">
        <section className="login-intro">
          <div className="eyebrow">Your account</div>
          <h1>
            Your travels.
            <br />
            All in one place.
          </h1>
          <p>
            Sign in with your purchase email to find your orders and
            installation details.
          </p>
          <div className="login-benefits">
            {[
              [
                ShoppingBag,
                "Every order",
                "See purchases made with this email, including guest checkouts.",
              ],
              [
                Smartphone,
                "Your eSIM details",
                "Open issued eSIMs and their installation instructions.",
              ],
              [
                MailCheck,
                "Need the email again?",
                "Request another installation email from a fulfilled order.",
              ],
              [
                ShieldCheck,
                "A secure link",
                "No password to remember. Only someone with access to your inbox can sign in.",
              ],
            ].map(([Icon, title, text]) => {
              const BenefitIcon = Icon as typeof ShoppingBag;
              return (
                <div className="login-benefit" key={String(title)}>
                  <BenefitIcon size={21} aria-hidden="true" />
                  <div>
                    <h2>{String(title)}</h2>
                    <p>{String(text)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="login-form-column">
          {error && (
            <p className="warning">
              That link has expired or could not be verified. Sign in below to
              access orders placed with your email.
            </p>
          )}
          <LoginForm
            configured={authConfigured() && Boolean(process.env.DATABASE_URL)}
          />
        </div>
      </div>
    </div>
  );
}
