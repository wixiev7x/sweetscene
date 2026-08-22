"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";

/* ════════════════════════════════════════════════════════════════════
 * Phase 11 — Notification server actions.
 *
 * The notifications table rejects client INSERTs (REVOKE'd). The
 * create_notification SECURITY DEFINER RPC is available to
 * authenticated users but is REVOKE'd from anon+authenticated at the
 * SQL level — so only the admin (service-role) client can invoke it.
 * This means all notifications are created by server actions via the
 * admin client, never by the browser.
 *
 * Phase 12: everything that WRITES a notification moved to
 * lib/notifications/dispatch.ts. Those helpers were exported from this
 * file, and every export here is a client-callable endpoint — which
 * handed anyone on the internet the ability to post arbitrary text into
 * any user's notification feed. Only the caller's own read/mark
 * operations belong in this file; each one derives its target from the
 * session rather than from an argument.
 * ════════════════════════════════════════════════════════════════════ */

export type { NotificationType, NotificationRow } from "@/lib/notifications/dispatch";

import type { NotificationRow } from "@/lib/notifications/dispatch";

type ListResult = { notifications: NotificationRow[] } | { error: string };
type SimpleResult = { success: true } | { error: string };
type CountResult = { count: number } | { error: string };

/**
 * Returns the caller's notifications, newest first, capped at `limit`.
 */
export async function getNotifications(
  limit = 30
): Promise<ListResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, read_at, match_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(cappedLimit);

  if (error) return { error: "Failed to load notifications" };

  return { notifications: (data as NotificationRow[]) ?? [] };
}

/**
 * Marks a single notification as read via the mark_notification_read
 * RPC (verifies ownership server-side).
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<SimpleResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  if (error || !data) return { error: "Failed to mark notification" };

  return { success: true };
}

/**
 * Marks all unread notifications as read for the caller.
 */
export async function markAllNotificationsRead(): Promise<SimpleResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) return { error: "Failed to mark notifications" };

  return { success: true };
}

/**
 * Returns the caller's unread notification count.
 */
export async function getUnreadCount(): Promise<CountResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("get_unread_notification_count");

  if (error || data === null || data === undefined) {
    return { error: "Failed to get count" };
  }

  return { count: data as number };
}
