"use client";

import Link from "next/link";
import { useState } from "react";
import { TIERS, FINISH_THE_SCENE, COMPARISON_NOTE, formatUsd, type BillingPeriod } from "@/lib/billing/plans";

const FAQS = [
  ["Are matches limited?", "No daily match limit on any plan. Tokens, which power the AI director and solo characters, are the only meter, and your balance is always visible."],
  ["What happens when I run out of tokens mid-scene?", "Your Spark tokens refill tomorrow, or you can finish the scene right away with a one-time Finish the scene pack. Paid plans simply give you much more room."],
  ["Can I cancel anytime?", "Yes. Cancel from Billing in two taps. You keep your plan until the end of the period you paid for."],
  ["How do refunds work?", "New subscriptions can be refunded within 14 days. See our Refund Policy for details."],
  ["Who handles payment?", "Paddle.com is our Merchant of Record. They process your card securely and handle receipts and taxes, we never see your card details."],
] as const;

export default function StorePage() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-8 text-foreground sm:px-6 md:pt-12">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-candle">Up to 75% cheaper than other AI roleplay apps</p>
          <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-extrabold leading-tight md:text-5xl">
            Longer scenes. <span className="gradient-text">Smaller bill.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-strong">No daily match limit on any plan. Upgrade only when you want more time in the scene.</p>

          <div className="mt-7 inline-flex rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={period === p}
                onClick={() => setPeriod(p)}
                className={`h-9 rounded-full px-5 text-sm font-semibold transition-colors ${period === p ? "bg-foreground text-background" : "text-muted-strong"}`}
              >
                {p === "monthly" ? "Monthly" : "Yearly"}
                {p === "yearly" && <span className="ml-1.5 text-[11px] font-bold text-brand-light">2 months free</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => {
            const free = t.monthlyUsd === 0;
            const price = period === "monthly" ? t.monthlyUsd : t.yearlyUsd;
            return (
              <div
                key={t.id}
                className={`relative flex flex-col rounded-3xl border p-6 ${
                  t.highlight ? "border-brand/70 bg-gradient-to-b from-brand/15 to-surface shadow-[0_20px_60px_-30px_var(--brand)]" : "border-line bg-surface"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most loved
                  </span>
                )}
                <h2 className="font-display text-2xl font-bold">{t.name}</h2>
                <p className="mt-1 text-[13px] text-muted">{t.tagline}</p>
                <p className="mt-6">
                  <span className="font-display text-4xl font-extrabold">{formatUsd(price)}</span>
                  <span className="text-sm text-muted">{free ? " forever" : period === "monthly" ? " /month" : " /year"}</span>
                </p>
                {!free && period === "yearly" && (
                  <p className="mt-1 text-xs text-accent-candle">{formatUsd(t.yearlyUsd / 12)}/month, billed yearly</p>
                )}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {t.perks.map((perk) => (
                    <li key={perk} className="flex gap-2.5 text-[13.5px] leading-snug text-foreground-dim">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  href={free ? "/signup" : `/billing?plan=${t.id}&period=${period}`}
                  className={`mt-7 flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-transform active:scale-[0.98] ${
                    t.highlight ? "bg-brand text-white" : free ? "border border-line-strong text-foreground" : "bg-foreground text-background"
                  }`}
                >
                  {free ? "Start free" : `Choose ${t.name}`}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold">{FINISH_THE_SCENE.name}</h2>
            <p className="mt-1 text-sm text-muted-strong">
              Ran out right before the good part? {FINISH_THE_SCENE.tokens.toLocaleString("en-US")} tokens, one-time, no subscription.
            </p>
          </div>
          <Link href={`/billing?plan=${FINISH_THE_SCENE.id}`} className="flex h-11 shrink-0 items-center rounded-full border border-line-strong px-6 text-sm font-semibold">
            {formatUsd(FINISH_THE_SCENE.priceUsd)} · Finish it
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-muted">{COMPARISON_NOTE} Prices in USD; local taxes may apply at checkout.</p>

        <section className="mx-auto mt-16 max-w-2xl">
          <h2 className="font-display text-2xl font-bold">Questions</h2>
          <div className="mt-4 divide-y divide-line">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
                  {q}
                  <span aria-hidden="true" className="text-brand-light transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-strong">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Secure checkout by Paddle. See our <Link href="/refunds" className="text-accent-candle underline">Refund Policy</Link> and{" "}
            <Link href="/terms" className="text-accent-candle underline">Terms</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
