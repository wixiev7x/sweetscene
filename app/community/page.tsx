"use client";

import Link from "next/link";
import { playSound } from "@/lib/utils/sound";

function ConfessionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path d="M4 5h16v14l-4-3H4V5z" stroke="var(--accent-candle)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 9h10M7 12h6" stroke="var(--accent-rose)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" stroke="var(--accent-candle)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" stroke="var(--accent-rose)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13h4M9 20h6M12 14v6" stroke="var(--accent-candle)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4z" stroke="var(--accent-candle)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 4a2 2 0 0 0-2 2v2h2" stroke="var(--accent-rose)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 9h5M10 12.5h5M10 16h3" stroke="var(--accent-candle)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="var(--accent-candle)" strokeWidth="1.4" />
      <path d="M4 10h16M8 4v4M16 4v4" stroke="var(--accent-candle)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1.1" fill="var(--accent-rose)" />
      <circle cx="13" cy="16.5" r="1.1" fill="var(--accent-candle)" />
    </svg>
  );
}

const DESTINATIONS = [
  { href: "/confessions", title: "Anonymous Confessions", desc: "Share your stories anonymously.", icon: <ConfessionIcon /> },
  { href: "/leaderboard", title: "Creator Leaderboard", desc: "Top creators ranked by engagement.", icon: <TrophyIcon /> },
  { href: "/bounties", title: "Bounty Board", desc: "Post and respond to match requests.", icon: <ScrollIcon /> },
  { href: "/events", title: "Events", desc: "Blind date countdowns and live events.", icon: <CalendarIcon /> },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-candle mb-2">
          The gathering
        </p>
        <h1 className="font-display text-3xl sm:text-4xl leading-tight mb-3">
          The <span className="gradient-text">community.</span>
        </h1>
        <p className="text-muted text-sm sm:text-base mb-8">
          Stories, standings, and open invitations — all anonymous.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {DESTINATIONS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              onClick={() => playSound("click")}
              className="group bg-surface border border-line rounded-[var(--radius-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-candle/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-candle/10 border border-accent-candle/25 group-hover:bg-accent-candle/15 transition-colors">
                  {d.icon}
                </span>
                <h2 className="font-display text-base">{d.title}</h2>
              </div>
              <p className="text-sm text-muted">{d.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/how"
            className="text-sm text-accent-candle hover:text-accent-candle-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus rounded"
          >
            How it works →
          </Link>
        </div>
      </div>
    </div>
  );
}
