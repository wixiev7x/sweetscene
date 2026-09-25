"use client";

import Link from "next/link";
import { playSound } from "@/lib/utils/sound";
import { VIP_PLANS } from "@/lib/billing/constants";

/* Everything listed here is enforced in the product: the deep tier
 * and daily-match cap checks live in the matchmaking actions, NSFW
 * creation and AI image generation are VIP-gated server-side. */
const BENEFITS = [
  {
    title: "Unlimited matches",
    desc: "Free accounts get 3 a day. VIP takes the cap off entirely.",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  },
  {
    title: "Deep Dive scenes",
    desc: "The 10k shared token pool — scenes that run all night.",
    icon: "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z",
  },
  {
    title: "NSFW creation",
    desc: "Create adult characters and scenes (18+, verified accounts only).",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  {
    title: "AI image generation",
    desc: "Generate scene art and character portraits right in the app.",
    icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  },
];

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <p className="type-eyebrow text-accent-candle mb-2">The VIP membership</p>
        <h1 className="type-display text-3xl sm:text-4xl mb-3">
          Nights that run <span className="gradient-text">long.</span>
        </h1>
        <p className="type-body text-muted mb-8 max-w-xl">
          Everything unlocked. Subscribe monthly or yearly — it renews with one payment
          when the period ends (we nudge you a few days ahead, nothing is ever
          auto-charged) — or grab a one-time 30-day pass.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {BENEFITS.map((b) => (
            <div key={b.title} className="bg-surface border border-line rounded-[var(--radius-card)] p-5">
              <div className="w-9 h-9 rounded-full bg-accent-candle/10 flex items-center justify-center text-accent-candle mb-3" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={b.icon} />
                </svg>
              </div>
              <h2 className="type-body font-semibold text-foreground mb-1">{b.title}</h2>
              <p className="type-meta text-muted leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4 max-w-xl mx-auto">
          {VIP_PLANS.filter((p) => p.subscription).map((plan) => (
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
                {plan.days === 365 ? "365 days — 2 months free · " : "30 days · "}
                {plan.detail}
              </p>
              <Link
                href={`/checkout?item=${plan.id}`}
                onClick={() => playSound("click")}
                data-cursor="primary"
                className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light px-8 text-sm font-semibold text-accent-foreground ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Subscribe →
              </Link>
              <p className="type-meta text-muted-faint mt-4 leading-relaxed">
                Renews with one payment when it ends — never auto-charged.
              </p>
            </div>
          ))}
        </div>

        <p className="type-meta text-muted-faint text-center mb-10">
          Prefer one-time?{" "}
          <Link
            href="/checkout?item=vip"
            className="text-accent-candle underline underline-offset-2"
            onClick={() => playSound("click")}
          >
            $9.99 for a 30-day pass
          </Link>{" "}
          — expires on its own, nothing to cancel. Card, Apple Pay, Google Pay or
          crypto at checkout.
        </p>

        <p className="type-meta text-muted-faint text-center">
          Free tier stays free: 3 matches a day, Quick-tier scenes, every character.
        </p>
      </div>
    </div>
  );
}
