"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const SIDEBAR_ITEMS = [
  { href: "/", label: "Explore", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { href: "/quiz", label: "Matchmaker", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
  { href: "/chat/1", label: "Chat", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/bounties", label: "Bounties", icon: "M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" },
  { href: "/confessions", label: "Confessions", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/community", label: "Community", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { href: "/store", label: "Store", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 8h18M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/achievements", label: "Awards", icon: "M8 21h8M12 17v4M6 4h12v7a6 6 0 01-12 0zM4 4h2v7a2 2 0 01-2-2zM18 4h2v5a2 2 0 01-2 2z" },
];

const MOBILE_TABS = [
  { href: "/", label: "Explore", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { href: "/chat/1", label: "Chat", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/quiz", label: "Match", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
  { href: "/store", label: "Store", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 8h18" },
  { href: "/profile", label: "Profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
];

const MOBILE_DRAWER_ITEMS = [
  { href: "/bounties", label: "Bounties" },
  { href: "/confessions", label: "Confessions" },
  { href: "/community", label: "Community" },
  { href: "/achievements", label: "Awards" },
  { href: "/how", label: "How It Works" },
  { href: "/trending", label: "Trending" },
  { href: "/events", label: "Events" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/safety", label: "Safety" },
];

export function SiteNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tokens, setTokens] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("tokens_balance")
            .eq("id", user.id)
            .single();
          if (data?.tokens_balance != null) setTokens(data.tokens_balance);
        }
      } catch {
        // not logged in — tokens stays null
      }
    }
    fetchTokens();
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Top bar */}
      <header
        className={`sticky top-0 z-50 border-b border-white/5 bg-void-950/90 backdrop-blur-xl ${className}`}
      >
        <div className="flex items-center justify-between px-3 sm:px-4 h-12">
          {/* Left: logo */}
          <Link
            href="/"
            className="font-retro text-xs tracking-wider text-neon-magenta neon-text flex items-center gap-1.5 flex-shrink-0"
          >
            <span className="text-neon-magenta">&#x2665;</span>
            <span className="hidden sm:inline">SWEETSCENE</span>
          </Link>

          {/* Middle: search — squared-off */}
          <div className="flex-1 max-w-md mx-3">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  window.location.href = `/explore`;
                }
              }}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30 transition-colors"
            />
          </div>

          {/* Right: currency + login + start */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/store"
              className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md px-2.5 py-1 text-sm text-foreground hover:border-neon-magenta/30 transition-colors"
            >
              <span className="text-neon-magenta">&#x25C8;</span>
              <span>{tokens != null ? tokens : 0}</span>
              <span className="text-neon-magenta ml-0.5 hover:text-brand-light">+</span>
            </Link>
            <Link
              href="/login"
              className="text-sm px-3 py-1.5 rounded-md text-muted hover:text-foreground-dim border border-white/10 hover:border-white/20 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="text-sm px-3 py-1.5 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
            >
              Start
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-12 bottom-0 w-16 flex-col items-center py-4 border-r border-white/5 bg-void-950/50 backdrop-blur-sm z-40 overflow-y-auto">
        {SIDEBAR_ITEMS.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={`group flex flex-col items-center gap-1 w-full py-2.5 transition-colors ${
              isActive(item.href) ? "text-neon-magenta" : "text-muted hover:text-foreground-dim"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span className="text-[8px] uppercase tracking-wider">{item.label}</span>
          </Link>
        ))}
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-void-950/95 backdrop-blur-xl flex items-center justify-around h-14">
        {MOBILE_TABS.map((tab) => (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1 transition-colors ${
              isActive(tab.href) ? "text-neon-magenta" : "text-muted"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span className="text-[8px]">{tab.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex flex-col items-center gap-0.5 flex-1 py-1 text-muted"
          aria-label="More"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={mobileOpen ? "M18 6L6 18M6 6l12 12" : "M3 12h18M3 6h18M3 18h18"} />
          </svg>
          <span className="text-[8px]">More</span>
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 z-50 bg-void-950/98 backdrop-blur-xl border-t border-white/5 pb-2">
          <div className="grid grid-cols-3 gap-2 p-3">
            {MOBILE_DRAWER_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`text-xs text-center py-2.5 rounded-lg border transition-colors ${
                  isActive(item.href)
                    ? "text-neon-magenta border-neon-magenta/30 bg-neon-magenta/5"
                    : "text-muted border-white/10 hover:text-foreground-dim"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default SiteNav;
