"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";

type FindMatchResult =
  | { matchId: string; waiting?: boolean }
  | { error: string };

type CreateAIMatchResult =
  | { matchId: string; isAiMatch: true }
  | { error: string };

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
 * Token accounting: each participant contributes `sharedPool` tokens
 * into the shared pool. user_a funds their half on creation; user_b
 * tops the pool up by `sharedPool` on join. The final pool is
 * therefore `2 * sharedPool` for a fully joined human match.
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

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  const sharedPool = tier === "quick" ? 2000 : 10000;
  const characterIds = await pickCharacterIds(supabase, tags);

  const { data: profile } = await supabase
    .from("profiles")
    .select("tokens_balance")
    .eq("id", user.id)
    .single();

  if (!profile || profile.tokens_balance < sharedPool) {
    return { error: "Not enough tokens" };
  }

  const tagLiteral = `{${tags.join(",")}}`;

  const { data: existingMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "active")
    .is("user_b", null)
    .eq("is_ai_match", false)
    .eq("tier", tier)
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
      /* Token deduction for user_b on successful join. */
      await supabase
        .from("profiles")
        .update({ tokens_balance: profile.tokens_balance - sharedPool })
        .eq("id", user.id);

      return { matchId: existingMatch.id };
    }

    /* Lost the race — fall through to create a new match. */
  }

  const { data: newMatch, error: insertError } = await supabase
    .from("matches")
    .insert({
      user_a: user.id,
      tier,
      scenario_tags: tags,
      shared_pool: sharedPool,
      status: "active",
      character_ids: characterIds,
    })
    .select("id")
    .single();

  if (insertError || !newMatch) {
    return { error: "Failed to create match" };
  }

  await supabase
    .from("profiles")
    .update({ tokens_balance: profile.tokens_balance - sharedPool })
    .eq("id", user.id);

  return { matchId: newMatch.id, waiting: true };
}

/**
 * Creates an AI-only match with 1-3 AI characters whose scenario tags
 * overlap with the requested tags. If no matching characters exist,
 * picks 2 random characters from the defaults.
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

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  const sharedPool = tier === "quick" ? 2000 : 10000;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tokens_balance")
    .eq("id", user.id)
    .single();

  if (!profile || profile.tokens_balance < sharedPool) {
    return { error: "Not enough tokens" };
  }

  const characterIds = await pickCharacterIds(supabase, tags);

  await supabase
    .from("profiles")
    .update({ tokens_balance: profile.tokens_balance - sharedPool })
    .eq("id", user.id);

  const { data: newMatch, error: insertError } = await supabase
    .from("matches")
    .insert({
      user_a: user.id,
      is_ai_match: true,
      tier,
      scenario_tags: tags,
      shared_pool: sharedPool,
      status: "active",
      character_ids: characterIds,
    })
    .select("id")
    .single();

  if (insertError || !newMatch) {
    return { error: "Failed to create AI match" };
  }

  return { matchId: newMatch.id, isAiMatch: true };
}