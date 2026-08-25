"use client";

import Link from "next/link";

const STEPS = [
  { emoji: "\u{1F52E}", title: "Match Anonymously", desc: "Our AI pairs you on shared interests, not faces. Pick a scene, get matched instantly." },
  { emoji: "\u{1F3AD}", title: "Roleplay Together", desc: "An AI director joins your chat, breaks the ice, and keeps the scene alive with curveball prompts." },
  { emoji: "\u{1F32B}\uFE0F", title: "Reveal or Fade", desc: "When BOTH click Unmask, the blur drops. Stay anonymous forever or walk away." },
];

export default function HowPage() {
  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">How It Works</h1>
        <p className="text-sm text-muted mb-8">Three steps to anonymous connection.</p>

        <div className="grid sm:grid-cols-3 gap-5">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:border-neon-magenta/40 transition-all">
              <span className="block text-3xl mb-3">{step.emoji}</span>
              <h2 className="text-sm text-foreground font-light mb-2">{step.title}</h2>
              <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/quiz" className="inline-block text-xs px-5 py-2.5 rounded-full text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all">
            Start Matching
          </Link>
        </div>
      </div>
    </main>
  );
}
