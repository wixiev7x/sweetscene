"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your profile anytime. No questions asked." },
  { q: "What are tokens?", a: "Tokens power AI responses in your scenes. Each match has a shared pool that depletes as the AI contributes." },
  { q: "Is payment secure?", a: "We use crypto payments via NOWPayments. No card required." },
];

export default function PremiumPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const plans = [
    { name: "Free", price: "$0", period: "forever", desc: "Start anonymous", features: ["3 daily matches", "Quick tier scenes (2k tokens)", "Browse all characters", "Anonymous confessions"], cta: "Get Started", highlight: false },
    { name: "Standard", price: "$9.99", period: "month", desc: "More scenes, more connections", features: ["Unlimited daily matches", "Quick + Deep Dive tiers (10k tokens)", "Standard AI scenes", "Basic interest tags", "3 AI images per match", "Priority matchmaking"], cta: "Become Standard", highlight: true },
    { name: "Premium", price: "$19.99", period: "month", desc: "Everything, unlocked", features: ["Everything in Standard", "Richer AI scenes", "Advanced interest filtering", "Custom scene requests", "Priority reveal queue", "Exclusive badges"], cta: "Go Premium", highlight: false },
  ];

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light text-foreground-dim mb-1">Choose Your Plan</h1>
          <p className="text-sm text-muted">Choose your access level.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {plans.map((plan) => (
            <div key={plan.name}
              className={`relative rounded-2xl p-6 border transition-all ${plan.highlight ? "border-brand/40 bg-brand/5 md:scale-105" : plan.name === "Premium" ? "border-gold-500/40 bg-gold-500/5" : "border-white/10 bg-white/5"}`}>
              {plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-white text-[10px] font-bold uppercase tracking-wider">Popular</span>
              )}
              <h2 className={`text-base font-light mb-1 ${plan.name === "Premium" ? "text-gold-400" : "text-foreground"}`}>{plan.name}</h2>
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
                className={`block w-full text-center px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${plan.highlight ? "text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500" : "text-foreground bg-white/5 border border-white/10 hover:bg-white/10"}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="max-w-xl mx-auto">
          <h3 className="text-lg font-light text-foreground-dim text-center mb-6">Questions</h3>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <span className="text-xs text-foreground-dim">{faq.q}</span>
                  <span className="text-muted text-sm flex-shrink-0">{faqOpen === i ? "\u2212" : "+"}</span>
                </button>
                {faqOpen === i && <div className="px-4 pb-3 text-xs text-muted leading-relaxed">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
