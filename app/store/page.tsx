"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/utils/sound";

const PLANS = [
  { name: "Free", price: "$0", period: "forever", desc: "Start anonymous", features: ["3 daily matches", "Quick tier scenes (2k tokens)", "Browse all characters", "Anonymous confessions"], cta: "Get Started", highlight: false },
  { name: "Standard", price: "$9.99", period: "month", desc: "More scenes, more connections", features: ["Unlimited daily matches", "Quick + Deep Dive tiers (10k tokens)", "Standard AI scenes", "Basic interest tags", "3 AI images per match", "Priority matchmaking"], cta: "Become Standard", highlight: true },
  { name: "Premium", price: "$19.99", period: "month", desc: "Everything, unlocked", features: ["Everything in Standard", "Richer AI scenes", "Advanced interest filtering", "Custom scene requests", "Priority reveal queue", "Exclusive badges"], cta: "Go Premium", highlight: false },
];

const PACKS = [
  { amount: 500, price: "$1.99", label: "Starter" },
  { amount: 2000, price: "$4.99", label: "Popular" },
  { amount: 5000, price: "$9.99", label: "Best Value" },
  { amount: 12000, price: "$19.99", label: "Whale" },
];

const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your profile anytime. No questions asked." },
  { q: "What are tokens?", a: "Tokens power AI responses in your scenes. Each match has a shared pool that depletes as the AI contributes." },
  { q: "Is payment secure?", a: "We use crypto payments via NOWPayments. No card required." },
];

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
        // not logged in
      }
    }
    fetchBalance();
  }, []);

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Store</h1>
        <p className="text-sm text-muted mb-8">Subscriptions and tokens for AI matchmaking and chat.</p>

        {/* Balance display */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-10 text-center">
          <p className="text-xs text-muted-faint uppercase tracking-widest mb-1">Your Balance</p>
          <p className="text-3xl font-light text-neon-magenta">
            <span className="text-neon-magenta">&#x25C8;</span> {balance != null ? balance : 0}
          </p>
        </div>

        {/* Subscription tiers — first */}
        <div className="mb-10">
          <h2 className="text-lg font-light text-foreground-dim mb-1">Subscriptions</h2>
          <p className="text-sm text-muted mb-5">Choose your access level.</p>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div key={plan.name}
                className={`relative rounded-2xl p-6 border transition-all ${plan.highlight ? "border-brand/40 bg-brand/5 md:scale-105" : plan.name === "Premium" ? "border-gold-500/40 bg-gold-500/5" : "border-white/10 bg-white/5"}`}>
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-md bg-brand text-white text-[10px] font-bold uppercase tracking-wider">Popular</span>
                )}
                <h3 className={`text-base font-light mb-1 ${plan.name === "Premium" ? "text-gold-400" : "text-foreground"}`}>{plan.name}</h3>
                <p className="text-xs text-muted mb-3">{plan.desc}</p>
                <p className="text-3xl font-light text-white mb-1">{plan.price}<span className="text-sm text-muted">/{plan.period}</span></p>
                <div className="space-y-2 my-5">
                  {plan.features.map((f) => (
                    <p key={f} className="flex items-start gap-2 text-xs text-muted-strong">
                      <span className="text-neon-green flex-shrink-0">&#x2713;</span> {f}
                    </p>
                  ))}
                </div>
                <Link href="/login" onClick={() => playSound("click")}
                  className={`block w-full text-center px-4 py-2.5 rounded-md font-medium text-sm transition-all ${plan.highlight ? "text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500" : "text-foreground bg-white/5 border border-white/10 hover:bg-white/10"}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Token packs — second */}
        <div className="mb-10">
          <h2 className="text-lg font-light text-foreground-dim mb-1">Token Packs</h2>
          <p className="text-sm text-muted mb-5">Buy tokens individually, no subscription needed.</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKS.map((pack) => (
              <div key={pack.amount} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center hover:border-neon-magenta/40 transition-all">
                <p className="text-xs text-muted-faint uppercase tracking-widest mb-2">{pack.label}</p>
                <p className="text-2xl font-light text-foreground mb-1">
                  <span className="text-neon-magenta">&#x25C8;</span> {pack.amount.toLocaleString()}
                </p>
                <p className="text-sm text-muted mb-1">/ {pack.price} USD</p>
                <Link
                  href="/login"
                  onClick={() => playSound("click")}
                  className="block w-full text-center text-sm px-4 py-2.5 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all mt-3"
                >
                  Buy
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-xl mx-auto mb-8">
          <h2 className="text-lg font-light text-foreground-dim text-center mb-6">Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <span className="text-sm text-foreground-dim">{faq.q}</span>
                  <span className="text-muted text-sm flex-shrink-0">{faqOpen === i ? "\u2212" : "+"}</span>
                </button>
                {faqOpen === i && <div className="px-4 pb-3 text-sm text-muted leading-relaxed">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-faint text-center">
          Tokens power AI responses in your scenes. Each match has a shared pool.
        </p>
      </div>
    </main>
  );
}
