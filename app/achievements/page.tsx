"use client";

import Link from "next/link";

const BADGES = [
  { name: "Marathon Talker", desc: "Complete a 2+ hour scene", icon: "\u{1F3C5}" },
  { name: "First Match", desc: "Complete your first blind match", icon: "\u{1F31F}" },
  { name: "Masked Stranger", desc: "Stay anonymous for 10 scenes", icon: "\u{1F3AD}" },
  { name: "Scene Builder", desc: "Create your first character", icon: "\u{1F528}" },
  { name: "Storyteller", desc: "Post 5 anonymous confessions", icon: "\u{1F4D6}" },
  { name: "Unmasked", desc: "Reveal your identity mutually", icon: "\u{1F441}" },
];

export default function AchievementsPage() {
  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Achievements</h1>
        <p className="text-sm text-muted mb-8">Unlock badges as you explore.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BADGES.map((badge) => (
            <div key={badge.name} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center hover:border-neon-magenta/40 transition-all">
              <span className="text-3xl block mb-3">{badge.icon}</span>
              <h2 className="text-sm text-foreground font-light mb-1">{badge.name}</h2>
              <p className="text-xs text-muted">{badge.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/create" className="text-xs text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline transition-all">
            Start earning &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
