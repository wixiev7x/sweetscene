"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/utils/useMounted";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/actions/notifications";

/**
 * Bell icon with unread badge + dropdown notification list. Subscribes
 * to the `notifications` Realtime channel so new notifications appear
 * instantly without polling. Uses the browser Supabase client for
 * realtime (the table has RLS — the client only receives its own rows
 * via `postgres_changes` with the auth session).
 */
export default function NotificationBell() {
  const mounted = useMounted();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());

  /* Initial load + realtime subscription. */
  useEffect(() => {
    if (!mounted) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);

    /* Initial fetch — async so setState runs in microtask, not
       synchronously in the effect body. This body used to duplicate
       loadNotifications verbatim while still listing it as a dep, so the
       callback was dead code that the linter could not see. */
    let cancelled = false;
    (async () => {
      const result = await getNotifications(20);
      if (cancelled) return;
      if (!("error" in result)) {
        setNotifications(result.notifications);
        setUnreadCount(
          result.notifications.filter((n) => n.read_at === null).length
        );
      }
    })();

    /* Realtime: subscribe to INSERT events on the notifications table.
       Supabase RLS ensures only the owner's rows are broadcast. */
    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: NotificationRow }) => {
          const newRow = payload.new as NotificationRow;
          setNotifications((prev) => [newRow, ...prev].slice(0, 50));
          if (newRow.read_at === null) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload: { new: NotificationRow }) => {
          const updated = payload.new as NotificationRow;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
          if (updated.read_at !== null) {
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
  }, [mounted]);

  /* Close dropdown on outside click. */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /* Mark all as read when dropdown opens. */
  useEffect(() => {
    if (open && unreadCount > 0) {
      void markAllNotificationsRead().then(() => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.read_at === null
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(0);
      });
    }
  }, [open, unreadCount]);

  async function handleClickNotification(n: NotificationRow) {
    if (n.read_at === null) {
      await markNotificationAsRead(n.id);
    }
    if (n.match_id) {
      window.location.assign(`/chat/${n.match_id}`);
    }
    setOpen(false);
  }

  if (!mounted) return null;

  const formatTime = (iso: string): string => {
    const diff = now - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-surface-raised transition-colors"
        aria-label="Notifications"
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-foreground-dim"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-line-strong bg-surface shadow-2xl z-50"
        >
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-strong text-center">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-raised transition-colors ${
                      n.read_at === null ? "bg-surface-raised/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-muted-strong mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted whitespace-nowrap">
                        {formatTime(n.created_at)}
                      </span>
                      {n.read_at === null && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}