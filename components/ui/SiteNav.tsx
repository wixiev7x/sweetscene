"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { signOut } from "@/lib/actions/auth";
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
  { href: "/matchmake", label: "Matchmake", icon: "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z" },
  { href: "/lobby", label: "Chats", icon: "M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" },
  { href: "/characters/my", label: "My characters", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Explore", icon: NAV[0].icon },
  { href: "/lobby", label: "Chats", icon: NAV[2].icon },
  { href: "/matchmake", label: "Match", icon: NAV[1].icon },
  { href: "/create-character", label: "Create", icon: "M12 5v14M5 12h14" },
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

function SidebarRow({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex h-11 items-center gap-3 rounded-full px-4 text-[15px] transition-colors focus-visible:ring-2 ring-line-focus ${
        active ? "bg-surface-raised text-foreground" : "text-muted-strong hover:bg-surface hover:text-foreground"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-brand-light" : ""} aria-hidden="true">
        <path d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );
}

function CreateMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-12 w-full items-center gap-3 rounded-full bg-brand px-5 text-[15px] text-white transition-transform active:scale-[0.98]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="ml-auto opacity-80" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-[calc(100%-12px)] top-0 z-50 w-64 pl-4">
          <div className="rounded-3xl border border-line-strong bg-surface p-2 shadow-2xl" style={{ animation: "iosDropdown .18s var(--ios-ease) both" }}>
            <Link
              href="/create-character"
              role="menuitem"
              prefetch={false}
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-raised"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised text-brand-light">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
              </span>
              <span>
                <span className="block text-[15px] text-foreground">Character</span>
                <span className="block text-xs text-muted">Bring someone to life</span>
              </span>
            </Link>
            <div role="menuitem" aria-disabled="true" className="flex items-center gap-3 rounded-2xl p-3 opacity-60">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised text-brand-light">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></svg>
              </span>
              <span>
                <span className="block text-[15px] text-foreground">Group <span className="ml-1 rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-muted">Soon</span></span>
                <span className="block text-xs text-muted">Several characters, one scene</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
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
        className={`sticky top-0 z-40 bg-background/80 backdrop-blur-xl md:pl-60 ${className}`}
        style={{ height: "64px" }}
      >
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="SweetScene home" className="md:invisible">
            <span className="font-display text-[22px] text-foreground">sweet<span className="text-brand">scene</span></span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/store"
              prefetch={false}
              aria-label={`Token balance: ${tokens ?? 0}, get more`}
              className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-[15px] text-foreground transition-colors hover:bg-surface-raised"
            >
              <CoinIcon className="h-5 w-5" />
              <span className="tabular-nums">{(tokens ?? 0).toLocaleString("en-US")}</span>
            </Link>

            <Link
              href="/store"
              prefetch={false}
              className="hidden h-10 items-center gap-2 rounded-full bg-brand px-5 text-[15px] text-white transition-transform active:scale-[0.98] sm:flex"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 .8-3.4 2-4.5.2 1.6 1 2.6 2 3 0-3 .3-5.6 1-8.5z" /></svg>
              Upgrade
            </Link>

            {!hasSession && (
              <Link
                href="/login"
                prefetch={false}
                className="flex h-10 items-center rounded-full border border-line-strong px-5 text-[15px] text-foreground transition-colors hover:bg-surface"
              >
                Sign in
              </Link>
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

      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-60 flex-col border-r border-line bg-background md:flex">
        <Link href="/" prefetch={false} aria-label="SweetScene home" className="flex h-16 items-center px-6">
          <span className="font-display text-[24px] text-foreground">sweet<span className="text-brand">scene</span></span>
        </Link>

        <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-2 scrollbar-none">
          <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.14em] text-muted">App</p>
          <CreateMenu onNavigate={() => closeMenus(null)} />

          <nav aria-label="Main" className="mt-2 space-y-1">
            {NAV.map((item) => (
              <SidebarRow key={item.href} item={item} active={isActive(item.href)} onNavigate={() => closeMenus(null)} />
            ))}
          </nav>

          <div className="my-5 h-px bg-line" />
          <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.14em] text-muted">Plans</p>
          <Link
            href="/store"
            prefetch={false}
            className="group flex items-center gap-3 rounded-3xl bg-gradient-to-br from-brand/25 via-surface to-surface px-4 py-3.5 ring-1 ring-brand/30 transition-colors hover:ring-brand/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 text-brand-light">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 .8-3.4 2-4.5.2 1.6 1 2.6 2 3 0-3 .3-5.6 1-8.5z" /></svg>
            </span>
            <span className="flex-1">
              <span className="block text-[15px] text-foreground">Go Flame</span>
              <span className="block text-xs text-muted">Longer, hotter scenes</span>
            </span>
          </Link>

          <div className="my-5 h-px bg-line" />
          <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.14em] text-muted">Other</p>
          <SidebarRow item={{ href: "/how", label: "Help", icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01" }} active={isActive("/how")} onNavigate={() => closeMenus(null)} />
          <SidebarRow item={{ href: "/safety", label: "Safety", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }} active={isActive("/safety")} onNavigate={() => closeMenus(null)} />
        </div>

        <div className="space-y-1 border-t border-line p-4">
          <div className="flex h-11 items-center gap-3 rounded-full px-4 text-[15px] text-muted-strong">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /></svg>
            <span className="flex-1">English</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={hasSession ? "/profile" : "/login"}
              prefetch={false}
              aria-current={isActive("/profile") ? "page" : undefined}
              className="flex h-12 flex-1 items-center gap-3 rounded-full px-2 transition-colors hover:bg-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent-candle text-white" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
              </span>
              <span className="text-[15px] text-foreground">{hasSession ? "Profile" : "Sign in"}</span>
            </Link>
            {user && (
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              </button>
            )}
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
