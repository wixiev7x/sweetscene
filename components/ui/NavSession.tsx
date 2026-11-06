"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
} from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/actions/notifications";

/**
 * NavSession — headless companion to SiteNav.
 *
 * Phase 5.5 perf: `@supabase/supabase-js` (browser bundle ≈ 240 KB with its
 * buffer polyfill + realtime client) used to be a top-level import of
 * SiteNav, which sits in the root layout — so EVERY route (including
 * logged-out visits to /privacy, /terms, …) downloaded it before any
 * content. It now lives ONLY in this module, which SiteNav mounts through
 * `next/dynamic` **iff a session cookie exists** (`sb-*-auth-token` is
 * JS-readable — the server client sets httpOnly:false deliberately).
 *
 * Anonymous first loads — the majority of traffic on marketing/legal
 * pages — no longer ship the Supabase client at all. Signed-in users
 * fetch this chunk right after hydration, in parallel with the first
 * data call, so the UX is unchanged.
 *
 * Renders nothing. All state flows up to SiteNav via callbacks, keeping
 * the previous behavior byte-for-byte: auth + token balance, initial
 * notification load, and the realtime INSERT/UPDATE channel.
 */
export default function NavSession({
  onUser,
  onTokens,
  onInitialNotifications,
  onNotificationInsert,
  onNotificationUpdate,
}: {
  onUser: (user: { id: string } | null) => void;
  onTokens: (tokens: number) => void;
  onInitialNotifications: (rows: NotificationRow[]) => void;
  onNotificationInsert: (row: NotificationRow) => void;
  onNotificationUpdate: (row: NotificationRow) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        onUser(user ? { id: user.id } : null);
        if (user) {
          /* tokens_balance is column-REVOKE'd from direct reads — the
             owner value comes from the get_own_profile RPC. */
          const { data: own } = await supabase.rpc("get_own_profile");
          const rows = (Array.isArray(own) ? own : [own]) as Array<{
            tokens_balance?: number | null;
          } | null>;
          const balance = rows?.[0]?.tokens_balance;
          if (!cancelled && balance != null) onTokens(balance);

          const result = await getNotifications(20);
          if (cancelled) return;
          if (!("error" in result)) {
            onInitialNotifications(result.notifications);
          }
        }
      } catch {
        /* Session invalid or network error — the nav simply stays in
           its signed-out presentation, exactly like before. */
        if (!cancelled) onUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Realtime notification channel (signed-in only) ── */
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("site-nav-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: NotificationRow }) => {
          onNotificationInsert(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload: { new: NotificationRow }) => {
          onNotificationUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
