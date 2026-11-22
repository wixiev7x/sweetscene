"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { signOut } from "@/lib/actions/auth";
import { useAuthModal } from "@/components/auth/AuthModal";
import {
  markNotificationAsRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/actions/notifications";

/**
 * Phase 5.5 perf: the Supabase browser client (≈240 KB) is NOT imported
 * here anymore. NavSession (supabase + realtime) is mounted via
 * next/dynamic ONLY when a session cookie exists — anonymous page loads
 * never download it. ssr:false is allowed because this is a client
 * component; the shell renders instantly either way.
 */
const NavSession = dynamic(() => import("./NavSession"), { ssr: false });

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV: NavItem[] = [
  { href: "/", label: "Explore", icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z" },
  { href: "/lobby", label: "Chat", icon: "M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" },
  { href: "/characters/my", label: "My characters", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
  { href: "/community", label: "Community", icon: "M8 21h8M12 17v4M6 4h12v7a6 6 0 01-12 0zM18 6h2a2 2 0 01-2 4M6 6H4a2 2 0 002 4" },
  { href: "/scenarios", label: "Scenarios", icon: "M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2zM14 3v5h5M8 13h8M8 17h5" },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Explore", icon: NAV[0].icon },
  { href: "/lobby", label: "Chat", icon: NAV[1].icon },
  { href: "/matchmake", label: "Desire", icon: "" },
  { href: "/community", label: "Community", icon: NAV[3].icon },
  { href: "/profile", label: "Profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
];

function CoinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} inline-block shrink-0`} aria-hidden="true">
      <defs>
        <linearGradient id="ssCoin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F6DDA6" />
          <stop offset="100%" stopColor="#C9974E" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#ssCoin)" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#8A5F22" strokeOpacity=".35" strokeWidth="1" />
      <path d="M12 16.6s-3.6-2.3-4.7-4.2c-.8-1.5-.1-3.3 1.6-3.3 1 0 1.6.6 2.1 1.3.5-.7 1.1-1.3 2.1-1.3 1.7 0 2.4 1.8 1.6 3.3-1.1 1.9-4.7 4.2-4.7 4.2z" fill="#7A4E14" fillOpacity=".8" />
    </svg>
  );
}

function SidebarRow({ item, active, rail, onNavigate }: { item: NavItem; active: boolean; rail: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? item.label : undefined}
      title={rail ? item.label : undefined}
      onClick={onNavigate}
      className={`group relative flex h-12 items-center gap-4 text-[17px] transition-colors focus-visible:outline-none focus-visible:text-foreground ${
        rail ? "justify-center px-0" : "px-3"
      } ${active ? "text-foreground" : "text-muted-strong hover:text-foreground"}`}
    >
      {active && <span aria-hidden="true" className="absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform group-hover:scale-110 ${active ? "text-brand-light" : ""}`} aria-hidden="true">
        <path d={item.icon} />
      </svg>
      {!rail && item.label}
    </Link>
  );
}

const FLAME_PATH = "M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-5.4-3.4-8.7-.2.9-.9 2.6-2.3 3.2.3-3.1-1.4-6.2-4.2-7.7.4 3-1.7 5.3-2.8 7C5.4 10.3 5 11.7 5 13.3 5 18.4 8 22 12 22z";
const HEART_PATH = "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z";

export function SiteNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { openAuth } = useAuthModal();
  const [rail, setRail] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRail(localStorage.getItem("ss-nav") === "rail");
    } catch {}
  }, []);
  const toggleRail = () => {
    setRail((r) => {
      const next = !r;
      try {
        localStorage.setItem("ss-nav", next ? "rail" : "full");
      } catch {}
      document.documentElement.dataset.nav = next ? "rail" : "full";
      return next;
    });
  };
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

  /* ── Auth + token balance + realtime (lazy, only when signed in) ──
     The `sb-*-auth-token` cookie is JS-readable (httpOnly:false by
     design), so the shell can decide WITHOUT any library whether the
     supabase-carrying NavSession chunk should load at all. */
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(/(?:^|;\s*)sb-[a-z0-9]+-auth-token=/.test(document.cookie));
  }, []);

  /* Keep relative timestamps fresh while the dropdown is usable. */
  useEffect(() => {
    if (!user) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [user]);

  const handleUser = useCallback((u: { id: string } | null) => setUser(u), []);
  const handleTokens = useCallback((t: number) => setTokens(t), []);

  const handleInitialNotifications = useCallback((rows: NotificationRow[]) => {
    setNotifications(rows);
    setUnreadCount(rows.filter((n) => n.read_at === null).length);
  }, []);

  const handleNotificationInsert = useCallback((row: NotificationRow) => {
    setNotifications((prev) => [row, ...prev].slice(0, 50));
    if (row.read_at === null) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const handleNotificationUpdate = useCallback((row: NotificationRow) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === row.id ? row : n))
    );
    if (row.read_at !== null) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

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


  return (
    <>
      {/* Headless session data, the only place supabase-js enters the
          nav; downloaded solely when a session cookie exists. */}
      {hasSession && (
        <NavSession
          onUser={handleUser}
          onTokens={handleTokens}
          onInitialNotifications={handleInitialNotifications}
          onNotificationInsert={handleNotificationInsert}
          onNotificationUpdate={handleNotificationUpdate}
        />
      )}

      {/* Top bar, sits right of the sidebar on desktop */}
      <header
        className={`sticky top-0 z-40 bg-background/80 backdrop-blur-xl md:pl-[var(--nav-w)] transition-[padding] duration-300 ${className}`}
        style={{ height: "64px" }}
      >
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="SweetScene home" className="md:invisible">
            <span className="font-display text-[22px] text-foreground">sweet<span className="text-brand">scene</span></span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {hasSession && (
              <Link
                href="/store"
                prefetch={false}
                aria-label={`Token balance: ${tokens ?? 0}, get more`}
                className="flex h-11 items-center gap-2.5 rounded-full bg-surface px-5 text-base text-foreground transition-colors hover:bg-surface-raised"
              >
                <CoinIcon className="h-6 w-6" />
                <span className="tabular-nums">{(tokens ?? 0).toLocaleString("en-US")}</span>
              </Link>
            )}

            {!hasSession && (
              <>
                <button type="button" onClick={() => openAuth("login")} className="h-11 px-4 text-base text-foreground-dim transition-colors hover:text-foreground">
                  Sign in
                </button>
                <button type="button" onClick={() => openAuth("signup")} className="h-11 rounded-full bg-brand px-6 text-base text-white transition-transform active:scale-[0.98]">
                  Join free
                </button>
              </>
            )}

            {hasSession && (
            <button
              ref={bellBtnRef}
              onClick={() => { setNotifOpen(!notifOpen); setMoreOpen(false); }}
              aria-expanded={notifOpen}
              aria-haspopup="dialog"
              aria-label={displayUnread > 0 ? `Notifications, ${displayUnread} unread` : "Notifications"}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground transition-colors hover:bg-surface-raised"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {displayUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] text-white" aria-hidden="true">
                  {displayUnread > 9 ? "9+" : displayUnread}
                </span>
              )}
            </button>
            )}
          </div>
        </div>

        {/* Notifications dropdown */}
        {notifOpen && (
          <div
            ref={notifPanelRef}
            role="dialog"
            aria-label="Notifications"
            className="ios-dropdown absolute right-4 top-16 w-80 max-h-96 overflow-y-auto rounded-3xl bg-surface border border-line-strong shadow-2xl z-50"
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
                Nothing yet, matches and invites land here.
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

      {/* Desktop sidebar, collapsible to an icon rail */}
      <aside
        className="fixed bottom-0 left-0 top-0 z-50 hidden flex-col border-r border-line bg-background transition-[width] duration-300 ease-out md:flex"
        style={{ width: "var(--nav-w)" }}
      >
        <div className={`flex h-16 shrink-0 items-center ${rail ? "justify-center" : "justify-between pl-6 pr-3"}`}>
          {!rail && (
            <Link href="/" prefetch={false} aria-label="SweetScene home">
              <span className="font-display text-[24px] text-foreground">sweet<span className="text-brand">scene</span></span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleRail}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[.06] hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="4" />
              <path d="M9 4v16" />
            </svg>
          </button>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto pb-3 pt-2 scrollbar-none ${rail ? "px-3" : "px-4"}`}>
          <Link
            href="/matchmake"
            prefetch={false}
            onClick={() => closeMenus(null)}
            aria-label="Desire"
            title={rail ? "Desire" : undefined}
            className={`group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-full text-lg text-white shadow-[0_10px_40px_-12px_var(--brand)] transition-transform active:scale-[0.97] ${
              rail ? "mx-auto h-12 w-12 justify-center" : "h-14 px-6"
            }`}
            style={{ background: "linear-gradient(120deg, #B5163F, #E1245C 55%, #FF5C87)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ animation: "ssBeat 1.6s ease-in-out infinite" }}>
              <path d={HEART_PATH} />
            </svg>
            {!rail && "Desire"}
          </Link>

          <nav aria-label="Main" className="mt-5 space-y-1">
            {NAV.map((item) => (
              <SidebarRow key={item.href} item={item} rail={rail} active={isActive(item.href)} onNavigate={() => closeMenus(null)} />
            ))}
          </nav>

          {/* Bottom block: language, profile, ember (pinned last) */}
          <div className="mt-auto space-y-1 pt-6">
            <button
              type="button"
              title={rail ? "Language" : undefined}
              aria-label="Language"
              className={`flex h-12 w-full items-center gap-4 text-[16px] text-muted-strong transition-colors hover:text-foreground ${rail ? "justify-center" : "px-3"}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="shrink-0"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /></svg>
              {!rail && <span className="flex-1 text-left">English</span>}
            </button>

            <div className={`flex items-center ${rail ? "justify-center" : "gap-1"}`}>
              <Link
                href={hasSession ? "/profile" : "#"}
                onClick={(e) => { if (!hasSession) { e.preventDefault(); openAuth("signup"); } }}
                prefetch={false}
                title={rail ? (hasSession ? "Profile" : "Sign in") : undefined}
                aria-current={isActive("/profile") ? "page" : undefined}
                className={`flex h-12 items-center gap-3 transition-colors hover:text-foreground ${rail ? "" : "flex-1 px-2"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent-candle text-white" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
                </span>
                {!rail && <span className="text-[16px] text-foreground">{hasSession ? "Profile" : "Sign in"}</span>}
              </Link>
              {user && !rail && (
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[.06] hover:text-foreground"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                </button>
              )}
            </div>

            <Link
              href="/store"
              prefetch={false}
              title={rail ? "Turn up the heat" : undefined}
              aria-label="Turn up the heat"
              className={`group relative mt-2 block overflow-hidden ${rail ? "mx-auto h-12 w-12 rounded-full" : "rounded-[1.75rem] p-4"}`}
              style={{ background: "radial-gradient(120% 120% at 0% 100%, rgba(225,36,92,.6), rgba(60,8,24,.65) 45%, #0c0c0e 85%)" }}
            >
              <span aria-hidden="true" className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-brand/40 opacity-60 blur-2xl transition-opacity group-hover:opacity-100" />
              <svg width={rail ? 22 : 26} height={rail ? 22 : 26} viewBox="0 0 24 24" aria-hidden="true" className={`relative ${rail ? "absolute inset-0 m-auto" : ""}`}>
                <defs>
                  <radialGradient id="emberGlow" cx="50%" cy="70%" r="60%">
                    <stop offset="0%" stopColor="#FFD3A0" />
                    <stop offset="55%" stopColor="#FF5C87" />
                    <stop offset="100%" stopColor="#B5163F" />
                  </radialGradient>
                </defs>
                <path d={FLAME_PATH} fill="url(#emberGlow)" />
              </svg>
              {!rail && (
                <>
                  <span className="relative mt-3 block text-[17px] text-foreground">Turn up the heat</span>
                  <span className="relative mt-0.5 block text-xs text-foreground-dim/80">Longer nights, deeper scenes</span>
                </>
              )}
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar, safe-area aware */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-line flex items-center justify-around"
        style={{ height: "calc(52px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_TABS.map((tab) =>
          tab.href === "/matchmake" ? (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              aria-current={isActive(tab.href) ? "page" : undefined}
              onClick={() => closeMenus(null)}
              className="ios-press relative flex flex-col items-center justify-end flex-1 h-[52px] focus-visible:outline-none group"
            >
              <span
                aria-hidden="true"
                className={`absolute -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-light via-brand to-accent-rose text-white shadow-[0_8px_24px_-6px_var(--brand)] ring-4 ring-background transition-transform duration-300 group-active:scale-95 ${
                  isActive(tab.href) ? "scale-105" : ""
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z" />
                </svg>
              </span>
              <span className={`mb-1 text-[10px] font-semibold ${isActive(tab.href) ? "text-brand-light" : "text-foreground-dim"}`}>
                {tab.label}
              </span>
            </Link>
          ) : (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            prefetch={false}
            aria-current={isActive(tab.href) ? "page" : undefined}
            onClick={() => closeMenus(null)}
            className={`ios-press flex flex-col items-center justify-center gap-0.5 flex-1 h-[52px] transition-colors focus-visible:ring-2 ring-line-focus rounded-lg ${
              isActive(tab.href) ? "text-brand-light" : "text-muted-strong"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
          )
        )}
      </nav>
    </>
  );
}

export default SiteNav;
