"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";

/* ════════════════════════════════════════════════════════════════════
 * Phase 6 — Match control actions.
 *
 * unmatch: ends an active match mid-scene. The caller's match row
 * flips to status='ended' via the end_match RPC (service_role-only),
 * which also inserts a preliminary rating with reason
 * 'instant_disconnect'. Realtime broadcasts the status change so the
 * partner's chat page shows FadeToBlack.
 *
 * The partner can then submit their own Vibe Check rating. When both
 * ratings exist, submit_match_rating internally calls resolve_refund.
 * ════════════════════════════════════════════════════════════════════ */

type UnmatchResult = { success: true } | { error: string };

/**
 * Ends an active match immediately. Called by the "Leave scene"
 * button (wired in Phase 9). No confirmation needed — per the spec,
 * the user leaves instantly and the partner sees the scene end via
 * Realtime. The end_match RPC:
 *   1. Verifies the caller is a participant.
 *   2. Verifies the match is active.
 *   3. Sets status='ended', ended_at=now().
 *   4. Inserts a preliminary rating (reason='instant_disconnect').
 */
export async function unmatch(
  matchId: string,
  reason: string = "instant_disconnect"
): Promise<UnmatchResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  /* Verify the caller is a participant before calling the RPC. */
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .single();

  if (!match) return { error: "Match not found" };

  /* end_match is service_role-only — called via the admin client. */
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("end_match", {
    p_match_id: matchId,
    p_reason: reason,
    p_caller_id: user.id,
  } as never);

  if (error || !data || !Array.isArray(data) || (data as unknown[]).length === 0) {
    return { error: "Failed to end match" };
  }

  return { success: true };
}