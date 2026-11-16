"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/currency";
import { Button, ButtonLink } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
type Quote = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: "USD" | "INR";
};
export function CheckoutForm({
  configured,
  rate,
  topUpEsimId,
  initialPlanId,
}: {
  configured: boolean;
  rate: number;
  topUpEsimId?: string;
  initialPlanId?: string;
}) {
  const { items, currency, remove } = useCart();
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [quoteFailure, setQuoteFailure] = useState({ signature: "", message: "" }),
    [pending, setPending] = useState(false),
    [quoteResult, setQuoteResult] = useState<{
      signature: string;
      value: Quote;
    } | null>(null),
    [coupon, setCoupon] = useState("");
  const key = useRef("");
  const planIds =
    topUpEsimId && initialPlanId ? [initialPlanId] : items.map((i) => i.id);
  const signature = JSON.stringify({ planIds, currency, coupon, topUpEsimId });
  const quote = quoteResult?.signature === signature ? quoteResult.value : null;
  const quoteError =
    quoteFailure.signature === signature ? quoteFailure.message : "";
  useEffect(() => {
    void Promise.resolve(useCart.persist.rehydrate()).then(() =>
      setReady(true),
    );
  }, []);
  useEffect(() => {
    key.current = crypto.randomUUID();
    if (!ready || !configured || !planIds.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: signature,
        signal: controller.signal,
      })
        .then(async (r) => {
          const result = await r.json();
          if (!r.ok) throw new Error(result.error);
          setQuoteFailure({ signature: "", message: "" });
          setQuoteResult({ signature, value: result });
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted)
            setQuoteFailure({
              signature,
              message: e instanceof Error ? e.message : "Could not load total.",
            });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [signature, ready, configured]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planIds,
          currency,
          coupon: coupon || undefined,
          topUpEsimId,
          email: form.get("email"),
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          acceptedTerms: form.get("terms") === "on",
          idempotencyKey: key.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) key.current = crypto.randomUUID();
        throw new Error(result.error);
      }
      const target = new URL(result.url);
      if (
        target.protocol !== "https:" ||
        target.hostname !== "checkout.stripe.com"
      )
        throw new Error("Invalid payment destination.");
      window.location.assign(result.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Checkout failed. Please try again.",
      );
      setPending(false);
    }
  }
  if (!ready)
    return (
      <div className="loading-shell">
        <div className="spinner" />
      </div>
    );
  if (!planIds.length)
    return (
      <div className="empty-state" style={{ marginBottom: 70 }}>
        <ShoppingBag size={32} />
        <h2>Your next adventure starts here.</h2>
        <p>Your bag is empty. Find a data plan for wherever you’re heading.</p>
        <ButtonLink href="/destinations">
          Explore destinations
          <ArrowRight size={16} />
        </ButtonLink>
      </div>
    );
  return (
    <div className="checkout-layout">
      <form className="panel" onSubmit={submit}>
        <h2>A good connection starts here.</h2>
        <p style={{ fontSize: 12, marginBottom: 24 }}>
          Your installation details go straight to this email.
        </p>
        <label className="field">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
          <small>No account needed. Keep your confirmation email safe.</small>
        </label>
        <div className="field-row">
          <label className="field">
            First name <span className="muted">(optional)</span>
            <input name="firstName" autoComplete="given-name" maxLength={80} />
          </label>
          <label className="field">
            Last name <span className="muted">(optional)</span>
            <input name="lastName" autoComplete="family-name" maxLength={80} />
          </label>
        </div>
        <label className="field">
          Got a little perk? <span className="muted">(coupon code)</span>
          <input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            maxLength={40}
            placeholder="Enter code"
          />
        </label>
        <label className="check-label">
          <input type="checkbox" name="terms" required />
          <span>
            I’ve <Link href="/compatibility">checked my device</Link> is eSIM
            compatible and unlocked. I agree to the{" "}
            <Link href="/legal/terms">terms</Link> and{" "}
            <Link href="/legal/refunds">refund policy</Link>.
          </span>
        </label>
        {!configured && (
          <p className="preview-notice">
            Checkout is temporarily unavailable. Please check back shortly or
            contact support.
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button
          className="full-width"
          disabled={!configured || pending || !quote || !!quoteError}
        >
          {pending ? (
            "Getting your checkout ready…"
          ) : (
            <>
              Continue to secure payment
              <ArrowRight size={17} />
            </>
          )}
        </Button>
        <p className="secure-note">
          <LockKeyhole size={12} />
          Encrypted checkout · Card details stay with Stripe
        </p>
      </form>
      <div className="panel">
        <h2>Your little travel essential</h2>
        {topUpEsimId ? (
          <div className="cart-item">
            <div>
              <h3>eSIM data top-up</h3>
              <p>Add data to your existing eSIM.</p>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div className="cart-item" key={item.id}>
              <div>
                <h3>
                  {item.flagEmoji} {item.destinationName}
                </h3>
                <p>
                  {item.dataLabel} · {item.validityDays} days
                </p>
              </div>
              <div className="cart-item-price">
                <Price cents={item.retailPrice} rate={rate} />
                <button
                  type="button"
                  className="remove-item"
                  aria-label={`Remove ${item.destinationName} ${item.dataLabel}`}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
        {quoteError && (
          <p className="error-text" role="alert">
            {quoteError}
          </p>
        )}
        {quote ? (
          <>
            <div className="summary-line">
              <span>Plans</span>
              <span>{formatMoney(quote.subtotal, currency)}</span>
            </div>
            {quote.discount > 0 && (
              <div className="summary-line">
                <span>Coupon savings</span>
                <span>−{formatMoney(quote.discount, currency)}</span>
              </div>
            )}
            <div className="summary-line">
              <span>Tax</span>
              <span>{formatMoney(quote.tax, currency)}</span>
            </div>
            <div className="summary-line summary-total">
              <span>Total</span>
              <span>{formatMoney(quote.total, currency)}</span>
            </div>
            <p className="secure-note">One-time payment. No subscription.</p>
          </>
        ) : (
          <p style={{ fontSize: 11, marginTop: 20 }}>
            {configured
              ? "Confirming live prices…"
              : "Final prices will be confirmed by the server when checkout opens."}
          </p>
        )}
        <div className="info-panel" style={{ padding: 18, marginTop: 24 }}>
          <p style={{ fontSize: 11 }}>
            A little reminder: these are data-only plans. Install over Wi-Fi,
            keep your usual number, and follow the activation instructions sent
            with your eSIM.
          </p>
        </div>
        <Link
          className="text-link"
          style={{ marginTop: 20, fontSize: 11 }}
          href="/destinations"
        >
          Keep exploring
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
