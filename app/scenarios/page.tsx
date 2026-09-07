"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

const SCENARIOS = [
  { kind: "diner", name: "Late-Night Diner", desc: "3am, greasy fries, a jukebox that only plays one song on repeat. The AI keeps throwing curveball questions at you both until sunrise." },
  { kind: "rooftop", name: "Rooftop Stargazing", desc: "Ten minutes until the show starts. No names, just a shared blanket and a skyline." },
  { kind: "train", name: "Train Compartment", desc: "You both swiped Anonymous. The AI seals the compartment doors. Six hours to the next stop." },
  { kind: "airport", name: "Airport Lounge", desc: "Delayed flight. Shared charger. The AI narrates your layover like a rom-com trailer." },
  { kind: "foodtruck", name: "Food Truck Festival", desc: "Last two in line. Rain starts. The AI makes you share an umbrella and opinions." },
  { kind: "masquerade", name: "Masquerade Ball", desc: "Masks on. The AI assigns secret identities. Dance with a stranger who might be anyone." },
] as const;

function SceneArt({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full block" aria-hidden="true" role="presentation">
      <defs>
        <linearGradient id={`sky-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.2 0.035 285)" />
          <stop offset="100%" stopColor="oklch(0.13 0.025 285)" />
        </linearGradient>
        <radialGradient id={`glow-${kind}`} cx="0.5" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="oklch(0.82 0.14 75 / 0.35)" />
          <stop offset="100%" stopColor="oklch(0.82 0.14 75 / 0)" />
        </radialGradient>
        <linearGradient id="rimlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.14 75 / 0.25)" />
          <stop offset="30%" stopColor="oklch(0.82 0.14 75 / 0)" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#sky-${kind})`} />
      <rect width="320" height="200" fill={`url(#glow-${kind})`} />
      {kind === "diner" && (
        <g>
          <rect x="0" y="150" width="320" height="50" fill="oklch(0.16 0.03 285)" />
          <rect x="24" y="120" width="120" height="8" rx="4" fill="oklch(0.28 0.04 285)" />
          <circle cx="52" cy="142" r="7" fill="oklch(0.22 0.03 285)" />
          <circle cx="112" cy="142" r="7" fill="oklch(0.22 0.03 285)" />
          <rect x="200" y="46" width="86" height="30" rx="6" fill="oklch(0.72 0.16 10 / 0.18)" stroke="oklch(0.72 0.16 10 / 0.7)" strokeWidth="1.5" />
          <rect x="210" y="56" width="66" height="3" rx="1.5" fill="oklch(0.72 0.16 10 / 0.8)" />
          <rect x="210" y="64" width="44" height="3" rx="1.5" fill="oklch(0.72 0.16 10 / 0.5)" />
          <circle cx="160" cy="70" r="10" fill="oklch(0.82 0.14 75 / 0.6)" />
          <path d="M148 96 q12 -10 24 0" stroke="oklch(0.82 0.14 75 / 0.3)" strokeWidth="2" fill="none" />
          <path d="M152 104 q8 -8 16 0" stroke="oklch(0.82 0.14 75 / 0.2)" strokeWidth="2" fill="none" />
        </g>
      )}
      {kind === "rooftop" && (
        <g>
          {[
            [30, 22], [70, 34], [120, 18], [180, 30], [230, 14], [270, 26], [300, 38], [50, 58], [200, 52], [250, 60],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.4" fill="oklch(0.95 0.01 60 / 0.8)" />
          ))}
          <circle cx="252" cy="52" r="16" fill="oklch(0.82 0.14 75 / 0.85)" />
          <circle cx="252" cy="52" r="24" fill="oklch(0.82 0.14 75 / 0.18)" />
          <g fill="oklch(0.15 0.03 285)">
            <rect x="0" y="128" width="46" height="72" />
            <rect x="52" y="112" width="38" height="88" />
            <rect x="96" y="140" width="52" height="60" />
            <rect x="154" y="104" width="44" height="96" />
            <rect x="204" y="132" width="40" height="68" />
            <rect x="250" y="118" width="36" height="82" />
            <rect x="292" y="146" width="28" height="54" />
          </g>
          <rect x="88" y="150" width="90" height="10" rx="5" fill="oklch(0.4 0.06 350 / 0.8)" />
          <path d="M96 150 l0 -14 M104 150 l0 -14 M112 150 l0 -14 M120 150 l0 -14" stroke="oklch(0.4 0.06 350 / 0.6)" strokeWidth="2" />
        </g>
      )}
      {kind === "train" && (
        <g>
          <rect x="30" y="34" width="260" height="96" rx="10" fill="oklch(0.18 0.03 285)" stroke="oklch(0.32 0.04 285)" strokeWidth="3" />
          <rect x="42" y="46" width="236" height="72" rx="6" fill="oklch(0.22 0.04 300 / 0.5)" />
          <path d="M60 110 l30 -40 M120 110 l50 -64 M200 110 l40 -52" stroke="oklch(0.55 0.03 280 / 0.5)" strokeWidth="2" />
          <circle cx="76" cy="66" r="2" fill="oklch(0.95 0.01 60 / 0.7)" />
          <circle cx="180" cy="58" r="2" fill="oklch(0.95 0.01 60 / 0.7)" />
          <rect x="0" y="150" width="320" height="50" fill="oklch(0.15 0.03 285)" />
          <rect x="64" y="140" width="34" height="12" rx="6" fill="oklch(0.25 0.04 285)" />
          <rect x="222" y="140" width="34" height="12" rx="6" fill="oklch(0.25 0.04 285)" />
          <circle cx="288" cy="88" r="7" fill="oklch(0.82 0.14 75 / 0.7)" />
          <circle cx="288" cy="88" r="12" fill="oklch(0.82 0.14 75 / 0.15)" />
        </g>
      )}
      {kind === "airport" && (
        <g>
          <rect x="36" y="60" width="248" height="76" rx="8" fill="oklch(0.19 0.03 285)" stroke="oklch(0.3 0.04 285)" strokeWidth="2.5" />
          <rect x="48" y="70" width="224" height="56" rx="5" fill="oklch(0.26 0.05 260 / 0.55)" />
          <path d="M150 96 l26 -8 l-26 -8 l4 8 z" fill="oklch(0.82 0.14 75 / 0.75)" />
          <path d="M60 118 h60 M140 118 h30 M190 118 h50" stroke="oklch(0.5 0.04 280 / 0.6)" strokeWidth="2" />
          <rect x="0" y="150" width="320" height="50" fill="oklch(0.16 0.03 285)" />
          <rect x="24" y="28" width="110" height="22" rx="4" fill="oklch(0.14 0.025 285)" stroke="oklch(0.35 0.04 285)" strokeWidth="1.5" />
          <rect x="32" y="34" width="58" height="3" rx="1.5" fill="oklch(0.82 0.14 75 / 0.7)" />
          <rect x="32" y="41" width="40" height="3" rx="1.5" fill="oklch(0.82 0.14 75 / 0.4)" />
          <circle cx="272" cy="40" r="3" fill="oklch(0.82 0.14 75 / 0.8)" />
        </g>
      )}
      {kind === "foodtruck" && (
        <g>
          <path d="M20 54 l24 -12 l12 4 M250 40 l30 10 M40 46 l8 2" stroke="oklch(0.72 0.16 10 / 0.35)" strokeWidth="2" />
          {[
            "M36 60 l-8 18", "M76 60 l-8 18", "M116 60 l-8 18", "M156 60 l-8 18", "M196 60 l-8 18", "M236 60 l-8 18", "M276 60 l-8 18",
          ].map((d, i) => (
            <path key={i} d={d} stroke="oklch(0.72 0.16 10 / 0.3)" strokeWidth="1.6" />
          ))}
          <rect x="0" y="150" width="320" height="50" fill="oklch(0.15 0.03 285)" />
          <rect x="96" y="104" width="112" height="38" rx="6" fill="oklch(0.24 0.04 285)" />
          <rect x="208" y="116" width="26" height="26" rx="4" fill="oklch(0.2 0.035 285)" />
          <circle cx="122" cy="146" r="9" fill="oklch(0.3 0.04 285)" />
          <circle cx="228" cy="146" r="9" fill="oklch(0.3 0.04 285)" />
          <rect x="108" y="92" width="26" height="14" rx="3" fill="oklch(0.82 0.14 75 / 0.6)" />
          <path d="M158 74 q30 -18 60 0 z" fill="oklch(0.4 0.06 350 / 0.75)" />
          <line x1="188" y1="74" x2="188" y2="104" stroke="oklch(0.3 0.04 285)" strokeWidth="2.5" />
        </g>
      )}
      {kind === "masquerade" && (
        <g>
          <path d="M160 18 l-3 10 h6 z" fill="oklch(0.55 0.06 350)" />
          <path d="M128 30 q32 -18 64 0 q-6 16 -32 16 q-26 0 -32 -16 z" fill="oklch(0.4 0.06 350 / 0.6)" stroke="oklch(0.72 0.16 10 / 0.5)" strokeWidth="1.5" />
          {[
            [140, 36], [160, 40], [180, 36], [150, 30], [170, 30],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="oklch(0.82 0.14 75 / 0.8)" />
          ))}
          <path d="M92 104 q18 -14 36 0 q0 16 -18 22 q-18 -6 -18 -22 z" fill="oklch(0.24 0.04 285)" stroke="oklch(0.82 0.14 75 / 0.55)" strokeWidth="1.5" />
          <circle cx="100" cy="102" r="4" fill="oklch(0.82 0.14 75 / 0.35)" />
          <circle cx="122" cy="102" r="4" fill="oklch(0.82 0.14 75 / 0.35)" />
          <path d="M192 104 q18 -14 36 0 q0 16 -18 22 q-18 -6 -18 -22 z" fill="oklch(0.24 0.04 285)" stroke="oklch(0.72 0.16 10 / 0.55)" strokeWidth="1.5" />
          <circle cx="200" cy="102" r="4" fill="oklch(0.72 0.16 10 / 0.35)" />
          <circle cx="222" cy="102" r="4" fill="oklch(0.72 0.16 10 / 0.35)" />
          <rect x="0" y="150" width="320" height="50" fill="oklch(0.16 0.03 285)" />
          {[
            [60, 70], [260, 64], [46, 120], [272, 116], [90, 52], [236, 130],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill={i % 2 ? "oklch(0.72 0.16 10 / 0.6)" : "oklch(0.82 0.14 75 / 0.6)"} />
          ))}
        </g>
      )}
      <rect width="320" height="200" fill="url(#rimlight)" />
      <rect x="0.75" y="0.75" width="318.5" height="198.5" rx="0" fill="none" stroke="oklch(1 0 0 / 6%)" strokeWidth="1.5" />
    </svg>
  );
}

function JarArt() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20" aria-hidden="true" role="presentation">
      <defs>
        <radialGradient id="jarGlow" cx="0.5" cy="0.4" r="0.8">
          <stop offset="0%" stopColor="oklch(0.82 0.14 75 / 0.3)" />
          <stop offset="100%" stopColor="oklch(0.82 0.14 75 / 0)" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#jarGlow)" />
      <rect x="38" y="18" width="44" height="10" rx="4" fill="oklch(0.4 0.06 350)" />
      <rect x="34" y="26" width="52" height="8" rx="3" fill="oklch(0.45 0.07 350)" />
      <path d="M38 34 q-10 4 -10 18 v40 q0 14 14 14 h36 q14 0 14 -14 v-40 q0 -14 -10 -18 z" fill="oklch(0.95 0.01 60 / 0.08)" stroke="oklch(0.82 0.14 75 / 0.5)" strokeWidth="2" />
      <rect x="44" y="58" width="32" height="22" rx="2" fill="oklch(0.19 0.03 285)" stroke="oklch(0.65 0.02 280 / 0.6)" strokeWidth="1" transform="rotate(-8 60 69)" />
      <rect x="48" y="63" width="24" height="2" rx="1" fill="oklch(0.82 0.14 75 / 0.6)" transform="rotate(-8 60 69)" />
      <rect x="48" y="68" width="16" height="2" rx="1" fill="oklch(0.82 0.14 75 / 0.35)" transform="rotate(-8 60 69)" />
      <rect x="46" y="76" width="30" height="20" rx="2" fill="oklch(0.22 0.035 285)" stroke="oklch(0.65 0.02 280 / 0.6)" strokeWidth="1" transform="rotate(7 61 86)" />
      <rect x="50" y="81" width="22" height="2" rx="1" fill="oklch(0.72 0.16 10 / 0.6)" transform="rotate(7 61 86)" />
      <rect x="50" y="86" width="14" height="2" rx="1" fill="oklch(0.72 0.16 10 / 0.35)" transform="rotate(7 61 86)" />
      <circle cx="84" cy="46" r="1.6" fill="oklch(0.82 0.14 75 / 0.7)" />
      <circle cx="30" cy="58" r="1.3" fill="oklch(0.72 0.16 10 / 0.5)" />
      <circle cx="92" cy="70" r="1.3" fill="oklch(0.82 0.14 75 / 0.5)" />
    </svg>
  );
}

export default function ScenariosPage() {
  const [mashup, setMashup] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  function shakeJar() {
    playSound("matchSearch");
    setShaking(true);
    const a = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    let b = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    while (b.name === a.name) b = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    setMashup(`${a.name} \u00D7 ${b.name}`);
    setTimeout(() => setShaking(false), 600);
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-candle mb-2">The scene book</p>
        <h1 className="font-retro text-3xl md:text-4xl mb-2">
          Step into a <span className="gradient-text">scene.</span>
        </h1>
        <p className="text-sm text-muted mb-8">Cinematic openers, hosted by an AI that keeps the night moving.</p>

        <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 sm:p-8 mb-10 flex flex-col sm:flex-row items-center gap-6">
          <div
            style={shaking ? { animation: "jarShake 0.6s ease-in-out" } : undefined}
          >
            <JarArt />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-faint mb-2">Tonight&rsquo;s random scene</p>
            {mashup ? (
              <div className="animate-slide-up">
                <p className="font-retro text-xl gradient-text mb-2">{mashup}</p>
                <p className="text-sm text-muted">A mashup unlike anything you&rsquo;ve played before.</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Shake the jar. Get a random scene mashup.</p>
            )}
            <button
              onClick={shakeJar}
              className="mt-4 px-6 py-2.5 rounded-full font-medium text-sm text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light active:scale-95 transform transition-all focus-visible:ring-2 ring-line-focus"
            >
              Shake the jar
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCENARIOS.map((s, i) => (
            <div
              key={s.kind}
              className="group bg-surface border border-line rounded-[var(--radius-card)] overflow-hidden hover:border-line-strong hover:-translate-y-0.5 transition-all focus-within:border-line-strong"
              style={{ animation: `slideUp 0.4s ease-out ${i * 0.1}s both` }}
            >
              <div className="aspect-[16/10] overflow-hidden">
                <SceneArt kind={s.kind} />
              </div>
              <div className="p-5">
                <h3 className="font-retro text-base text-foreground mb-2">{s.name}</h3>
                <p className="text-sm text-muted leading-relaxed mb-4">{s.desc}</p>
                <Link
                  href="/login"
                  onClick={() => playSound("click")}
                  className="block w-full text-center px-4 py-2.5 rounded-full font-medium text-sm text-foreground bg-surface-sunken border border-line hover:border-accent-candle/40 hover:text-accent-candle active:scale-95 transform transition-all focus-visible:ring-2 ring-line-focus"
                >
                  Join Scene
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/bounties" className="text-sm text-accent-candle hover:text-accent-candle-deep underline-offset-4 hover:underline transition-all">
            Looking for something specific? Post a request or respond to one. →
          </Link>
        </div>
      </div>
    </main>
  );
}
