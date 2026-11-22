"use client";

import Link from "next/link";
import { useState } from "react";
import { TIERS, FINISH_THE_SCENE, formatUsd, type BillingPeriod } from "@/lib/billing/plans";
import { useAuthModal } from "@/components/auth/AuthModal";

/* Prices stay hidden until Paddle checkout shows the visitor's local price.
 * Flip NEXT_PUBLIC_SHOW_PRICES=1 for the Paddle domain review. */
const SHOW_PRICES = process.env.NEXT_PUBLIC_SHOW_PRICES === "1";

const MOOD: Record<string, { glow: string; line: string }> = {
  spark: { glow: "radial-gradient(110% 80% at 50% 0%, rgba(255,255,255,.08), transparent 70%)", line: "A first taste." },
  ember: { glow: "radial-gradient(110% 80% at 50% 0%, rgba(255,92,135,.22), transparent 70%)", line: "When one scene isn't enough." },
  flame: { glow: "radial-gradient(120% 90% at 50% 0%, rgba(225,36,92,.55), rgba(80,10,30,.35) 55%, transparent 80%)", line: "Lose track of time." },
  inferno: { glow: "radial-gradient(110% 80% at 50% 0%, rgba(217,179,122,.3), transparent 70%)", line: "Nothing held back." },
};

const FAQS = [
  ["How much does it cost?", "You'll see the exact price for your country at checkout, in your currency, before you pay anything."],
  ["Can I cancel anytime?", "Yes, in two taps. You keep your plan until the end of the period you paid for."],
  ["Is it discreet?", "Payments are handled by Paddle. Your statement shows a neutral name, never anything explicit."],
  ["What are tokens?", "They power the AI in your scenes. Matches are always unlimited; tokens are the only meter."],
] as const;

function Check() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export default function StorePage() {
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const { openAuth } = useAuthModal();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-10 pt-12 text-center sm:px-6 md:pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-4xl rounded-full bg-[radial-gradient(closest-side,rgba(225,36,92,.35),transparent)] blur-2xl" />
        <p className="relative text-sm uppercase tracking-[0.25em] text-brand-light">Plans</p>
        <h1 className="relative mx-auto mt-4 max-w-3xl font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.05]">
          Stay longer.<br />Go <span className="gradient-text">deeper</span>.
        </h1>
        <p className="relative mx-auto mt-4 max-w-md text-[17px] text-muted-strong">More time with them, more scenes, fewer interruptions.</p>

        <div className="relative mt-8 inline-flex rounded-full bg-surface p-1.5" role="radiogroup" aria-label="Billing period">
          {(["yearly", "monthly"] as const).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`h-11 rounded-full px-7 text-base transition-colors ${period === p ? "bg-foreground text-background" : "text-muted-strong hover:text-foreground"}`}
            >
              {p === "yearly" ? "Yearly" : "Monthly"}
              {p === "yearly" && <span className={`ml-2 text-sm ${period === p ? "text-brand" : "text-brand-light"}`}>best value</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        {TIERS.map((t) => {
          const free = t.monthlyUsd === 0;
          const mood = MOOD[t.id];
          const price = period === "monthly" ? t.monthlyUsd : t.yearlyUsd;
          return (
            <div
              key={t.id}
              className={`relative flex min-h-[480px] flex-col overflow-hidden rounded-[2rem] bg-[#0c0c0e] p-7 ${t.highlight ? "ring-2 ring-brand/70" : "ring-1 ring-white/[.07]"}`}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: mood.glow }} />
              {t.highlight && (
                <span className="absolute right-6 top-6 rounded-full bg-brand px-3 py-1 text-xs text-white">Most loved</span>
              )}
              <div className="relative">
                <h2 className="font-display text-[32px] leading-none">{t.name}</h2>
                <p className="mt-2 text-[15px] text-muted-strong">{mood.line}</p>
                {SHOW_PRICES && (
                  <p className="mt-5 font-display text-4xl">
                    {formatUsd(price)}
                    <span className="text-base text-muted">{free ? "" : period === "monthly" ? " /mo" : " /yr"}</span>
                  </p>
                )}
              </div>
              <ul className="relative mt-7 flex-1 space-y-3.5">
                {t.perks.map((perk) => (
                  <li key={perk} className="flex gap-3 text-[15px] leading-snug text-foreground-dim">
                    <Check />
                    {perk}
                  </li>
                ))}
              </ul>
              {free ? (
                <button
                  type="button"
                  onClick={() => openAuth("signup", "/")}
                  className="relative mt-8 h-14 rounded-full bg-white/[.08] text-base text-foreground transition-colors hover:bg-white/[.14]"
                >
                  Start free
                </button>
              ) : (
                <Link
                  href={`/billing?plan=${t.id}&period=${period}`}
                  className={`relative mt-8 flex h-14 items-center justify-center rounded-full text-base transition-transform active:scale-[0.98] ${
                    t.highlight ? "bg-brand text-white shadow-[0_14px_40px_-14px_var(--brand)]" : "bg-foreground text-background"
                  }`}
                >
                  Get {t.name}
                </Link>
              )}
            </div>
          );
        })}
      </section>

      {/* One-time */}
      <section className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
        <div className="relative flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-[#0c0c0e] p-7 ring-1 ring-white/[.07] sm:flex-row sm:items-center sm:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_0%_50%,rgba(225,36,92,.25),transparent)]" />
          <div className="relative">
            <h2 className="font-display text-2xl">{FINISH_THE_SCENE.name}</h2>
            <p className="mt-1 text-[15px] text-muted-strong">Ran out right before the good part? One top-up, no subscription.</p>
          </div>
          <Link href={`/billing?plan=${FINISH_THE_SCENE.id}`} className="relative flex h-14 shrink-0 items-center justify-center rounded-full bg-white/[.08] px-8 text-base hover:bg-white/[.14]">
            Finish it
          </Link>
        </div>
      </section>

      {/* Trust + FAQ */}
      <section className="mx-auto mt-16 grid max-w-7xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="font-display text-3xl">Private, always.</h2>
          <ul className="mt-6 space-y-4 text-[15px] text-muted-strong">
            <li className="flex gap-3"><Check />Price shown in your currency at checkout</li>
            <li className="flex gap-3"><Check />Discreet billing name on your statement</li>
            <li className="flex gap-3"><Check />Cancel anytime, keep what you paid for</li>
            <li className="flex gap-3"><Check />Secure checkout by Paddle</li>
          </ul>
        </div>
        <div className="divide-y divide-white/[.07]">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px]">
                {q}
                <span aria-hidden="true" className="text-2xl text-brand-light transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-strong">{a}</p>
            </details>
          ))}
          <p className="pt-5 text-sm text-muted">
            See our <Link href="/refunds" className="underline">Refund Policy</Link> and <Link href="/terms" className="underline">Terms</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
