"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";

type HeartbeatResult = { success: true } | { error: string };

/**
 * Updates matches.last_activity to now() for the calling participant.
 * Called by the chat page's client-side setInterval every 30s while
 * the tab is visible. The AFK-kick cron ends matches where
 * now() - last_activity > 90s, so heartbeats keep the match alive.
 *
 * Rate-limited to 1 per 15s (the client fires every 30s, but this
 * prevents accidental double-fires on tab refocus).
 */
export async function heartbeat(matchId: string): Promise<HeartbeatResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  const { error } = await supabase
    .from("matches")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", matchId)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .eq("status", "active");

  if (error) return { error: "Heartbeat failed" };

  return { success: true };
}
