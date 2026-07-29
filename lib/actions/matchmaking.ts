"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { assertNotBanned } from "@/lib/utils/ban";
import { notifyMatchFound } from "@/lib/notifications/dispatch";
import { VALID_SCENARIO_TAG_SET, FREE_TIER_DAILY_MATCH_CAP, poolForTier } from "@/lib/config/constants";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Phase 5a — Matchmaking with atomic token deduction.
 *
 * Token accounting is now atomic via the deduct_tokens SECURITY
 * DEFINER RPC, closing the TOCTOU double-spend (H5). Profile reads
 * go through get_own_profile (B6) since tokens_balance/is_vip are
 * REVOKED from authenticated. VIP is re-checked server-side (C4).
 * Scenario tags are validated against an allowlist before PostgREST
 * interpolation (M3).
 * ════════════════════════════════════════════════════════════════════ */

type FindMatchResult =
  | { matchId: string; waiting?: boolean }
  | { error: string };

type CreateAIMatchResult =
  | { matchId: string; isAiMatch: true }
  | { error: string };

/**
 * Validates that every tag in `tags` is in the allowlist. Returns the
 * filtered list, or null if any tag is invalid. (M3)
 */
function validateTags(tags: string[]): string[] | null {
  const filtered = tags.filter((t) => typeof t === "string" && t.length > 0);
  for (const t of filtered) {
    if (!VALID_SCENARIO_TAG_SET.has(t)) return null;
  }
  return filtered;
}

/**
 * Reads the caller's profile via the get_own_profile SECURITY DEFINER
 * RPC. The columns tokens_balance and is_vip are REVOKED from
 * authenticated, so a direct client SELECT returns NULL for them.
 * This RPC returns the full row for the owner only.
 */
async function readOwnProfile(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{
  tokens_balance: number;
  is_vip: boolean;
  age_cohort: string | null;
} | null> {
  const { data } = await supabase.rpc("get_own_profile");
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as {
    tokens_balance: number;
    is_vip: boolean;
    age_cohort: string | null;
  };
  return row;
}

/**
 * The cohort whose queue this user belongs in.
 *
 * An unrecorded age resolves to 'minor', matching the database trigger
 * and `claim_match`. Guessing wrong that way costs a match; guessing
 * the other way puts an adult in a scene with a child.
 */
function cohortOf(profile: { age_cohort: string | null }): "minor" | "adult" {
  return profile.age_cohort === "adult" ? "adult" : "minor";
}

/**
 * Counts how many matches the given user has created or joined today
 * (UTC midnight to now). Used by the free-tier daily match cap.
 */
async function countTodayMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .gte("created_at", todayStart.toISOString());

  return count ?? 0;
}

/**
 * Picks 1-3 public character IDs whose scenario tags overlap with the
 * requested `tags`. Falls back to 2 random public characters when
 * nothing matches. Returns an empty array when no public characters
 * exist at all (the match will have no AI director — acceptable for
 * a fresh install before users create characters).
 */
async function pickCharacterIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tags: string[]
): Promise<string[]> {
  const tagLiteral = `{${tags.join(",")}}`;

  const { data: matching } = await supabase
    .from("characters")
    .select("id")
    .eq("visibility", "public")
    .filter("scenario_tags", "ov", tagLiteral)
    .limit(3);

  if (matching && matching.length > 0) {
    return matching.map((c) => c.id as string);
  }

  const { data: random } = await supabase
    .from("characters")
    .select("id")
    .eq("visibility", "public")
    .limit(2);

  return (random ?? []).map((c) => c.id as string);
}

/**
 * Searches for an existing match waiting for a partner with the same
 * tier and overlapping scenario tags. If none found, creates a new
 * match and waits for another player to join.
 *
 * Token accounting: tokens are deducted atomically via the
 * deduct_tokens RPC — no read-check-write race window. If the match
 * INSERT fails after deduction, the tokens are refunded via the
 * add_tokens RPC. On claim, if deduct_tokens returns NULL (insufficient
 * funds caused by a concurrent deduction), the match is un-claimed
 * via unclaim_match so another user can try.
 *
 * VIP enforcement: the `deep` tier requires is_vip, re-checked
 * server-side (C4) so a user can't call the action directly with
 * tier='deep' to bypass the client gate.
 */
export async function findMatch(
  tier: "quick" | "deep",
  tags: string[]
): Promise<FindMatchResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const banCheck = await assertNotBanned(supabase);
  if ("error" in banCheck) return banCheck;

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  /* M3: validate tags before PostgREST interpolation. */
  const validTags = validateTags(tags);
  if (!validTags || validTags.length === 0) {
    return { error: "Invalid scenario tags" };
  }

  /* B6: read profile via RPC (tokens_balance REVOKED from authenticated). */
  const profile = await readOwnProfile(supabase);
  if (!profile) return { error: "Profile not found" };

  const sharedPool = poolForTier(tier);

  /* C4: re-check VIP for deep tier server-side. */
  if (tier === "deep" && !profile.is_vip) {
    return { error: "Deep Dive is VIP only" };
  }

  /* Phase 8.7: free-tier daily match cap. Non-VIP users are limited to
     FREE_TIER_DAILY_MATCH_CAP matches per day (UTC). */
  if (!profile.is_vip) {
    const todayCount = await countTodayMatches(supabase, user.id);
    if (todayCount >= FREE_TIER_DAILY_MATCH_CAP) {
      return { error: "Daily match limit reached. Upgrade to VIP for unlimited matches." };
    }
  }

  if (profile.tokens_balance < sharedPool) {
    return { error: "Not enough tokens" };
  }

  const tagLiteral = `{${validTags.join(",")}}`;
  const characterIds = await pickCharacterIds(supabase, validTags);

  const { data: existingMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "active")
    .is("user_b", null)
    .eq("is_ai_match", false)
    .eq("tier", tier)
    /* Only ever pair within an age cohort. This filter is the fast
       path — it keeps the client from proposing a match it cannot
       claim — but claim_match re-checks it against the caller's own
       profile, because a client can call that RPC with any match id
       it can name. */
    .eq("cohort", cohortOf(profile))
    .filter("scenario_tags", "ov", tagLiteral)
    .neq("user_a", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMatch) {
    /* Atomic, race-safe claim. The claim_match SECURITY DEFINER
       function only sets user_b if it is still NULL, user_a is not us,
       and the match is active. Two concurrent joiners can't both win. */
    const { data: claimed } = await supabase.rpc("claim_match", {
      p_match_id: existingMatch.id,
    });

    if (claimed && Array.isArray(claimed) && claimed.length > 0) {
      /* H5: atomic token deduction — no read-check-write race. */
      const { data: deductResult } = await supabase.rpc("deduct_tokens", {
        p_amount: sharedPool,
      });

      if (!deductResult || !Array.isArray(deductResult) || deductResult.length === 0) {
        /* Deduction failed (insufficient funds due to a concurrent race).
           Un-claim the match so another user can try. F3: unclaim_match
           is service_role-only — called via the admin client. */
        const admin = createAdminClient();
        await admin.rpc("unclaim_match", {
          p_match_id: existingMatch.id,
          p_caller_id: user.id,
        } as never);
        return { error: "Not enough tokens" };
      }

      /* Phase 11: notify the match creator (user_a) that their match
         was found. Best-effort — don't fail if the notification errors. */
      const { data: matchRow } = await supabase
        .from("matches")
        .select("user_a")
        .eq("id", existingMatch.id)
        .single();
      if (matchRow) {
        await notifyMatchFound(
          matchRow.user_a as string,
          existingMatch.id
        ).catch((err) =>
          logger.error("notify_failed", {
            kind: "match_found",
            matchId: existingMatch.id,
            err,
          })
        );
      }

      return { matchId: existingMatch.id };
    }

    /* Lost the race — fall through to create a new match. */
  }

  /* H5: deduct tokens atomically BEFORE creating the match. If the
     match INSERT fails, refund via add_tokens. */
  const { data: deductResult } = await supabase.rpc("deduct_tokens", {
    p_amount: sharedPool,
  });

  if (!deductResult || !Array.isArray(deductResult) || deductResult.length === 0) {
    return { error: "Not enough tokens" };
  }

  const { data: newMatch, error: insertError } = await supabase
    .from("matches")
    .insert({
      user_a: user.id,
      tier,
      scenario_tags: validTags,
      shared_pool: sharedPool,
      status: "active",
      character_ids: characterIds,
    })
    .select("id")
    .single();

  if (insertError || !newMatch) {
    /* Refund the deducted tokens. F2: add_tokens is service_role-only. */
    const admin = createAdminClient();
    await admin.rpc("add_tokens", {
      p_user_id: user.id,
      p_amount: sharedPool,
    } as never);
    return { error: "Failed to create match" };
  }

  await snapshotMatchCharacters(newMatch.id, characterIds);

  return { matchId: newMatch.id, waiting: true };
}

/**
 * Snapshots character prompts into match_characters_snapshot at match
 * creation (Phase 10.6). Best-effort — doesn't fail the match if the
 * snapshot RPC errors.
 */
async function snapshotMatchCharacters(matchId: string, characterIds: string[]) {
  try {
    const admin = createAdminClient();
    await admin.rpc("populate_match_snapshot", {
      p_match_id: matchId,
      p_character_ids: characterIds,
    } as never);
  } catch {
    /* Best-effort: the match exists without a snapshot. The AI wrapper
       falls back to reading the live character prompt. */
  }
}

/**
 * Creates an AI-only match with 1-3 AI characters whose scenario tags
 * overlap with the requested tags. If no matching characters exist,
 * picks 2 random characters from the defaults.
 *
 * Same atomic token deduction and server-side VIP re-check (C4) as
 * findMatch.
 */
export async function createAIMatch(
  tier: "quick" | "deep",
  tags: string[]
): Promise<CreateAIMatchResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const banCheck2 = await assertNotBanned(supabase);
  if ("error" in banCheck2) return banCheck2;

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  /* M3: validate tags. */
  const validTags = validateTags(tags);
  if (!validTags || validTags.length === 0) {
    return { error: "Invalid scenario tags" };
  }

  /* B6: read profile via RPC. */
  const profile = await readOwnProfile(supabase);
  if (!profile) return { error: "Profile not found" };

  const sharedPool = poolForTier(tier);

  /* C4: re-check VIP for deep tier server-side. */
  if (tier === "deep" && !profile.is_vip) {
    return { error: "Deep Dive is VIP only" };
  }

  /* Phase 8.7: free-tier daily match cap. */
  if (!profile.is_vip) {
    const todayCount = await countTodayMatches(supabase, user.id);
    if (todayCount >= FREE_TIER_DAILY_MATCH_CAP) {
      return { error: "Daily match limit reached. Upgrade to VIP for unlimited matches." };
    }
  }

  if (profile.tokens_balance < sharedPool) {
    return { error: "Not enough tokens" };
  }

  const characterIds = await pickCharacterIds(supabase, validTags);

  /* H5: atomic deduction. */
  const { data: deductResult } = await supabase.rpc("deduct_tokens", {
    p_amount: sharedPool,
  });

  if (!deductResult || !Array.isArray(deductResult) || deductResult.length === 0) {
    return { error: "Not enough tokens" };
  }

  const { data: newMatch, error: insertError } = await supabase
    .from("matches")
    .insert({
      user_a: user.id,
      is_ai_match: true,
      tier,
      scenario_tags: validTags,
      shared_pool: sharedPool,
      status: "active",
      character_ids: characterIds,
    })
    .select("id")
    .single();

  if (insertError || !newMatch) {
    /* Refund the deducted tokens. F2: add_tokens is service_role-only. */
    const admin = createAdminClient();
    await admin.rpc("add_tokens", {
      p_user_id: user.id,
      p_amount: sharedPool,
    } as never);
    return { error: "Failed to create AI match" };
  }

  await snapshotMatchCharacters(newMatch.id, characterIds);

  return { matchId: newMatch.id, isAiMatch: true };
}