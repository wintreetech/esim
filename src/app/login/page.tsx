import type { Metadata } from "next";
import { LoginForm } from "@/components/account/login-form";
import { authConfigured } from "@/lib/auth";
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
      <div className="login-box">
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
  );
}
