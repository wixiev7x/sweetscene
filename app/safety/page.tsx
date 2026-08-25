"use client";

import Link from "next/link";

const SAFETY_POINTS = [
  { title: "Mutual Consent Reveal", desc: "Reveal is 100% mutual consent. Both users must click Unmask for the blur to drop." },
  { title: "Encrypted Messages", desc: "Your scenes stay in the dark. Messages are encrypted at rest." },
  { title: "Anonymous by Default", desc: "No pictures. No names. No real identities. You stay anonymous until you choose otherwise." },
  { title: "Report & Block", desc: "Report any conversation or block any user at any time from the chat menu." },
  { title: "Age Verification", desc: "All users must verify their age. This is a strictly 18+ platform." },
];

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Safety</h1>
        <p className="text-sm text-muted mb-8">Your scenes stay in the dark until you say otherwise.</p>

        <div className="space-y-3 mb-8">
          {SAFETY_POINTS.map((point) => (
            <div key={point.title} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
              <h2 className="text-sm text-foreground font-light mb-1">{point.title}</h2>
              <p className="text-xs text-muted leading-relaxed">{point.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/how" className="text-xs text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline transition-all">
            How it works &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
