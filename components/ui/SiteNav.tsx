"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/create", label: "Create" },
  { href: "/bounties", label: "Bounties" },
  { href: "/confessions", label: "Confessions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className={`sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl bg-void-950/80 px-4 sm:px-6 py-3 flex items-center justify-between ${className}`}
    >
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-brand-light hover:text-brand-lighter transition-colors flex items-center gap-2"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-neon-magenta pulse-glow" />
        SweetScene
      </Link>

      <div className="hidden md:flex items-center gap-5">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                active
                  ? "text-brand-light neon-text"
                  : "text-muted hover:text-foreground-dim"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/login"
          className="text-sm px-4 py-1.5 rounded-full bg-brand/10 border border-brand/30 text-brand-light hover:bg-brand/20 transition-all"
        >
          Login
        </Link>
      </div>

      <button
        className="md:hidden text-muted hover:text-foreground p-2"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-void-950/95 backdrop-blur-xl border-b border-white/5 md:hidden">
          <div className="flex flex-col p-4 gap-3">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm py-2 transition-colors ${
                    active ? "text-brand-light" : "text-muted hover:text-foreground-dim"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm py-2 px-4 rounded-full bg-brand/10 border border-brand/30 text-brand-light text-center"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default SiteNav;
