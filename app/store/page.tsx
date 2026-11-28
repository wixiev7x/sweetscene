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

      </div>

      {/* Plans: four tall, narrow cards side by side */}
      <div className="relative mx-auto mt-8 grid max-w-[1040px] grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Plan">
        {TIERS.map((t) => {
          const on = pick === t.id;
          const m = MOOD[t.id];
          const price = period === "monthly" ? t.monthlyUsd : t.yearlyUsd;
          return (
            <div
              key={t.id}
              role="radio"
              aria-checked={on}
              tabIndex={0}
              onClick={() => setPick(t.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPick(t.id)}
              className={`relative flex min-h-[440px] cursor-pointer flex-col overflow-hidden rounded-[1.75rem] p-5 transition-all duration-300 ${
                on ? "-translate-y-1 ring-2 ring-brand" : "ring-1 ring-white/[.08] hover:ring-white/20"
              }`}
              style={{ background: `radial-gradient(130% 70% at 50% 0%, ${m.glow}, transparent 70%), #0d0d0f` }}
            >
              {t.highlight && (
                <span className="absolute right-4 top-4 rounded-full bg-brand px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">Most loved</span>
              )}
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[.07]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill={t.id === "spark" ? "none" : "currentColor"} stroke={t.id === "spark" ? "currentColor" : "none"} strokeWidth="2" className={t.id === "inferno" ? "text-accent-candle" : t.id === "spark" ? "text-foreground-dim" : "text-brand-light"} aria-hidden="true">
                  <path d={m.icon} />
                </svg>
              </span>
              <h2 className="mt-4 font-display text-[26px] leading-none text-foreground">{t.name}</h2>
              <p className="mt-1.5 text-[13px] text-muted">{m.line}</p>
              {SHOW_PRICES && <p className="mt-3 text-2xl text-foreground">{formatUsd(price)}</p>}
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2 text-[13.5px] leading-snug text-foreground-dim">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                    {p}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPick(t.id);
                  if (t.id === "spark") openAuth("signup", "/");
                  else router.push(`/billing?plan=${t.id}&period=${period}`);
                }}
                className={`mt-5 h-12 w-full rounded-full text-[15px] transition-transform active:scale-[0.97] ${
                  on ? "bg-brand text-white shadow-[0_12px_36px_-12px_var(--brand)]" : "bg-white/[.08] text-foreground hover:bg-white/[.14]"
                }`}
              >
                {t.id === "spark" ? "Start free" : `Get ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="relative mt-4 text-center text-[13px] text-muted">
        Your price appears in your currency at checkout. Cancel anytime. Discreet billing by Paddle.
      </p>

      <div className="relative mx-auto max-w-[560px]">
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
          <div className="overflow-x-auto rounded-[1.5rem] ring-1 ring-white/[.08]">
            <table className="w-full text-center text-[12px] sm:text-[13px]">
              <thead>
                <tr className="bg-white/[.04] text-muted-strong">
                  <th className="px-2.5 py-3 text-left font-normal sm:px-3" />
                  {TIERS.map((t) => (
                    <th key={t.id} className={`px-1.5 py-3 font-normal sm:px-2 ${pick === t.id ? "text-brand-light" : ""}`}>{t.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.06]">
                {COMPARE.map((row) => (
                  <tr key={row.label}>
                    <td className="px-2.5 py-3 text-left text-foreground-dim sm:px-3">{row.label}</td>
                    {TIERS.map((t) => (
                      <td key={t.id} className={`px-1.5 py-3 sm:px-2 ${pick === t.id ? "bg-brand/[.06]" : ""}`}><Tick on={row.values[t.id]} /></td>
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
