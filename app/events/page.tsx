"use client";

import Link from "next/link";

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Events</h1>
        <p className="text-sm text-muted mb-8">Blind date countdowns and live events.</p>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-sm text-muted mb-2">No active events right now.</p>
          <p className="text-xs text-muted-faint mb-6">Blind date countdowns will appear here when scheduled.</p>
          <Link
            href="/scenarios"
            className="inline-block text-xs px-5 py-2.5 rounded-full text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
          >
            Browse Scenes Instead
          </Link>
        </div>
      </div>
    </main>
  );
}
