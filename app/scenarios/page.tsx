"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

const SCENARIOS = [
  { name: "Late-Night Diner", desc: "3am, greasy fries, a jukebox that only plays one song on repeat. The AI keeps throwing curveball questions at you both until sunrise.", emoji: "\u{1F374}" },
  { name: "Rooftop Stargazing", desc: "Ten minutes until the show starts. No names, just a shared blanket and a skyline.", emoji: "\u{1F31F}" },
  { name: "Train Compartment", desc: "You both swiped Anonymous. The AI seals the compartment doors. Six hours to the next stop.", emoji: "\u{1F686}" },
  { name: "Airport Lounge", desc: "Delayed flight. Shared charger. The AI narrates your layover like a rom-com trailer.", emoji: "\u2708\uFE0F" },
  { name: "Food Truck Festival", desc: "Last two in line. Rain starts. The AI makes you share an umbrella and opinions.", emoji: "\u{1F32D}" },
  { name: "Masquerade Ball", desc: "Masks on. The AI assigns secret identities. Dance with a stranger who might be anyone.", emoji: "\u{1F3AD}" },
];

export default function ScenariosPage() {
  const [mashup, setMashup] = useState<string | null>(null);

  function shakeJar() {
    playSound("matchSearch");
    const a = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    let b = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    while (b.name === a.name) b = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    setMashup(`${a.name} \u00D7 ${b.name}`);
  }

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-light text-foreground-dim mb-2">Scenarios</h1>
        <p className="text-sm text-muted mb-8">Browse all available rooms and scenarios.</p>

        <div className="bg-surface/30 border border-white/10 rounded-2xl p-6 mb-8 text-center">
          <p className="text-xs text-muted-faint uppercase tracking-widest mb-3">Tonight&apos;s random scene</p>
          {mashup ? (
            <div className="animate-slide-up">
              <p className="text-xl text-brand-light font-retro mb-2">{mashup}</p>
              <p className="text-sm text-muted">A mashup unlike anything you&apos;ve played before.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Shake the jar. Get a random scene mashup.</p>
          )}
          <button onClick={shakeJar}
            className="mt-4 px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all pulse-glow">
            Shake the jar
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCENARIOS.map((s, i) => (
            <div key={i} className="group bg-surface/50 border border-white/10 rounded-2xl p-6 hover:border-neon-magenta/40 transition-all"
              style={{ animation: `slideUp 0.4s ease-out ${i * 0.1}s both` }}>
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">{s.emoji}</span>
                <div>
                  <h3 className="text-lg text-foreground font-light">{s.name}</h3>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-4">{s.desc}</p>
              <Link href="/login" onClick={() => playSound("click")}
                className="block w-full text-center px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transform transition-all">
                Join Scene
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/bounties" className="text-sm text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline transition-all">
            Looking for something specific? Post a request or respond to one. →
          </Link>
        </div>
      </div>
    </main>
  );
}
