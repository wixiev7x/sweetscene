"use client";

import Link from "next/link";
import { playSound } from "@/lib/utils/sound";
import { VIP_PRICE_USD, VIP_DURATION_DAYS } from "@/lib/billing/constants";

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
        <p className="type-eyebrow text-accent-candle mb-2">The VIP pass</p>
        <h1 className="type-display text-3xl sm:text-4xl mb-3">
          Nights that run <span className="gradient-text">long.</span>
        </h1>
        <p className="type-body text-muted mb-8 max-w-xl">
          One pass, everything unlocked. ${VIP_PRICE_USD.toFixed(2)} for {VIP_DURATION_DAYS} days —
          it expires on its own, so there&rsquo;s never a renewal to cancel.
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

        <div className="bg-surface border border-accent-candle/40 bg-accent-candle/[0.04] rounded-[var(--radius-card)] p-8 text-center mb-10">
          <p className="font-display text-4xl mb-1">
            <span className="text-accent-candle">${VIP_PRICE_USD.toFixed(2)}</span>
            <span className="type-body text-muted"> / {VIP_DURATION_DAYS} days</span>
          </p>
          <p className="type-meta text-muted mb-6">Pay in crypto via NOWPayments. No card, no renewal.</p>
          <Link
            href="/store"
            onClick={() => playSound("click")}
            data-cursor="primary"
            className="inline-flex h-12 items-center rounded-full bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light px-8 text-sm font-semibold text-accent-foreground ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
          >
            Get the VIP pass →
          </Link>
          <p className="type-meta text-muted-faint mt-4">
            Checkout lives in the Store — token packs are there too.
          </p>
        </div>

        <p className="type-meta text-muted-faint text-center">
          Free tier stays free: 3 matches a day, Quick-tier scenes, every character.
        </p>
      </div>
    </div>
  );
}
