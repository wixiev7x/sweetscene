"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIERS, FINISH_THE_SCENE, formatUsd, type BillingPeriod, type TierId } from "@/lib/billing/plans";
import { useAuthModal } from "@/components/auth/AuthModal";

/* Prices stay hidden until Paddle checkout shows the visitor's local price.
 * Flip NEXT_PUBLIC_SHOW_PRICES=1 for the Paddle domain review. */
const SHOW_PRICES = process.env.NEXT_PUBLIC_SHOW_PRICES === "1";

const MOOD: Record<TierId, { line: string; glow: string; icon: string }> = {
  spark: { line: "A first taste", glow: "rgba(255,255,255,.08)", icon: "M13 2L3 14h7l-1 8 10-12h-7z" },
  ember: { line: "When one scene isn't enough", glow: "rgba(255,92,135,.35)", icon: "M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-5.4-3.4-8.7-.2.9-.9 2.6-2.3 3.2.3-3.1-1.4-6.2-4.2-7.7.4 3-1.7 5.3-2.8 7C5.4 10.3 5 11.7 5 13.3 5 18.4 8 22 12 22z" },
  flame: { line: "Lose track of time", glow: "rgba(225,36,92,.6)", icon: "M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-5.4-3.4-8.7-.2.9-.9 2.6-2.3 3.2.3-3.1-1.4-6.2-4.2-7.7.4 3-1.7 5.3-2.8 7C5.4 10.3 5 11.7 5 13.3 5 18.4 8 22 12 22z" },
  inferno: { line: "Nothing held back", glow: "rgba(217,179,122,.45)", icon: "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z" },
};

const COMPARE: { label: string; values: Record<TierId, string | boolean> }[] = [
  { label: "Matches, every mode", values: { spark: "Unlimited", ember: "Unlimited", flame: "Unlimited", inferno: "Unlimited" } },
  { label: "Tokens", values: { spark: "Daily refill", ember: "60k / mo", flame: "200k / mo", inferno: "500k / mo" } },
  { label: "Deep Dive scenes", values: { spark: false, ember: false, flame: true, inferno: true } },
  { label: "Scene images", values: { spark: false, ember: false, flame: true, inferno: true } },
  { label: "Priority matching", values: { spark: false, ember: false, flame: true, inferno: "Top" } },
  { label: "Early access", values: { spark: false, ember: false, flame: false, inferno: true } },
];

function Tick({ on }: { on: boolean | string }) {
  if (typeof on === "string") return <span className="text-foreground-dim">{on}</span>;
  return on ? (
    <svg className="mx-auto h-4 w-4 text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="Included"><path d="M5 12l5 5L20 7" /></svg>
  ) : (
    <span className="text-muted-faint" aria-label="Not included">·</span>
  );
}

export default function StorePage() {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const [pick, setPick] = useState<TierId>("flame");
  const tier = TIERS.find((t) => t.id === pick)!;

  function proceed() {
    if (pick === "spark") return openAuth("signup", "/");
    router.push(`/billing?plan=${pick}&period=${period}`);
  }

  return (
    <div className="relative min-h-screen bg-background px-4 pb-24 pt-8 text-foreground sm:px-6 md:pt-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-2xl rounded-full bg-[radial-gradient(closest-side,rgba(225,36,92,.28),transparent)] blur-2xl" />

      <div className="relative mx-auto max-w-[560px]">
        <div className="text-center">
          <h1 className="font-display text-[clamp(2rem,5vw,2.8rem)] leading-[1.08]">
            Stay longer. Go <span className="gradient-text">deeper</span>.
          </h1>
          <p className="mt-2 text-[15px] text-muted-strong">Pick how much of the night you want.</p>
        </div>

        {/* Period */}
        <div className="mx-auto mt-6 grid w-full max-w-xs grid-cols-2 rounded-full bg-white/[.06] p-1" role="radiogroup" aria-label="Billing period">
          {(["yearly", "monthly"] as const).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`h-10 rounded-full text-[15px] transition-colors ${period === p ? "bg-white text-black" : "text-muted-strong hover:text-foreground"}`}
            >
              {p === "yearly" ? "Yearly · best value" : "Monthly"}
            </button>
          ))}
        </div>

        {/* Plans list */}
        <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Plan">
          {TIERS.map((t) => {
            const on = pick === t.id;
            const m = MOOD[t.id];
            const price = period === "monthly" ? t.monthlyUsd : t.yearlyUsd;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPick(t.id)}
                className={`relative w-full overflow-hidden rounded-[1.5rem] p-4 text-left transition-all duration-300 ${on ? "ring-2 ring-brand" : "ring-1 ring-white/[.08] hover:ring-white/20"}`}
                style={{ background: `radial-gradient(120% 140% at 0% 0%, ${m.glow}, transparent 60%), #0d0d0f` }}
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[.07]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={t.id === "spark" ? "none" : "currentColor"} stroke={t.id === "spark" ? "currentColor" : "none"} strokeWidth="2" className={t.id === "inferno" ? "text-accent-candle" : t.id === "spark" ? "text-foreground-dim" : "text-brand-light"} aria-hidden="true">
                      <path d={m.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[19px] text-foreground">{t.name}</span>
                      {t.highlight && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">Most loved</span>}
                    </span>
                    <span className="block text-[13px] text-muted">{m.line}</span>
                  </span>
                  {SHOW_PRICES && <span className="text-right text-[15px] text-foreground">{formatUsd(price)}</span>}
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${on ? "border-brand bg-brand" : "border-white/25"}`} aria-hidden="true">
                    {on && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </div>
                <div className={`grid transition-[grid-template-rows] duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <ul className="overflow-hidden">
                    <div className="space-y-1.5 pl-[58px] pt-3">
                      {t.perks.map((p) => (
                        <li key={p} className="flex gap-2 text-[14px] text-foreground-dim">
                          <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                          {p}
                        </li>
                      ))}
                    </div>
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue */}
        <button
          type="button"
          onClick={proceed}
          className="mt-5 h-14 w-full rounded-full bg-brand text-[17px] text-white shadow-[0_16px_44px_-14px_var(--brand)] transition-transform active:scale-[0.98]"
        >
          {pick === "spark" ? "Start free" : `Continue with ${tier.name}`}
        </button>
        <p className="mt-3 text-center text-[13px] text-muted">
          Your price appears in your currency at checkout. Cancel anytime. Discreet billing by Paddle.
        </p>

        {/* Finish the scene */}
        <Link
          href={`/billing?plan=${FINISH_THE_SCENE.id}`}
          className="mt-8 flex items-center gap-4 rounded-[1.5rem] bg-[#0d0d0f] p-4 ring-1 ring-white/[.08] transition-colors hover:ring-white/20"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-light">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </span>
          <span className="flex-1">
            <span className="block text-[16px] text-foreground">{FINISH_THE_SCENE.name}</span>
            <span className="block text-[13px] text-muted">One-time top-up, no subscription</span>
          </span>
          <span className="text-muted" aria-hidden="true">›</span>
        </Link>

        {/* Compare */}
        <section className="mt-10">
          <h2 className="mb-3 text-lg">Compare</h2>
          <div className="overflow-hidden rounded-[1.5rem] ring-1 ring-white/[.08]">
            <table className="w-full text-center text-[13px]">
              <thead>
                <tr className="bg-white/[.04] text-muted-strong">
                  <th className="px-3 py-3 text-left font-normal" />
                  {TIERS.map((t) => (
                    <th key={t.id} className={`px-2 py-3 font-normal ${pick === t.id ? "text-brand-light" : ""}`}>{t.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.06]">
                {COMPARE.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-3 text-left text-foreground-dim">{row.label}</td>
                    {TIERS.map((t) => (
                      <td key={t.id} className={`px-2 py-3 ${pick === t.id ? "bg-brand/[.06]" : ""}`}><Tick on={row.values[t.id]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10 divide-y divide-white/[.07]">
          {[
            ["How much does it cost?", "You'll see the exact price for your country at checkout, in your currency, before you pay anything."],
            ["Can I cancel anytime?", "Yes, in two taps. You keep your plan until the end of the period you paid for."],
            ["Is it discreet?", "Payments are handled by Paddle. Your statement shows a neutral name."],
          ].map(([q, a]) => (
            <details key={q} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px]">
                {q}
                <span aria-hidden="true" className="text-xl text-brand-light transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-strong">{a}</p>
            </details>
          ))}
        </section>
        <p className="mt-6 text-center text-[13px] text-muted">
          <Link href="/refunds" className="underline">Refund Policy</Link> · <Link href="/terms" className="underline">Terms</Link>
        </p>
      </div>
    </div>
  );
}
