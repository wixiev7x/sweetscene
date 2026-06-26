"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";

/* ════════════════════════════════════════════════════════════════════
 * Phase 6 — Vibe Check + reputation actions.
 *
 * After a match ends (or is revealed), both participants are asked to
 * rate the experience via the FadeToBlack Vibe Check overlay. The
 * submitMatchRating action wraps the submit_match_rating SECURITY
 * DEFINER RPC — it verifies the caller is a participant, the match is
 * ended/revealed, and no rating exists yet for this (match, rater).
 *
 * When both ratings exist, the RPC internally calls recompute_tier
 * (updates reputation_tier + earned_tags) and resolve_refund (credits
 * tokens to the wronged party based on AFK rules).
 * ════════════════════════════════════════════════════════════════════ */

export type Vibe = "electric" | "warm" | "neutral" | "cold";

export type RatingReason =
  | "partner_afk"
  | "boring"
  | "i_left"
  | "mutual_end"
  | "good_end";

type SubmitRatingParams = {
  vibe: Vibe;
  tags: string[];
  reason: RatingReason;
  wantsReveal: boolean;
};

type SubmitRatingResult = { success: true } | { error: string };

/**
 * Submits a Vibe Check rating for a match. Wraps the
 * submit_match_rating SECURITY DEFINER RPC. The RPC:
 *   1. Verifies the caller is a participant of the match.
 *   2. Verifies the match status is 'ended' or 'revealed'.
 *   3. Verifies no rating exists yet for this (match, rater).
 *   4. Inserts the rating.
 *   5. If both ratings exist, calls recompute_tier for both users +
 *      resolve_refund for the match.
 */
export async function submitMatchRating(
  matchId: string,
  params: SubmitRatingParams
): Promise<SubmitRatingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  /* Validate vibe. */
  const validVibes: Vibe[] = ["electric", "warm", "neutral", "cold"];
  if (!validVibes.includes(params.vibe)) {
    return { error: "Invalid vibe rating" };
  }

  /* Validate reason. */
  const validReasons: RatingReason[] = [
    "partner_afk",
    "boring",
    "i_left",
    "mutual_end",
    "good_end",
  ];
  if (!validReasons.includes(params.reason)) {
    return { error: "Invalid reason" };
  }

  /* Sanitize tags: max 3, each max 20 chars, alphanumeric + spaces. */
  const cleanTags = (params.tags ?? [])
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .slice(0, 3)
    .map((t) => t.trim().slice(0, 20));

  const { data, error } = await supabase.rpc("submit_match_rating", {
    p_match_id: matchId,
    p_vibe: params.vibe,
    p_tags: cleanTags,
    p_reason: params.reason,
    p_wants_reveal: params.wantsReveal,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Failed to submit rating" };
  }

  return { success: true };
}

type ReputationResult =
  | {
      tier: string;
      earnedTags: string[];
    }
  | { error: string };

/**
 * Returns the caller's current reputation tier and earned tags.
 * Reads via get_own_profile (the columns are REVOKED from authenticated
 * direct SELECT).
 */
export async function getMyReputation(): Promise<ReputationResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("get_own_profile");

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Profile not found" };
  }

  const row = data[0] as {
    reputation_tier: string;
    earned_tags: string[];
  };

  return {
    tier: row.reputation_tier,
    earnedTags: row.earned_tags ?? [],
  };
}