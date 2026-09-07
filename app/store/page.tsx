"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/utils/sound";

type PlanTone = "free" | "popular" | "recommended";

const PLANS: { name: string; price: string; period: string; desc: string; features: string[]; cta: string; tone: PlanTone }[] = [
  { name: "Free", price: "$0", period: "forever", desc: "Start anonymous", features: ["3 daily matches", "Quick tier scenes (2k tokens)", "Browse all characters", "Anonymous confessions"], cta: "Get Started", tone: "free" },
  { name: "Standard", price: "$9.99", period: "month", desc: "More scenes, more connections", features: ["Unlimited daily matches", "Quick + Deep Dive tiers (10k tokens)", "Standard AI scenes", "Basic interest tags", "3 AI images per match", "Priority matchmaking"], cta: "Become Standard", tone: "popular" },
  { name: "Premium", price: "$19.99", period: "month", desc: "Everything, unlocked", features: ["Everything in Standard", "Richer AI scenes", "Advanced interest filtering", "Custom scene requests", "Priority reveal queue", "Exclusive badges"], cta: "Go Premium", tone: "recommended" },
];

const PACKS = [
  { amount: 500, price: "$1.99", label: "Starter", coins: 3 },
  { amount: 2000, price: "$4.99", label: "Popular", coins: 4 },
  { amount: 5000, price: "$9.99", label: "Best Value", coins: 5 },
  { amount: 12000, price: "$19.99", label: "Whale", coins: 6 },
];

const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your profile anytime. No questions asked." },
  { q: "What are tokens?", a: "Tokens power AI responses in your scenes. Each match has a shared pool that depletes as the AI contributes." },
  { q: "Is payment secure?", a: "We use crypto payments via NOWPayments. No card required." },
];

function CoinIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`inline-block align-[-2px] ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id="coinFace" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="oklch(0.9 0.1 80)" />
          <stop offset="0.55" stopColor="oklch(0.82 0.14 75)" />
          <stop offset="1" stopColor="oklch(0.74 0.13 70)" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="8.5" fill="url(#coinFace)" stroke="oklch(0.72 0.16 10 / 0.55)" strokeWidth="1.2" />
      <path d="M10 13.6c-2.6-1.7-3.9-3-3.9-4.5 0-1.1 0.9-2 2-2 0.8 0 1.5 0.45 1.9 1.15 0.4-0.7 1.1-1.15 1.9-1.15 1.1 0 2 0.9 2 2 0 1.5-1.3 2.8-3.9 4.5z" fill="oklch(0.62 0.19 12 / 0.85)" />
    </svg>
  );
}

function CoinStack({ coins }: { coins: number }) {
  const w = 88;
  const coinW = 56;
  const coinH = 14;
  const baseY = 62;
  return (
    <svg viewBox={`0 0 ${w} 72`} className="w-[88px] h-[72px] mx-auto" aria-hidden="true">
      <defs>
        <linearGradient id="coinTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.9 0.1 80)" />
          <stop offset="0.6" stopColor="oklch(0.82 0.14 75)" />
          <stop offset="1" stopColor="oklch(0.72 0.13 70)" />
        </linearGradient>
        <radialGradient id="stackGlow" cx="0.5" cy="0.6" r="0.65">
          <stop offset="0" stopColor="oklch(0.82 0.14 75 / 0.22)" />
          <stop offset="1" stopColor="oklch(0.82 0.14 75 / 0)" />
        </radialGradient>
      </defs>
      <ellipse cx={w / 2} cy={baseY} rx={coinW / 2 + 12} ry="12" fill="url(#stackGlow)" />
      {Array.from({ length: coins }).map((_, i) => {
        const y = baseY - 2 - i * (coinH - 3);
        const drift = (i % 2 === 0 ? -1 : 1) * Math.min(i, 2);
        return (
          <g key={i}>
            <ellipse
              cx={w / 2 + drift}
              cy={y}
              rx={coinW / 2}
              ry={coinH / 2}
              fill="url(#coinTop)"
              stroke="oklch(0.72 0.16 10 / 0.5)"
              strokeWidth="1"
            />
            <ellipse cx={w / 2 + drift} cy={y - 2} rx={coinW / 2 - 3} ry={coinH / 2 - 3} fill="oklch(0.95 0.06 75 / 0.25)" />
            {i === coins - 1 && (
              <path
                d={`M${w / 2 + drift} ${y + 3.2}c-5-3.2-7.4-5.7-7.4-8.5 0-2.1 1.7-3.8 3.8-3.8 1.5 0 2.8 0.85 3.6 2.2 0.8-1.35 2.1-2.2 3.6-2.2 2.1 0 3.8 1.7 3.8 3.8 0 2.8-2.4 5.3-7.4 8.5z`}
                fill="oklch(0.62 0.19 12 / 0.85)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function StorePage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("tokens_balance")
            .eq("id", user.id)
            .single();
          if (data?.tokens_balance != null) setBalance(data.tokens_balance);
        }
      } catch {
      }
    }
    fetchBalance();
  }, []);

  const planCard = (tone: PlanTone) => {
    if (tone === "recommended") return "border-accent-candle/50 bg-surface md:scale-[1.04] shadow-[0_0_36px_rgba(255,190,120,0.14)]";
    if (tone === "popular") return "border-accent-rose/25 bg-surface";
    return "border-line bg-surface";
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-candle mb-2">The general store</p>
        <h1 className="font-retro text-3xl sm:text-4xl mb-2">
          Fuel your <span className="gradient-text">scenes.</span>
        </h1>
        <p className="text-sm text-muted mb-8">Subscriptions and tokens for the nights ahead.</p>

        <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 mb-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-faint mb-1">Your Balance</p>
          <p className="font-retro text-3xl text-foreground">
            <CoinIcon className="w-6 h-6" /> {balance != null ? balance.toLocaleString() : "0"}
          </p>
        </div>

        <div className="mb-10">
          <h2 className="font-retro text-xl mb-1">Subscriptions</h2>
          <p className="text-sm text-muted mb-5">Choose your access level.</p>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative rounded-[var(--radius-card)] p-6 border transition-all hover:border-line-strong ${planCard(plan.tone)}`}>
                {plan.tone === "recommended" && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent-candle text-accent-foreground font-mono text-[10px] font-bold uppercase tracking-wider">Recommended</span>
                )}
                {plan.tone === "popular" && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent-rose text-accent-foreground font-mono text-[10px] font-bold uppercase tracking-wider">Popular</span>
                )}
                <h3 className={`font-retro text-base mb-1 ${plan.tone === "recommended" ? "text-accent-candle" : "text-foreground"}`}>{plan.name}</h3>
                <p className="text-xs text-muted mb-3">{plan.desc}</p>
                <p className="font-mono text-3xl mb-1">
                  <span className={plan.tone === "recommended" ? "text-accent-candle" : "text-foreground"}>{plan.price}</span>
                  <span className="text-sm text-muted">/{plan.period}</span>
                </p>
                <div className="space-y-2 my-5">
                  {plan.features.map((f) => (
                    <p key={f} className="flex items-start gap-2 text-xs text-muted-strong">
                      <span className="text-success flex-shrink-0">&#x2713;</span> {f}
                    </p>
                  ))}
                </div>
                <Link
                  href="/login"
                  onClick={() => playSound("click")}
                  className={`block w-full text-center px-4 py-2.5 rounded-full font-medium text-sm transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95 ${
                    plan.tone === "recommended"
                      ? "text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light"
                      : "bg-surface-sunken border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="font-retro text-xl mb-1">Token packs</h2>
          <p className="text-sm text-muted mb-5">Buy tokens individually, no subscription needed.</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKS.map((pack) => (
              <div key={pack.amount} className="bg-surface border border-line rounded-[var(--radius-card)] p-5 text-center transition-all hover:-translate-y-0.5 hover:border-accent-candle/30">
                <CoinStack coins={pack.coins} />
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-faint mb-2 mt-1">{pack.label}</p>
                <p className="font-retro text-2xl mb-1">
                  <CoinIcon className="w-4 h-4" /> {pack.amount.toLocaleString()}
                </p>
                <p className="font-mono text-sm text-muted mb-3">/ {pack.price} USD</p>
                <Link
                  href="/login"
                  onClick={() => playSound("click")}
                  className="block w-full text-center text-sm px-4 py-2.5 rounded-full bg-surface-sunken border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95"
                >
                  Buy
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-xl mx-auto mb-8">
          <h2 className="font-retro text-xl text-center mb-6">Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-surface border border-line rounded-[var(--radius-control)] overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left focus-visible:ring-2 ring-line-focus focus-visible:outline-none"
                  aria-expanded={faqOpen === i}
                >
                  <span className="text-sm text-foreground">{faq.q}</span>
                  <span className={`text-sm flex-shrink-0 ${faqOpen === i ? "text-accent-candle" : "text-muted"}`}>{faqOpen === i ? "\u2212" : "+"}</span>
                </button>
                {faqOpen === i && <div className="px-4 pb-3 text-sm text-muted leading-relaxed">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-faint text-center mb-2">
          Tokens power AI responses in your scenes. Each match has a shared pool.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-faint text-center">
          16+ to join &middot; 18+ for NSFW
        </p>
      </div>
    </main>
  );
}
