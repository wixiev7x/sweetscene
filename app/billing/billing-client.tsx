"use client";

import { useState, useTransition } from "react";
import { playSound } from "@/lib/utils/sound";
import { TOKEN_PACKAGES, VIP_PLANS } from "@/lib/billing/constants";
import {
  createStripeVipOrder,
  createStripeTokenPackageOrder,
  openStripeCustomerPortal,
} from "@/lib/actions/stripe-billing";
import {
  createVipPlanOrder,
  createTokenPackageOrder,
} from "@/lib/actions/billing";

/* Card checkout via Stripe Payment Links, plus an optional crypto rail
 * via NOWPayments (rendered only when the server confirms it is
 * configured end-to-end). The client only sends product ids — prices
 * render from lib/billing/constants and the server re-derives them
 * before writing the order; the redirect URL carries our order
 * reference (?client_reference_id=… / NOWPayments order_id) which the
 * webhooks match back to the payments row before granting. */

type Availability = {
  vipMonthly: boolean;
  vipYearly: boolean;
  tokensS: boolean;
  tokensM: boolean;
  tokensL: boolean;
  portal: boolean;
  webhook: boolean;
};

const TOKEN_AVAILABILITY: Record<string, keyof Availability> = {
  starter: "tokensS",
  standard: "tokensM",
  whale: "tokensL",
};

const PLAN_AVAILABILITY: Record<string, keyof Availability> = {
  vip_monthly: "vipMonthly",
  vip_yearly: "vipYearly",
};

export default function BillingClient({
  availability,
  crypto,
}: {
  availability: Availability;
  /** NOWPayments configured end-to-end (server-verified). */
  crypto: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    action: () => Promise<
      { url: string } | { invoiceUrl: string } | { error: string }
    >,
    id: string
  ) {
    playSound("click");
    setError(null);
    setPending(id);
    startTransition(async () => {
      const result = await action();
      if ("url" in result) {
        window.location.assign(result.url);
      } else if ("invoiceUrl" in result) {
        window.location.assign(result.invoiceUrl);
      } else {
        setError(result.error);
        setPending(null);
      }
    });
  }

  const busy = pending !== null || isPending;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <p className="type-eyebrow text-accent-candle mb-2">Billing</p>
        <h1 className="type-display text-3xl sm:text-4xl mb-3">
          Pay by <span className="gradient-text">card.</span>
        </h1>
        <p className="type-body text-muted mb-10">
          Card, Apple Pay or Google Pay via Stripe — checkout opens on
          Stripe&apos;s page, and your purchase lands the moment it
          completes.
        </p>

        {error && (
          <p
            role="alert"
            className="type-meta text-red-400 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 mb-6"
          >
            {error}
          </p>
        )}

        {/* ── VIP memberships ── */}
        <p className="type-eyebrow text-muted-faint mb-3">VIP membership</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-10 max-w-xl">
          {VIP_PLANS.filter((p) => p.subscription).map((plan) => {
            const available = availability[PLAN_AVAILABILITY[plan.id]];
            const id = plan.id;
            return (
              <div
                key={plan.id}
                className={`relative bg-surface border rounded-[var(--radius-card)] p-6 text-center ${
                  "best" in plan && plan.best
                    ? "border-accent-candle/40 bg-accent-candle/[0.04]"
                    : "border-line"
                }`}
              >
                {"best" in plan && plan.best && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-accent-candle text-accent-foreground type-eyebrow font-bold">
                    Best value
                  </span>
                )}
                <p className="type-eyebrow text-muted-faint mb-1">{plan.name}</p>
                <p className="font-display text-3xl text-foreground mb-1">
                  <span className="text-accent-candle">${plan.priceUsd.toFixed(2)}</span>
                  <span className="type-meta text-muted"> / {plan.days === 365 ? "year" : "month"}</span>
                </p>
                <p className="type-meta text-muted mb-5">
                  {plan.days} days · {plan.detail}
                </p>
                {available ? (
                  <button
                    type="button"
                    disabled={busy}
                    data-cursor="primary"
                    onClick={() => run(() => createStripeVipOrder(id), id)}
                    className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light px-8 text-sm font-semibold text-accent-foreground ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === id ? "Opening checkout…" : "Subscribe →"}
                  </button>
                ) : (
                  <p className="type-meta text-muted-faint">Coming soon</p>
                )}
                <p className="type-meta text-muted-faint mt-4 leading-relaxed">
                  Renews automatically on your card. Cancel anytime below — paid time stays.
                </p>
              </div>
            );
          })}
        </div>

        {/* ── Token packs ── */}
        <p className="type-eyebrow text-muted-faint mb-3">Token packs</p>
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {TOKEN_PACKAGES.map((pkg) => {
            const available = availability[TOKEN_AVAILABILITY[pkg.id]];
            const id = pkg.id;
            return (
              <div
                key={pkg.id}
                className="bg-surface border border-line rounded-[var(--radius-card)] p-5 text-center"
              >
                <p className="type-eyebrow text-muted-faint mb-1 capitalize">{pkg.id}</p>
                <p className="font-display text-2xl text-foreground mb-1">
                  <span className="text-accent-candle">
                    {pkg.tokens.toLocaleString("en-US")}
                  </span>
                </p>
                <p className="type-meta text-muted mb-4">tokens · ${pkg.priceUsd.toFixed(2)}</p>
                {available ? (
                  <button
                    type="button"
                    disabled={busy}
                    data-cursor="primary"
                    onClick={() => run(() => createStripeTokenPackageOrder(id), id)}
                    className="inline-flex h-10 items-center rounded-full border border-line hover:border-accent-candle/50 px-6 text-sm font-semibold text-foreground ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === id ? "Opening…" : "Buy pack"}
                  </button>
                ) : (
                  <p className="type-meta text-muted-faint">Coming soon</p>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Crypto rail (NOWPayments) ── */}
        {crypto && (
          <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 mb-10 max-w-xl">
            <p className="type-eyebrow text-muted-faint mb-1">Prefer crypto?</p>
            <p className="type-meta text-muted mb-5 leading-relaxed">
              Same plans and packs, paid in 200+ coins via NOWPayments.
              Each purchase is one invoice — nothing auto-charges, tokens
              and VIP land the moment payment confirms.
            </p>
            <div className="flex flex-wrap gap-3">
              {VIP_PLANS.filter((p) => p.subscription).map((plan) => {
                const id = `np-${plan.id}`;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    data-cursor="primary"
                    onClick={() => run(() => createVipPlanOrder(plan.id), id)}
                    className="inline-flex h-10 items-center rounded-full border border-line hover:border-accent-candle/50 px-5 text-sm font-semibold text-foreground ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === id ? "Opening…" : `${plan.name} · $${plan.priceUsd.toFixed(2)}`}
                  </button>
                );
              })}
              {TOKEN_PACKAGES.map((pkg) => {
                const id = `np-${pkg.id}`;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    data-cursor="primary"
                    onClick={() => run(() => createTokenPackageOrder(pkg.id), id)}
                    className="inline-flex h-10 items-center rounded-full border border-line hover:border-accent-candle/50 px-5 text-sm font-semibold text-foreground ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === id
                      ? "Opening…"
                      : `${pkg.tokens.toLocaleString("en-US")} tokens · $${pkg.priceUsd.toFixed(2)}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Manage subscription ── */}
        {availability.portal && (
          <div className="bg-surface border border-line rounded-[var(--radius-card)] p-5 mb-8 max-w-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="type-body font-semibold text-foreground mb-1">
                  Manage subscription
                </h2>
                <p className="type-meta text-muted leading-relaxed">
                  Update your card, download invoices, or cancel — opens
                  Stripe&apos;s secure portal.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                data-cursor="primary"
                onClick={() => run(() => openStripeCustomerPortal(), "portal")}
                className="inline-flex h-11 items-center rounded-full border border-line hover:border-accent-candle/50 px-6 text-sm font-semibold text-foreground ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending === "portal" ? "Opening…" : "Manage →"}
              </button>
            </div>
          </div>
        )}

        <p className="type-meta text-muted-faint text-center leading-relaxed">
          Card checkout is hosted by Stripe; crypto checkout by
          NOWPayments — payment details never touch SweetScene. Tokens
          are credited automatically the moment payment completes.
        </p>
      </div>
    </div>
  );
}
