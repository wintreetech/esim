"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatMoney, type Currency } from "@/lib/currency";
import { Button, ButtonLink } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { PaymentMethods } from "@/components/ui/payment-methods";
import { validatePaymentRedirect } from "@/lib/payments/redirect";
import { useDeviceCheck } from "@/lib/device-check-store";
import { deviceCheckStatus } from "@/lib/compatibility";
type Quote = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: Currency;
  items: { id: string; unitPrice: number }[];
};
export function CheckoutForm({
  configured,
  topUpEsimId,
  initialPlanId,
  paymentCurrencies,
}: {
  configured: boolean;
  topUpEsimId?: string;
  initialPlanId?: string;
  paymentCurrencies?: string[];
}) {
  const { items, currency, remove } = useCart();
  const { check: deviceCheck, hydrated: deviceHydrated } = useDeviceCheck();
  const deviceReady =
    deviceHydrated && deviceCheckStatus(deviceCheck) === "ready";
  const currencyAvailable =
    !paymentCurrencies || paymentCurrencies.includes(currency);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [quoteFailure, setQuoteFailure] = useState({ signature: "", message: "" }),
    [pending, setPending] = useState(false),
    [quoteRefresh, setQuoteRefresh] = useState(0),
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
  }, [signature, ready, configured, quoteRefresh]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!deviceReady) {
      setError(
        "Please confirm eSIM support and carrier unlock status before paying.",
      );
      return;
    }
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planIds,
          currency,
          expectedTotal: quote?.total,
          coupon: coupon || undefined,
          topUpEsimId,
          email: form.get("email"),
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          acceptedTerms: form.get("terms") === "on",
          deviceCheck,
          idempotencyKey: key.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          key.current = crypto.randomUUID();
          setQuoteResult(null);
          setQuoteRefresh((n) => n + 1);
        }
        throw new Error(result.error);
      }
      const target = validatePaymentRedirect(result);
      if (result.method === "POST") {
        const paymentForm = document.createElement("form");
        paymentForm.method = "POST";
        paymentForm.action = target.href;
        paymentForm.hidden = true;
        for (const [name, value] of Object.entries(
          result.fields as Record<string, string>,
        )) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          paymentForm.appendChild(input);
        }
        document.body.appendChild(paymentForm);
        HTMLFormElement.prototype.submit.call(paymentForm);
      } else window.location.assign(target.href);
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
        <p style={{ fontSize: 14, marginBottom: 24 }}>
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
            <span>
              First name <span className="muted">(optional)</span>
            </span>
            <input name="firstName" autoComplete="given-name" maxLength={80} />
          </label>
          <label className="field">
            <span>
              Last name <span className="muted">(optional)</span>
            </span>
            <input name="lastName" autoComplete="family-name" maxLength={80} />
          </label>
        </div>
        <label className="field">
          <span>
            Coupon code <span className="muted">(optional)</span>
          </span>
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
            I agree to the <Link href="/legal/terms">terms</Link> and{" "}
            <Link href="/legal/refunds">refund policy</Link>.
          </span>
        </label>
        <div className={`checkout-device-check ${deviceReady ? "ready" : ""}`}>
          <h3>
            {deviceReady
              ? "Device checks confirmed"
              : "Check your phone before you pay"}
          </h3>
          <p>
            {deviceReady
              ? `${deviceCheck!.model} · You confirmed eSIM support and carrier unlock status.`
              : deviceCheckStatus(deviceCheck) === "blocked"
                ? "Your saved answers show a compatibility issue. Resolve it before purchasing."
                : "Confirm the phone you will install the eSIM on. Your bag stays saved while you check."}
          </p>
          <Link className="text-link" href="/compatibility?returnTo=checkout">
            {deviceReady ? "Review or change device" : "Check my device"}{" "}
            <ArrowRight size={15} />
          </Link>
          {deviceReady && (
            <p className="device-check-disclosure">
              Based on your answers, saved for 30 days. Check every phone if
              buying plans for other people.
            </p>
          )}
        </div>
        {!configured && (
          <p className="preview-notice">
            Checkout is temporarily unavailable. Please check back shortly or
            contact support.
          </p>
        )}
        {configured && !currencyAvailable && (
          <p className="preview-notice" role="alert">
            Payment in {currency} is currently unavailable. Choose{" "}
            {paymentCurrencies?.join(" or ")} using the currency selector above.
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button
          className="full-width"
          disabled={
            !configured ||
            !currencyAvailable ||
            !deviceReady ||
            pending ||
            !quote ||
            !!quoteError
          }
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
          Secure, encrypted checkout
        </p>
        <PaymentMethods />
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
                {quote?.items.find((i) => i.id === item.id) ? (
                  formatMoney(
                    quote.items.find((i) => i.id === item.id)!.unitPrice,
                    currency,
                  )
                ) : (
                  <Price cents={item.retailPrice} />
                )}
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
          <p style={{ fontSize: 14, marginTop: 20 }}>
            {configured
              ? "Confirming live prices…"
              : "Final prices will be confirmed by the server when checkout opens."}
          </p>
        )}
        <div className="info-panel" style={{ padding: 18, marginTop: 24 }}>
          <p style={{ fontSize: 14 }}>
            A little reminder: these are data-only plans. Install over Wi-Fi,
            keep your usual number, and follow the activation instructions sent
            with your eSIM.
          </p>
        </div>
        <Link
          className="text-link"
          style={{ marginTop: 20, fontSize: 14 }}
          href="/destinations"
        >
          Keep exploring
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
