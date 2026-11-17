"use client";
import { useState, useRef } from "react";
import {
  Search,
  Smartphone,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useDeviceCheck } from "@/lib/device-check-store";
import { deviceCheckStatus, type DeviceCheck } from "@/lib/compatibility";
type Device = {
  brand: string;
  model: string;
  notes: string;
  supportsEsim: boolean;
};
export function DeviceChecker({
  devices,
  returnToCheckout = false,
}: {
  devices: Device[];
  returnToCheckout?: boolean;
}) {
  const [q, setQ] = useState(""),
    [brand, setBrand] = useState("All brands");
  const { check, selectModel, answer, reset, hydrated } = useDeviceCheck();
  const modelInput = useRef<HTMLInputElement>(null);
  const esim = check?.esim || "",
    unlocked = check?.unlocked || "";
  const ready = hydrated && deviceCheckStatus(check) === "ready";
  function chooseModel(model: string) {
    selectModel(model);
    modelInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    modelInput.current?.focus({ preventScroll: true });
  }
  const tokens = q.toLowerCase().match(/[a-z]+|\d+/g) || [];
  const results = devices.filter(
    (d) =>
      (brand === "All brands" || d.brand === brand) &&
      tokens.every((token) =>
        `${d.brand} ${d.model}`.toLowerCase().includes(token),
      ),
  );
  return (
    <>
      <section className="compat-search" aria-labelledby="model-search-title">
        <div className="section-heading compact-heading">
          <div>
            <span className="step-kicker">01 · Find your model</span>
            <h2 id="model-search-title">Start with your phone.</h2>
            <p>
              Search a model or select a brand. Results show model groups; your
              exact regional variant still needs checking. Select a group to
              start, then confirm the phone you will use below.
            </p>
          </div>
        </div>
        <div className="device-toolbar">
          <label className="input-search">
            <Search size={18} />
            <input
              placeholder="Search your phone model"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search devices"
            />
          </label>
          <div className="filter-tabs">
            {[
              "All brands",
              "Apple",
              "Samsung",
              "Google",
              "Motorola",
              "Xiaomi",
            ].map((b) => (
              <button
                key={b}
                className={brand === b ? "active" : ""}
                aria-pressed={brand === b}
                onClick={() => setBrand(b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <p className="device-result-count" role="status">
          {results.length} model {results.length === 1 ? "group" : "groups"}{" "}
          found{q ? ` for “${q}”` : ""}.
        </p>
        <div className="device-grid">
          {results.map((d) => (
            <article
              className={`device-card ${check?.model === `${d.brand} ${d.model}` ? "selected" : ""}`}
              key={`${d.brand}-${d.model}`}
            >
              <Smartphone size={28} />
              <div>
                <span>{d.brand}</span>
                <h3>{d.model}</h3>
                <p>{d.notes}</p>
                <p
                  style={{
                    marginTop: 8,
                    color: d.supportsEsim ? "#42805b" : "#ae5645",
                  }}
                >
                  {d.supportsEsim
                    ? "Selected variants support eSIM"
                    : "Does not support eSIM"}
                </p>
                <button
                  type="button"
                  className="button button-secondary device-select"
                  aria-pressed={check?.model === `${d.brand} ${d.model}`}
                  onClick={() => chooseModel(`${d.brand} ${d.model}`)}
                >
                  Check this model <span className="sr-only">{d.model}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
        {!results.length && (
          <div className="empty-state">
            <Search />
            <h3>Can’t find your phone?</h3>
            <p>
              This list is a starting point. Check your exact model with its
              manufacturer or carrier before purchasing.
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setQ("");
                setBrand("All brands");
              }}
            >
              Clear search and filters
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => chooseModel("")}
            >
              Enter my model manually
            </button>
          </div>
        )}
      </section>
      <section
        className="compat-confirm panel"
        aria-labelledby="phone-check-title"
      >
        <div className="compat-confirm-intro">
          <ShieldCheck size={28} aria-hidden="true" />
          <span className="step-kicker">02 · Confirm on your phone</span>
          <h2 id="phone-check-title">Let’s check the phone you’ll use.</h2>
          <p>
            This website cannot scan your phone or check its carrier lock
            automatically. We save your answers in this browser for checkout,
            for up to 30 days. No IMEI or EID number is collected.
          </p>
        </div>
        <label className="field compat-model-field">
          Phone you will install the eSIM on
          <input
            ref={modelInput}
            value={hydrated ? check?.model || "" : ""}
            disabled={!hydrated}
            maxLength={120}
            placeholder="For example, iPhone 13 Pro or Galaxy S24"
            onChange={(e) => selectModel(e.target.value)}
          />
          <small>
            Find the exact model in Settings → About. Changing it clears both
            answers so you check the right phone.
          </small>
        </label>
        <div className="compat-questions">
          {[
            {
              name: "esim",
              title: "Can you see Add eSIM in your phone settings?",
              value: esim,
              set: (value: DeviceCheck["esim"]) => answer("esim", value),
              hint: "Use the iPhone or Android instructions below. An EID is a useful indicator; confirm with the manufacturer if you are unsure.",
            },
            {
              name: "unlocked",
              title: "Have you confirmed your phone is carrier unlocked?",
              value: unlocked,
              set: (value: DeviceCheck["unlocked"]) =>
                answer("unlocked", value),
              hint: "An eSIM-capable phone can still be locked to one carrier. Ask your current carrier if you cannot confirm this.",
            },
          ].map((question) => (
            <fieldset
              key={question.name}
              className="compat-question"
              disabled={!hydrated || (check?.model.trim().length || 0) < 2}
            >
              <legend>{question.title}</legend>
              <p>{question.hint}</p>
              <div className="compat-choices">
                {[
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["unsure", "Not sure"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={
                      question.value === value
                        ? "compat-choice selected"
                        : "compat-choice"
                    }
                  >
                    <input
                      type="radio"
                      name={question.name}
                      value={value}
                      checked={question.value === value}
                      onChange={() =>
                        question.set(value as DeviceCheck["esim"])
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div
          className={`compat-result ${ready ? "ready" : ""}`}
          role="status"
          aria-live="polite"
        >
          {ready ? (
            <>
              <CheckCircle2 aria-hidden="true" />
              <div>
                <h3>Your checks look ready.</h3>
                <p>
                  {check?.model}: you confirmed eSIM support and an unlocked
                  phone. Your answers are saved for checkout. Check plan
                  coverage and keep Wi-Fi available for installation.
                </p>
                <Link
                  href={returnToCheckout ? "/checkout" : "/destinations"}
                  className="button"
                >
                  {returnToCheckout
                    ? "Return to checkout"
                    : "Explore eSIM plans"}
                </Link>
              </div>
            </>
          ) : (
            <>
              <HelpCircle aria-hidden="true" />
              <div>
                <h3>
                  {esim === "no"
                    ? "Confirm eSIM support before buying."
                    : unlocked === "no"
                      ? "Your carrier needs to unlock your phone first."
                      : !check?.model.trim()
                        ? "Start by entering your phone model."
                        : "Let’s confirm both checks."}
                </h3>
                <p>
                  {esim === "no"
                    ? "Some phones and regional variants cannot install an eSIM. Check the exact model with its manufacturer; do not buy until support is confirmed."
                    : unlocked === "no"
                      ? "An eSIM data plan cannot remove a carrier lock. Contact your existing carrier before purchasing."
                      : "Enter your phone model, then choose an answer for each check. If either answer is Not sure, use the instructions below or contact your carrier before you purchase. Older saved checks must be confirmed again."}
                </p>
                <a href="#phone-settings-guides" className="text-link">
                  Show me where to check <span aria-hidden="true">↓</span>
                </a>
                <Link href="/support" className="text-link">
                  Get help checking my phone →
                </Link>
              </div>
            </>
          )}
        </div>
        {check && (
          <button
            type="button"
            className="text-link compat-reset"
            onClick={reset}
          >
            Clear saved device and start again
          </button>
        )}
      </section>
    </>
  );
}
