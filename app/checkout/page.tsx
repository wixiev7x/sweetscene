"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/utils/sound";
import { createVipPlanOrder, createTokenPackageOrder } from "@/lib/actions/billing";
import {
  createPayRamVipPlanOrder,
  createPayRamTokenPackageOrder,
} from "@/lib/actions/payram";
import { TOKEN_PACKAGES, VIP_PLANS } from "@/lib/billing/constants";

/* ════════════════════════════════════════════════════════════════════
 * Checkout — the dedicated purchase interface. Pick a product (a
 * membership — one-time pass or renewal-based subscription — or a
 * token pack), pick a payment method (Card / Apple Pay / Google Pay
 * via PayRam's card-to-crypto onramp, or Crypto via NOWPayments), see
 * the order summary, pay. The actual charge always runs through the
 * server actions — prices are never client-side.
 * ════════════════════════════════════════════════════════════════════ */

type ProductId = "vip" | "vip_monthly" | "vip_yearly" | "starter" | "standard" | "whale";
type PayMethod = "card" | "crypto";

type Product = {
  id: ProductId;
  name: string;
  eyebrow: string;
  price: number;
  detail: string;
  features: string[];
  best?: boolean;
  subscription?: boolean;
};

const VIP_FEATURES = [
  "Unlimited daily matches",
  "Deep Dive scenes (10k pool)",
  "NSFW creation (18+)",
  "AI image generation",
];

const PRODUCTS: Product[] = [
  ...VIP_PLANS.map((p) => ({
    id: p.id as ProductId,
    name: p.name,
    eyebrow: p.subscription ? "Membership · subscription" : "Membership",
    price: p.priceUsd,
    detail: p.detail,
    features: VIP_FEATURES,
    best: "best" in p ? p.best : undefined,
    subscription: p.subscription,
  })),
  ...TOKEN_PACKAGES.map((p) => ({
    id: p.id as ProductId,
    name: `${p.tokens.toLocaleString()} tokens`,
    eyebrow: "Token pack",
    price: p.priceUsd,
    detail: "one-time top-up",
    features: [
      "Powers AI responses in scenes",
      "Never expires",
      "Stacks with VIP",
    ],
    best: p.id === "standard",
  })),
];

const VIP_PLAN_IDS = new Set<string>(VIP_PLANS.map((p) => p.id));

const PAY_METHODS: {
  id: PayMethod;
  label: string;
  desc: string;
  icons: string;
}[] = [
  {
    id: "card",
    label: "Card / Apple Pay / Google Pay",
    desc: "Visa, Mastercard, Amex, Apple Pay, Google Pay and 175+ methods, via PayRam. First-time card payments require a quick one-time verification.",
    icons: "💳",
  },
  {
    id: "crypto",
    label: "Crypto",
    desc: "Pay in BTC, ETH, USDC and 150+ coins via NOWPayments.",
    icons: "₿",
  },
];

function CoinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`inline-block align-[-2px] ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id="ckCoin" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="oklch(0.9 0.1 80)" />
          <stop offset="0.55" stopColor="oklch(0.82 0.14 75)" />
          <stop offset="1" stopColor="oklch(0.74 0.13 70)" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="8.5" fill="url(#ckCoin)" stroke="oklch(0.72 0.16 10 / 0.55)" strokeWidth="1.2" />
      <path d="M10 13.6c-2.6-1.7-3.9-3-3.9-4.5 0-1.1 0.9-2 2-2 0.8 0 1.5 0.45 1.9 1.15 0.4-0.7 1.1-1.15 1.9-1.15 1.1 0 2 0.9 2 2 0 1.5-1.3 2.8-3.9 4.5z" fill="oklch(0.62 0.19 12 / 0.85)" />
    </svg>
  );
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("item");

  const [selected, setSelected] = useState<ProductId>(
    (PRODUCTS.some((p) => p.id === preselect) ? preselect : "vip") as ProductId
  );
  const [method, setMethod] = useState<PayMethod>("card");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const product = PRODUCTS.find((p) => p.id === selected)!;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setIsLoggedIn(!!user);
        if (user) {
          const { data: own } = await supabase.rpc("get_own_profile");
          const rows = (Array.isArray(own) ? own : [own]) as Array<{ tokens_balance?: number | null } | null>;
          const bal = rows?.[0]?.tokens_balance;
          if (!cancelled && bal != null) setBalance(bal);
        }
      } catch {
        if (!cancelled) setIsLoggedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePay() {
    if (processing || isLoggedIn === false) return;
    setProcessing(true);
    setError("");
    playSound("click");
    try {
      const result =
        method === "card"
          ? VIP_PLAN_IDS.has(selected)
            ? await createPayRamVipPlanOrder(selected)
            : await createPayRamTokenPackageOrder(selected)
          : VIP_PLAN_IDS.has(selected)
            ? await createVipPlanOrder(selected)
            : await createTokenPackageOrder(selected);
      if ("error" in result) {
        setError(result.error);
        setProcessing(false);
        return;
      }
      window.location.assign(result.invoiceUrl);
    } catch {
      setError("Couldn't start checkout — try again.");
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8 candle-wash">
      <div className="max-w-5xl mx-auto">
        <p className="type-eyebrow text-accent-candle mb-2">Checkout</p>
        <h1 className="type-display text-3xl mb-2">
          Fuel your <span className="gradient-text">scenes.</span>
        </h1>
        <p className="type-body text-muted mb-8">
          Pick what you want, pick how you pay. Your purchase lands the moment payment confirms.
        </p>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* ── Left: product + method selection ── */}
          <div className="space-y-8">
            <section aria-label="Choose your product">
              <h2 className="type-eyebrow text-muted mb-3">1 · Choose your product</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {PRODUCTS.map((p) => {
                  const active = selected === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p.id);
                        playSound("click");
                      }}
                      aria-pressed={active}
                      className={`relative text-left p-5 rounded-[var(--radius-card)] border transition-all ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                        active
                          ? "border-accent-candle/60 bg-accent-candle/[0.06]"
                          : "border-line bg-surface hover:border-line-strong"
                      }`}
                    >
                      {p.best && (
                        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-accent-candle text-accent-foreground type-eyebrow font-bold">
                          Best value
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="type-eyebrow text-muted-faint">{p.eyebrow}</p>
                          <p className="type-title font-display text-foreground mt-0.5">{p.name}</p>
                        </div>
                        <span
                          className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            active ? "border-accent-candle" : "border-line-strong"
                          }`}
                          aria-hidden="true"
                        >
                          {active && <span className="w-2 h-2 rounded-full bg-accent-candle" />}
                        </span>
                      </div>
                      <p className="type-2xl font-display text-foreground mb-1">
                        ${p.price.toFixed(2)}
                        <span className="type-meta text-muted"> · {p.detail}</span>
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {p.features.map((f) => (
                          <p key={f} className="type-meta text-muted-strong flex items-start gap-1.5">
                            <span className="text-success flex-shrink-0" aria-hidden="true">✓</span>
                            {f}
                          </p>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-label="Choose your payment method">
              <h2 className="type-eyebrow text-muted mb-3">2 · Choose how you pay</h2>
              <div className="space-y-3" role="radiogroup" aria-label="Payment method">
                {PAY_METHODS.map((m) => {
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMethod(m.id);
                        playSound("click");
                      }}
                      role="radio"
                      aria-checked={active}
                      className={`w-full text-left p-4 rounded-[var(--radius-card)] border transition-all ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                        active
                          ? "border-accent-candle/60 bg-accent-candle/[0.06]"
                          : "border-line bg-surface hover:border-line-strong"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-surface-raised flex items-center justify-center text-base" aria-hidden="true">
                            {m.icons}
                          </span>
                          <span className="type-body font-semibold text-foreground">{m.label}</span>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            active ? "border-accent-candle" : "border-line-strong"
                          }`}
                          aria-hidden="true"
                        >
                          {active && <span className="w-2 h-2 rounded-full bg-accent-candle" />}
                        </span>
                      </div>
                      <p className="type-meta text-muted mt-2 ml-12">{m.desc}</p>
                    </button>
                  );
                })}
              </div>
              <p className="type-meta text-muted-faint mt-3 leading-relaxed">
                Checkout opens on the payment provider&rsquo;s secured page. SweetScene never
                sees your card details — we only receive the confirmed payment.
              </p>
            </section>
          </div>

          {/* ── Right: order summary ── */}
          <aside className="lg:sticky lg:top-20 bg-surface border border-line rounded-[var(--radius-card)] p-6">
            <h2 className="type-eyebrow text-muted mb-4">Order summary</h2>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-line">
              <div>
                <p className="type-body font-semibold text-foreground">{product.name}</p>
                <p className="type-meta text-muted">{product.detail}</p>
              </div>
              <p className="type-body font-display text-foreground">${product.price.toFixed(2)}</p>
            </div>
            {balance != null && (
              <div className="flex items-center justify-between py-3 border-b border-line">
                <p className="type-meta text-muted">Current balance</p>
                <p className="type-meta text-foreground font-medium flex items-center gap-1">
                  <CoinIcon /> {balance.toLocaleString()}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between py-4">
              <p className="type-body font-semibold text-foreground">Total</p>
              <p className="text-2xl font-display text-foreground">${product.price.toFixed(2)}</p>
            </div>
            <p className="type-meta text-muted-faint mb-5">
              Paying with {method === "card" ? "card via PayRam" : "crypto"}
            </p>

            {isLoggedIn === false ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/checkout?item=${selected}`)}`}
                data-cursor="primary"
                className="block w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none flex items-center justify-center"
              >
                Sign in to pay
              </Link>
            ) : (
              <button
                onClick={handlePay}
                disabled={processing || isLoggedIn === null}
                data-cursor="primary"
                aria-live="polite"
                className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing && (
                  <span className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" aria-hidden="true" />
                )}
                {processing ? "Opening secure checkout…" : `Pay $${product.price.toFixed(2)}`}
              </button>
            )}

            {error && (
              <p className="type-body text-danger mt-4 text-center" role="alert">{error}</p>
            )}

            <p className="type-meta text-muted-faint text-center mt-5 leading-relaxed">
              {product.subscription
                ? "Renews when you pay before it ends — we'll remind you a few days ahead. Nothing is ever auto-charged."
                : selected === "vip"
                  ? `One-time ${VIP_PLANS.find((p) => p.id === "vip")!.days}-day pass — no auto-renewal, nothing to cancel.`
                  : "Tokens never expire and stack with any pass."}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
