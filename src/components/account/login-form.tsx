"use client";
import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
export function LoginForm({ configured }: { configured: boolean }) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
          Sign-in is being set up. Add your Supabase environment variables to
          enable accounts.
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
      <Button className="full-width" disabled={!configured || busy}>
        {busy ? "Sending your link…" : "Send my sign-in link"}
        <ArrowRight size={16} />
      </Button>
      <p style={{ fontSize: 11, marginBottom: 0 }}>
        Checking a guest order? Your eSIM email contains a private access link.
      </p>
    </form>
  );
}
