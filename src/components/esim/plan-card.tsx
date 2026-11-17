"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Wifi, Radio } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { PublicPlan } from "@/lib/catalog";
import { Price } from "@/components/ui/price";
import { Button } from "@/components/ui/button";
export function PlanCard({
  plan,
  popular = false,
}: {
  plan: PublicPlan;
  popular?: boolean;
}) {
  const add = useCart((s) => s.add);
  const items = useCart((s) => s.items);
  const router = useRouter();
  const [message, setMessage] = useState("");
  function buy() {
    if (items.length >= 5 && !items.some((p) => p.id === plan.id)) {
      setMessage(
        "Your cart holds up to 5 plans. Review your cart to make room.",
      );
      return;
    }
    add(plan);
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "plan_selected", planId: plan.id }),
    });
    router.push("/checkout");
  }
  return (
    <article className={`plan-card ${popular ? "plan-popular" : ""}`}>
      {popular && <span className="popular-tag">The sweet spot</span>}
      <div className="plan-country">
        {plan.flagEmoji} {plan.destinationName}
      </div>
      <h3>
        {plan.dataLabel}
        <span>of exploring power</span>
      </h3>
      <div className="plan-specs">
        <span>
          <CalendarDays size={16} />
          {plan.validityDays} days validity
        </span>
        <span>
          <Radio size={16} />
          {plan.speed ||
            (plan.supports5G === true
              ? "5G supported"
              : "Speed varies by network")}
        </span>
        <span>
          <Wifi size={16} />
          {plan.supportsHotspot === null
            ? "Hotspot: check plan details"
            : plan.supportsHotspot
              ? "Hotspot supported"
              : "No hotspot"}
        </span>
        <span>
          <Check size={16} />
          Data only · no calls / SMS
        </span>
      </div>
      <div className="plan-price">
        <strong>
          <Price cents={plan.retailPrice} />
        </strong>
        <span>one-time payment</span>
      </div>
      <Button onClick={buy} secondary={!popular}>
        Choose this plan
        <ArrowRight size={17} />
      </Button>
      {message && (
        <p role="alert" className="error-text">
          {message}
        </p>
      )}
    </article>
  );
}
