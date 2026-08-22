"use client";

import Link from "next/link";

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Community</h1>
        <p className="text-sm text-muted mb-8">Connect with the SweetScene community.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/confessions" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-neon-magenta/40 transition-all">
            <h2 className="text-base text-foreground mb-1">Anonymous Confessions</h2>
            <p className="text-xs text-muted">Share your stories anonymously.</p>
          </Link>
          <Link href="/leaderboard" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-neon-magenta/40 transition-all">
            <h2 className="text-base text-foreground mb-1">Creator Leaderboard</h2>
            <p className="text-xs text-muted">Top creators ranked by engagement.</p>
          </Link>
          <Link href="/bounties" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-neon-magenta/40 transition-all">
            <h2 className="text-base text-foreground mb-1">Bounty Board</h2>
            <p className="text-xs text-muted">Post and respond to match requests.</p>
          </Link>
          <Link href="/events" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-neon-magenta/40 transition-all">
            <h2 className="text-base text-foreground mb-1">Events</h2>
            <p className="text-xs text-muted">Blind date countdowns and live events.</p>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href="/how" className="text-xs text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline transition-all">
            How it works &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
