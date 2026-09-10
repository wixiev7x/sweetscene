"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/actions/auth";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/actions/notifications";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const MAIN_GROUP: NavItem[] = [
  { href: "/", label: "Explore", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { href: "/matchmake", label: "Matchmake", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
  { href: "/lobby", label: "Scenes", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/scenarios", label: "Scenarios", icon: "M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" },
  { href: "/community", label: "Community", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { href: "/confessions", label: "Confessions", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/store", label: "Store", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 8h18M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
];

const MORE_GROUP: NavItem[] = [
  { href: "/bounties", label: "Bounties", icon: "M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" },
  { href: "/leaderboard", label: "Leaderboard", icon: "M8 21h8M12 17v4M6 4h12v7a6 6 0 01-12 0zM4 4h2v7a2 2 0 01-2-2zM18 4h2v5a2 2 0 01-2 2z" },
  { href: "/events", label: "Events", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" },
  { href: "/achievements", label: "Achievements", icon: "M8 21h8M12 17v4M6 4h12v7a6 6 0 01-12 0zM4 4h2v7a2 2 0 01-2-2zM18 4h2v5a2 2 0 01-2 2z" },
  { href: "/safety", label: "Safety", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { href: "/how", label: "Help", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01" },
  { href: "/terms", label: "Terms", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4" },
  { href: "/privacy", label: "Privacy", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Explore", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { href: "/lobby", label: "Scenes", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/matchmake", label: "Match", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" },
  { href: "/store", label: "Store", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 8h18" },
  { href: "/profile", label: "Profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
];

function CoinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`${className} inline-block`} aria-hidden="true">
      <defs>
        <radialGradient id="navCoinFace" cx="0.38" cy="0.32" r="0.9">
          <stop offset="0%" stopColor="oklch(0.9 0.1 80)" />
          <stop offset="55%" stopColor="oklch(0.82 0.14 75)" />
          <stop offset="100%" stopColor="oklch(0.74 0.13 70)" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="8.6" fill="url(#navCoinFace)" stroke="oklch(0.72 0.16 10 / 0.55)" strokeWidth="1.4" />
      <path d="M10 13.6c-1.9 0-3.2-1.5-3.2-3.6S8.1 6.4 10 6.4s3.2 1.5 3.2 3.6-1.3 3.6-3.2 3.6zm0-1.7c.8 0 1.3-.8 1.3-1.9s-.5-1.9-1.3-1.9-1.3.8-1.3 1.9.5 1.9 1.3 1.9z" fill="oklch(0.62 0.19 12 / 0.85)" />
    </svg>
  );
}

function SidebarRow({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`ios-press ios-hairline flex items-center gap-3 px-3 last:border-b-0 transition-all focus-visible:ring-2 ring-line-focus ${
        active ? "bg-accent-candle/10" : "hover:bg-surface-raised/60"
      }`}
      style={{ minHeight: "50px" }}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-[8px] flex-shrink-0 bg-surface-raised/60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-accent-candle" : "text-muted-strong"}>
          <path d={item.icon} />
        </svg>
      </div>
      <span className={`type-body flex-1 ${active ? "text-foreground font-medium" : "text-muted-strong"}`}>
        {item.label}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-faint flex-shrink-0" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export function SiteNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tokens, setTokens] = useState<number | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const morePanelRef = useRef<HTMLDivElement | null>(null);
  const bellBtnRef = useRef<HTMLButtonElement | null>(null);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  const unread = notifications.filter((n) => n.read_at === null).length;
  const displayUnread = Math.max(unread, unreadCount);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  /* ── Auth + token balance ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          setUser(user);
          /* tokens_balance is column-REVOKE'd from direct reads — the
             owner value comes from the get_own_profile RPC. */
          const { data: own } = await supabase.rpc("get_own_profile");
          const rows = (Array.isArray(own) ? own : [own]) as Array<{
            tokens_balance?: number | null;
          } | null>;
          const balance = rows?.[0]?.tokens_balance;
          if (!cancelled && balance != null) setTokens(balance);
        }
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Real notifications: initial load + realtime (signed-in only) ── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = setInterval(() => setNow(Date.now()), 30_000);

    (async () => {
      const result = await getNotifications(20);
      if (cancelled) return;
      if (!("error" in result)) {
        setNotifications(result.notifications);
        setUnreadCount(result.notifications.filter((n) => n.read_at === null).length);
      }
    })();

    const supabase = createClient();
    const channel = supabase
      .channel("site-nav-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: NotificationRow }) => {
          setNotifications((prev) => [payload.new, ...prev].slice(0, 50));
          if (payload.new.read_at === null) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload: { new: NotificationRow }) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          );
          if (payload.new.read_at !== null) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ── Escape + outside-click dismissal; focus returns to the trigger ── */
  const closeMenus = useCallback((restoreFocus: "more" | "bell" | null) => {
    setMoreOpen(false);
    setNotifOpen(false);
    if (restoreFocus === "more") moreBtnRef.current?.focus();
    if (restoreFocus === "bell") bellBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!moreOpen && !notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenus(moreOpen ? "more" : "bell");
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        moreOpen &&
        morePanelRef.current && !morePanelRef.current.contains(target) &&
        moreBtnRef.current && !moreBtnRef.current.contains(target)
      ) {
        closeMenus("more");
      } else if (
        notifOpen &&
        notifPanelRef.current && !notifPanelRef.current.contains(target) &&
        bellBtnRef.current && !bellBtnRef.current.contains(target)
      ) {
        closeMenus(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [moreOpen, notifOpen, closeMenus]);

  /* ── Mark all read when the dropdown opens ── */
  useEffect(() => {
    if (notifOpen && user && displayUnread > 0) {
      void markAllNotificationsRead().then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.read_at === null ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount(0);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  async function handleClickNotification(n: NotificationRow) {
    if (n.read_at === null) {
      await markNotificationAsRead(n.id);
    }
    if (n.match_id) {
      window.location.assign(`/chat/${n.match_id}`);
    } else {
      setNotifOpen(false);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  const formatTime = (iso: string): string => {
    const diff = now - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const moreActive = MORE_GROUP.some((i) => isActive(i.href));

  return (
    <>
      {/* Top bar — candlelit frosted */}
      <header
        className={`sticky top-0 z-50 ios-frosted border-b border-[var(--ios-hairline)] ${className}`}
        style={{ height: "56px" }}
      >
        <div className="flex items-center justify-end md:justify-between h-full px-4">
          {/* Left cluster — wordmark */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              prefetch={false}
              className="ios-press flex items-center gap-1.5 rounded-lg px-1 focus-visible:ring-2 ring-line-focus"
              aria-label="SweetScene home"
            >
              <span className="text-accent-candle text-sm" aria-hidden="true">♥</span>
              <span className="hidden md:inline type-eyebrow text-foreground">SweetScene</span>
            </Link>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2.5">
            {/* Token pill — real balance */}
            <Link
              href="/store"
              prefetch={false}
              aria-label={`Token balance: ${tokens ?? 0} — open Store`}
              className="ios-press relative flex items-center gap-1.5 rounded-full bg-surface-raised border border-line px-3 h-9 type-body text-foreground font-medium transition-all hover:bg-accent-candle/10 hover:border-accent-candle/30 focus-visible:ring-2 ring-line-focus"
            >
              <CoinIcon className="w-4 h-4" />
              <span>{tokens != null ? tokens : 0}</span>
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-accent-candle/20 text-accent-candle text-[10px] font-bold -ml-0.5" aria-hidden="true">+</span>
            </Link>

            {/* Premium */}
            <Link
              href="/premium"
              prefetch={false}
              data-cursor="primary"
              className="ios-press hidden sm:flex items-center gap-1.5 rounded-full px-3.5 h-9 type-body font-semibold text-accent-foreground transition-all hover:opacity-90 focus-visible:ring-2 ring-line-focus"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
              <span>Premium</span>
            </Link>

            {/* Premium icon on mobile */}
            <Link
              href="/premium"
              prefetch={false}
              aria-label="Go Premium"
              className="ios-press sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-surface-raised border border-line text-accent-candle transition-all hover:bg-accent-candle/10 hover:border-accent-candle/30 focus-visible:ring-2 ring-line-focus"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
            </Link>

            {/* Notifications bell — real count */}
            <button
              ref={bellBtnRef}
              onClick={() => { setNotifOpen(!notifOpen); setMoreOpen(false); }}
              aria-expanded={notifOpen}
              aria-haspopup="dialog"
              aria-label={displayUnread > 0 ? `Notifications, ${displayUnread} unread` : "Notifications"}
              className="ios-press relative flex items-center justify-center w-9 h-9 rounded-full bg-surface-raised border border-line text-foreground transition-all hover:bg-accent-candle/10 hover:border-accent-candle/30 focus-visible:ring-2 ring-line-focus"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {displayUnread > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-accent-foreground text-[10px] font-bold flex items-center justify-center" aria-hidden="true">
                  {displayUnread > 9 ? "9+" : displayUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notifications dropdown */}
        {notifOpen && (
          <div
            ref={notifPanelRef}
            role="dialog"
            aria-label="Notifications"
            className="ios-dropdown absolute right-4 top-14 w-80 max-h-96 overflow-y-auto ios-card ios-frosted border border-line shadow-2xl z-50"
          >
            {!user ? (
              <div className="p-5 text-center">
                <p className="type-body text-muted-strong mb-3">Sign in to see your notifications.</p>
                <Link
                  href="/login?next=/lobby"
                  prefetch={false}
                  className="type-meta font-semibold text-accent-candle hover:underline focus-visible:ring-2 ring-line-focus rounded px-1"
                >
                  Sign in
                </Link>
              </div>
            ) : notifications.length === 0 ? (
              <p className="type-body text-muted text-center py-8 px-4">
                Nothing yet — matches and invites land here.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClickNotification(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-raised transition-colors focus-visible:ring-2 ring-line-focus ${
                        n.read_at === null ? "bg-surface-raised/50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="type-meta font-medium text-foreground truncate">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-muted-strong mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted whitespace-nowrap">{formatTime(n.created_at)}</span>
                        {n.read_at === null && (
                          <span className="w-2 h-2 rounded-full bg-danger shrink-0 mt-1" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 flex-col ios-frosted border-r border-[var(--ios-hairline)] z-40 overflow-y-auto scrollbar-none">
        {/* Wordmark */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-accent-candle text-lg" aria-hidden="true">&#x2665;</span>
          <span className="type-eyebrow text-accent-candle">SweetScene</span>
        </div>

        {/* Primary CTA — Matchmake */}
        <div className="px-4 pb-3">
          <Link
            href="/matchmake"
            prefetch={false}
            data-cursor="primary"
            aria-current={isActive("/matchmake") ? "page" : undefined}
            className="ios-press flex items-center justify-center gap-2 w-full rounded-full text-accent-foreground font-semibold text-base transition-all hover:opacity-90 focus-visible:ring-2 ring-line-focus"
            style={{ height: "52px", background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" />
            </svg>
            Matchmake
          </Link>
        </div>

        {/* Main nav group */}
        <div className="px-4 pb-4 flex-1">
          <div className="ios-card overflow-hidden mb-3">
            {MAIN_GROUP.map((item) => (
              <SidebarRow key={item.label} item={item} active={isActive(item.href)} onNavigate={() => closeMenus(null)} />
            ))}
          </div>

          {/* More — expanding panel */}
          <div ref={morePanelRef} className="ios-card overflow-hidden mb-3">
            <button
              ref={moreBtnRef}
              onClick={() => { setMoreOpen(!moreOpen); setNotifOpen(false); }}
              aria-expanded={moreOpen}
              aria-controls="more-menu"
              className={`ios-press flex items-center gap-3 px-3 w-full transition-all focus-visible:ring-2 ring-line-focus ${
                moreActive && !moreOpen ? "bg-accent-candle/10" : "hover:bg-surface-raised/60"
              }`}
              style={{ minHeight: "50px" }}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-[8px] flex-shrink-0 bg-surface-raised/60">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-strong" aria-hidden="true">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </div>
              <span className={`type-body flex-1 text-left ${moreActive ? "text-foreground font-medium" : "text-muted-strong"}`}>More</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className="text-muted-faint flex-shrink-0 transition-transform"
                style={{ transform: moreOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            {moreOpen && (
              <div id="more-menu">
                {MORE_GROUP.map((item) => (
                  <SidebarRow key={item.label} item={item} active={isActive(item.href)} onNavigate={() => closeMenus(null)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Profile + Log out + info */}
        <div className="px-4 pb-4 border-t border-[var(--ios-hairline)] pt-3">
          <Link
            href="/profile"
            prefetch={false}
            aria-current={isActive("/profile") ? "page" : undefined}
            onClick={() => closeMenus(null)}
            className="ios-press flex items-center gap-3 ios-row px-3 mb-3 hover:bg-surface-raised/60 focus-visible:ring-2 ring-line-focus"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-candle to-accent-rose flex items-center justify-center text-foreground flex-shrink-0" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <span className="type-body text-foreground flex-1">Profile</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-faint" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>

          {user && (
            <button
              onClick={handleLogout}
              data-cursor="destructive"
              className="ios-press flex items-center gap-3 w-full text-left px-3 mb-3 rounded-[10px] hover:bg-danger/10 transition-all focus-visible:ring-2 ring-line-focus"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-danger/15 flex-shrink-0" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </div>
              <span className="type-body text-danger flex-1">Log Out</span>
            </button>
          )}

          <div className="px-3 pt-2 pb-1">
            <p className="type-meta text-muted-faint leading-relaxed">
              SweetScene &copy; 2026<br />
              Anonymous AI Matchmaking<br />
              <span className="type-eyebrow text-muted-faint">16+ platform to join</span>
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar — safe-area aware */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 ios-frosted border-t border-[var(--ios-hairline)] flex items-center justify-around"
        style={{ height: "calc(52px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_TABS.map((tab) => (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            prefetch={false}
            aria-current={isActive(tab.href) ? "page" : undefined}
            onClick={() => closeMenus(null)}
            className={`ios-press flex flex-col items-center justify-center gap-0.5 flex-1 h-[52px] transition-colors focus-visible:ring-2 ring-line-focus rounded-lg ${
              isActive(tab.href) ? "text-accent-candle" : "text-muted-strong"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export default SiteNav;
