"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type IconColor = {
  bg: string;
  text: string;
};

const ICON_TINTS: Record<string, IconColor> = {
  Explore: { bg: "bg-ios-blue/15", text: "text-ios-blue" },
  Matchmake: { bg: "bg-brand/15", text: "text-brand" },
  Chat: { bg: "bg-ios-green/15", text: "text-ios-green" },
  Scenarios: { bg: "bg-ios-orange/15", text: "text-ios-orange" },
  Community: { bg: "bg-ios-purple/15", text: "text-ios-purple" },
  Confessions: { bg: "bg-ios-red/15", text: "text-ios-red" },
  Bounties: { bg: "bg-ios-yellow/15", text: "text-ios-yellow" },
  Quiz: { bg: "bg-ios-teal/15", text: "text-ios-teal" },
  Store: { bg: "bg-ios-indigo/15", text: "text-ios-indigo" },
  Achievements: { bg: "bg-ios-orange/15", text: "text-ios-orange" },
  Safety: { bg: "bg-ios-red/15", text: "text-ios-red" },
  Help: { bg: "bg-ios-gray/15", text: "text-ios-gray" },
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const GROUP_1: NavItem[] = [
  { href: "/", label: "Explore", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { href: "/quiz", label: "Matchmake", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
  { href: "/chat/1", label: "Chat", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/scenarios", label: "Scenarios", icon: "M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" },
];

const GROUP_2: NavItem[] = [
  { href: "/community", label: "Community", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { href: "/confessions", label: "Confessions", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/bounties", label: "Bounties", icon: "M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" },
  { href: "/quiz", label: "Quiz", icon: "M9 11a4 4 0 100-8 4 4 0 000 8zM9 14c-3 0-6 1.5-6 4v2h12v-2c0-2.5-3-4-6-4z" },
];

const GROUP_3: NavItem[] = [
  { href: "/store", label: "Store", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 8h18M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/achievements", label: "Achievements", icon: "M8 21h8M12 17v4M6 4h12v7a6 6 0 01-12 0zM4 4h2v7a2 2 0 01-2-2zM18 4h2v5a2 2 0 01-2 2z" },
  { href: "/safety", label: "Safety", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { href: "/how", label: "Help", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01" },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Explore", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { href: "/chat/1", label: "Chat", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/quiz", label: "Match", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
  { href: "/store", label: "Store", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 8h18" },
  { href: "/profile", label: "Profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
];

function SidebarRow({ item, active }: { item: NavItem; active: boolean }) {
  const tint = ICON_TINTS[item.label] || ICON_TINTS.Help;
  return (
    <Link
      href={item.href}
      className={`ios-press ios-hairline flex items-center gap-3 px-3 last:border-b-0 transition-all ${
        active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
      }`}
      style={{ minHeight: "50px" }}
    >
      <div className={`flex items-center justify-center w-7 h-7 rounded-[8px] flex-shrink-0 ${tint.bg}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tint.text}>
          <path d={item.icon} />
        </svg>
      </div>
      <span className={`text-[15px] flex-1 ${active ? "text-white font-medium" : "text-[var(--ios-text-secondary)]"}`}>
        {item.label}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ios-text-tertiary)] flex-shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

function SidebarGroup({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <div className="ios-card overflow-hidden mb-3">
      {items.map((item) => (
        <SidebarRow key={item.label} item={item} active={isActive(item.href)} />
      ))}
    </div>
  );
}

export function SiteNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
      }
    }
    fetchTokens();
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Top bar — iOS frosted */}
      <header
        className={`sticky top-0 z-50 ios-frosted border-b border-[var(--ios-hairline)] ${className}`}
        style={{ height: "56px" }}
      >
        <div className="flex items-center justify-between h-full px-4">
          {/* Left: logo (mobile shows toggle) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-brand text-lg">&#x2665;</span>
            <span className="font-retro text-[9px] tracking-wider text-brand neon-text hidden sm:inline">SWEETSCENE</span>
          </div>

          {/* Right cluster — 44px circular frosted buttons */}
          <div className="flex items-center gap-2.5">
            {/* Currency pill */}
            <Link
              href="/store"
              className="ios-press flex items-center gap-1.5 rounded-full bg-white/5 border border-[var(--ios-hairline)] px-3 h-11 text-[15px] text-white transition-all hover:bg-white/10"
            >
              <span className="text-brand text-base">&#x25C8;</span>
              <span className="font-medium">{tokens != null ? tokens : 0}</span>
              <span className="text-brand text-sm hover:text-brand-light">+</span>
            </Link>

            {/* Notifications bell */}
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              className="ios-press relative flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-[var(--ios-hairline)] text-white transition-all hover:bg-white/10"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-ios-red text-white text-[9px] font-bold flex items-center justify-center">
                0
              </span>
            </button>

            {/* Go Premium capsule */}
            <Link
              href="/store"
              className="ios-press hidden sm:flex items-center gap-1.5 rounded-full px-4 h-11 text-[15px] font-medium text-white transition-all"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
              <span>Go Premium</span>
            </Link>

            {/* Premium icon on mobile */}
            <Link
              href="/store"
              className="ios-press sm:hidden flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-[var(--ios-hairline)] text-brand transition-all hover:bg-white/10"
              aria-label="Go Premium"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
            </Link>

            {/* Avatar */}
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              className="ios-press flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-brand to-crimson-600 text-white font-semibold text-sm transition-all hover:opacity-90"
              aria-label="Profile"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notifications dropdown sheet */}
        {notifOpen && (
          <div className="ios-dropdown absolute right-4 top-14 w-80 ios-card ios-frosted border border-[var(--ios-hairline)] p-4 z-50">
            <h3 className="text-[17px] font-semibold text-white mb-3">Notifications</h3>
            <p className="text-[15px] text-[var(--ios-text-secondary)] text-center py-8">No notifications yet</p>
          </div>
        )}

        {/* Profile dropdown sheet */}
        {profileOpen && (
          <div className="ios-dropdown absolute right-4 top-14 w-64 ios-card ios-frosted border border-[var(--ios-hairline)] p-2 z-50">
            <Link href="/profile" className="ios-press ios-hairline flex items-center gap-3 px-3 py-3 last:border-b-0 hover:bg-white/5 rounded-[10px]">
              <span className="text-[15px] text-white">Profile</span>
            </Link>
            <Link href="/login" className="ios-press ios-hairline flex items-center gap-3 px-3 py-3 last:border-b-0 hover:bg-white/5 rounded-[10px]">
              <span className="text-[15px] text-white">Login</span>
            </Link>
            <Link href="/signup" className="ios-press flex items-center gap-3 px-3 py-3 hover:bg-white/5 rounded-[10px]">
              <span className="text-[15px] text-white">Sign Up</span>
            </Link>
          </div>
        )}
      </header>

      {/* Desktop sidebar — iOS Settings style */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-72 flex-col ios-frosted border-r border-[var(--ios-hairline)] z-40 overflow-y-auto scrollbar-none">
        {/* Logo at top */}
        <div className="flex items-center gap-2 px-4 border-b border-[var(--ios-hairline)]" style={{ height: "56px" }}>
          <span className="text-brand text-lg">&#x2665;</span>
          <span className="font-retro text-[10px] tracking-wider text-brand neon-text">SWEETSCENE</span>
        </div>

        {/* Primary CTA — Create button */}
        <div className="px-4 pt-4 pb-3">
          <Link
            href="/create"
            className="ios-press flex items-center justify-center gap-2 w-full rounded-full text-white font-semibold text-[17px] transition-all hover:opacity-90"
            style={{ height: "52px", background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create
          </Link>
        </div>

        {/* Nav groups */}
        <div className="px-4 pb-4 flex-1">
          <SidebarGroup items={GROUP_1} isActive={isActive} />
          <SidebarGroup items={GROUP_2} isActive={isActive} />
          <SidebarGroup items={GROUP_3} isActive={isActive} />
        </div>

        {/* Bottom: Profile + Premium upsell */}
        <div className="px-4 pb-4 border-t border-[var(--ios-hairline)] pt-3">
          <Link
            href="/profile"
            className="ios-press flex items-center gap-3 ios-row px-3 mb-3 hover:bg-white/5"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-crimson-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <span className="text-[15px] text-white flex-1">Profile</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ios-text-tertiary)]">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>

          <Link
            href="/store"
            className="ios-press flex items-center justify-between rounded-[20px] px-4 py-3 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, rgba(255,45,149,0.08), rgba(220,20,60,0.08))", border: "1px solid rgba(255,45,149,0.15)" }}
          >
            <div>
              <p className="text-[15px] font-medium text-white">Go Premium</p>
              <p className="text-[13px] text-[var(--ios-text-secondary)]">Unlock everything</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </aside>

      {/* Mobile bottom tab bar — iOS style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 ios-frosted border-t border-[var(--ios-hairline)] flex items-center justify-around" style={{ height: "52px" }}>
        {MOBILE_TABS.map((tab) => (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            className={`ios-press flex flex-col items-center gap-0.5 flex-1 transition-colors ${
              isActive(tab.href) ? "text-brand" : "text-[var(--ios-text-secondary)]"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span className="text-[10px]">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export default SiteNav;
