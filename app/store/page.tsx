"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/utils/sound";
import { createVIPOrder, createTokenPackageOrder } from "@/lib/actions/billing";
import { TOKEN_PACKAGES, VIP_PRICE_USD, VIP_DURATION_DAYS } from "@/lib/billing/constants";

type PlanTone = "free" | "recommended";

/* Plans mirror what the product actually enforces: free accounts get
 * 3 matches/day and Quick-tier scenes; VIP unlocks the deep tier,
 * uncapped matching, NSFW creation (18+) and AI image generation. */
const PLANS: { name: string; price: string; period: string; desc: string; features: string[]; cta: string; tone: PlanTone }[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Start anonymous",
    features: [
      "3 matches a day",
      "Quick-tier scenes (2k shared pool)",
      "Browse every character",
      "Anonymous confessions",
    ],
    cta: "Get Started",
    tone: "free",
  },
  {
    name: "VIP",
    price: `$${VIP_PRICE_USD.toFixed(2)}`,
    period: `${VIP_DURATION_DAYS} days`,
    desc: "Everything, unlocked",
    features: [
      "Unlimited daily matches",
      "Deep Dive scenes (10k shared pool)",
      "NSFW character creation (18+)",
      "AI image generation",
    ],
    cta: "Get VIP",
    tone: "recommended",
  },
];

const PACK_LABELS: Record<string, string> = {
  starter: "Starter",
  standard: "Standard",
  whale: "Best value",
};

const FAQS = [
  {
    q: "Is VIP a subscription?",
    a: `No — VIP is a ${VIP_DURATION_DAYS}-day pass. It expires on its own; there is no auto-renewal and nothing to cancel.`,
  },
  {
    q: "What are tokens?",
    a: "Tokens power AI responses in your scenes. Each match draws from a shared pool as the AI contributes.",
  },
  {
    q: "How do I pay?",
    a: "Checkout runs through NOWPayments — pay in crypto, no card required. Your balance updates when the payment confirms.",
  },
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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [vipExpires, setVipExpires] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState("");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsLoggedIn(!!user);
        if (user) {
          /* tokens_balance / is_vip are column-REVOKED — read via RPC. */
          const { data: own } = await supabase.rpc("get_own_profile").maybeSingle();
          const p = own as { tokens_balance?: number; is_vip?: boolean; vip_expires_at?: string | null } | null;
          if (p?.tokens_balance != null) setBalance(p.tokens_balance);
          if (p?.is_vip) {
            setIsVip(true);
            setVipExpires(p.vip_expires_at ?? null);
          }
        }
      } catch {
      }
    }
    fetchProfile();
  }, []);

  async function handleBuyVip() {
    playSound("click");
    setPurchasing("vip");
    setPurchaseError("");
    try {
      const result = await createVIPOrder();
      if ("error" in result) {
        setPurchaseError(result.error);
      } else {
        window.location.assign(result.invoiceUrl);
      }
    } catch {
      setPurchaseError("Couldn't start checkout — try again");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleBuyPack(packageId: string) {
    playSound("click");
    setPurchasing(packageId);
    setPurchaseError("");
    try {
      const result = await createTokenPackageOrder(packageId);
      if ("error" in result) {
        setPurchaseError(result.error);
      } else {
        window.location.assign(result.invoiceUrl);
      }
    } catch {
      setPurchaseError("Couldn't start checkout — try again");
    } finally {
      setPurchasing(null);
    }
  }

  const planCard = (tone: PlanTone) => {
    if (tone === "recommended") return "border-accent-candle/50 bg-accent-candle/[0.04] md:scale-[1.03]";
    return "border-line bg-surface";
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <p className="type-eyebrow text-accent-candle mb-2">The general store</p>
        <h1 className="type-display text-3xl sm:text-4xl mb-2">
          Fuel your <span className="gradient-text">scenes.</span>
        </h1>
        <p className="type-body text-muted mb-8">A membership pass and tokens for the nights ahead.</p>

        <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 mb-10 text-center">
          <p className="type-eyebrow text-muted-faint mb-1">Your balance</p>
          <p className="font-display text-3xl text-foreground">
            <CoinIcon className="w-6 h-6" /> {balance != null ? balance.toLocaleString() : "0"}
          </p>
          {isVip && vipExpires && (
            <p className="type-meta text-accent-candle mt-2">
              VIP active until {new Date(vipExpires).toLocaleDateString()}
            </p>
          )}
        </div>

        {purchaseError && (
          <p className="type-body text-danger mb-6 text-center" role="alert">{purchaseError}</p>
        )}

        <div className="mb-10">
          <h2 className="type-title font-display mb-1">Membership</h2>
          <p className="type-body text-muted mb-5">Free to play — VIP when the night runs long.</p>

          <div className="grid md:grid-cols-2 gap-5 items-start max-w-2xl">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative rounded-[var(--radius-card)] p-6 border transition-all hover:border-line-strong ${planCard(plan.tone)}`}>
                {plan.tone === "recommended" && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent-candle text-accent-foreground type-eyebrow font-bold">Recommended</span>
                )}
                <h3 className={`font-display text-lg mb-1 ${plan.tone === "recommended" ? "text-accent-candle" : "text-foreground"}`}>{plan.name}</h3>
                <p className="type-meta text-muted mb-3">{plan.desc}</p>
                <p className="text-3xl mb-1 font-display">
                  <span className={plan.tone === "recommended" ? "text-accent-candle" : "text-foreground"}>{plan.price}</span>
                  <span className="type-meta text-muted"> / {plan.period}</span>
                </p>
                <div className="space-y-2 my-5">
                  {plan.features.map((f) => (
                    <p key={f} className="flex items-start gap-2 type-meta text-muted-strong">
                      <span className="text-success flex-shrink-0" aria-hidden="true">&#x2713;</span> {f}
                    </p>
                  ))}
                </div>
                {plan.tone === "recommended" ? (
                  isLoggedIn === false ? (
                    <Link
                      href="/login?next=/store"
                      onClick={() => playSound("click")}
                      data-cursor="primary"
                      className="block w-full text-center h-11 leading-[44px] px-4 rounded-full font-semibold text-sm text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95"
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={handleBuyVip}
                      disabled={purchasing === "vip"}
                      data-cursor="primary"
                      aria-live="polite"
                      className="block w-full h-11 px-4 rounded-full font-semibold text-sm text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {purchasing === "vip" && (
                        <span className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" aria-hidden="true" />
                      )}
                      {purchasing === "vip" ? "Opening checkout…" : isVip ? "Extend by 30 days" : plan.cta}
                    </button>
                  )
                ) : (
                  <Link
                    href={isLoggedIn === false ? "/signup?next=/store" : "/matchmake"}
                    onClick={() => playSound("click")}
                    className="block w-full text-center h-11 leading-[44px] px-4 rounded-full font-medium text-sm bg-surface-sunken border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95"
                  >
                    {isLoggedIn === false ? plan.cta : "Play free"}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="type-title font-display mb-1">Token packs</h2>
          <p className="type-body text-muted mb-5">One-time top-ups — no membership needed.</p>

          <div className="grid sm:grid-cols-3 gap-4">
            {TOKEN_PACKAGES.map((pack) => (
              <div key={pack.id} className="bg-surface border border-line rounded-[var(--radius-card)] p-5 text-center transition-all hover:-translate-y-0.5 hover:border-accent-candle/30">
                <CoinStack coins={3 + TOKEN_PACKAGES.indexOf(pack)} />
                <p className="type-eyebrow text-muted-faint mb-2 mt-1">{PACK_LABELS[pack.id] ?? pack.id}</p>
                <p className="font-display text-2xl mb-1">
                  <CoinIcon className="w-4 h-4" /> {pack.tokens.toLocaleString()}
                </p>
                <p className="type-meta text-muted mb-3">/ ${pack.priceUsd.toFixed(2)} USD</p>
                {isLoggedIn === false ? (
                  <Link
                    href="/login?next=/store"
                    onClick={() => playSound("click")}
                    className="block w-full text-center h-10 leading-10 text-sm px-4 rounded-full bg-surface-sunken border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95"
                  >
                    Buy
                  </Link>
                ) : (
                  <button
                    onClick={() => handleBuyPack(pack.id)}
                    disabled={purchasing === pack.id}
                    aria-live="polite"
                    className="block w-full h-10 px-4 rounded-full text-sm bg-surface-sunken border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle transition-all focus-visible:ring-2 ring-line-focus focus-visible:outline-none active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {purchasing === pack.id && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-foreground/30 border-t-foreground animate-spin" aria-hidden="true" />
                    )}
                    {purchasing === pack.id ? "Opening…" : "Buy"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-xl mx-auto mb-8">
          <h2 className="type-title font-display text-center mb-6">Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-surface border border-line rounded-[var(--radius-control)] overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left focus-visible:ring-2 ring-line-focus focus-visible:outline-none"
                  aria-expanded={faqOpen === i}
                  aria-controls={`faq-${i}`}
                >
                  <span className="type-body text-foreground">{faq.q}</span>
                  <span className={`type-body flex-shrink-0 ${faqOpen === i ? "text-accent-candle" : "text-muted"}`} aria-hidden="true">{faqOpen === i ? "\u2212" : "+"}</span>
                </button>
                {faqOpen === i && (
                  <div id={`faq-${i}`} className="px-4 pb-3 type-body text-muted leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="type-meta text-muted-faint text-center mb-2">
          Tokens power AI responses in your scenes. Each match draws from a shared pool.
        </p>
        <p className="type-eyebrow text-muted-faint text-center">
          16+ platform to join
        </p>
      </div>
    </div>
  );
}
