"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
export function LoginForm({ configured }: { configured: boolean }) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: new FormData(e.currentTarget).get("email"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      setCooldown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <Mail size={29} color="#6747e8" />
      <h2 style={{ marginTop: 20 }}>Hello again, wanderer.</h2>
      <p>
        Enter the email you used at checkout. We’ll send you a secure sign-in
        link. No password to remember.
      </p>
      <label className="field">
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          maxLength={254}
        />
      </label>
      {!configured && (
        <p className="preview-notice">
          Account sign-in is temporarily unavailable. You can still open an
          existing order using the private link in your eSIM email, or contact
          support for help.
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-text" role="status">
          {message}
        </p>
      )}
      <Button
        className="full-width"
        disabled={!configured || busy || cooldown > 0}
      >
        {busy
          ? "Sending your link…"
          : cooldown
            ? `Send again in ${cooldown}s`
            : message
              ? "Send another sign-in link"
              : "Send my sign-in link"}
        <ArrowRight size={16} />
      </Button>
      <p style={{ fontSize: 14, marginBottom: 0 }}>
        Use the same email as checkout to see your orders, including guest
        purchases. Check your spam folder if the link does not arrive.
      </p>
    </form>
  );
}
