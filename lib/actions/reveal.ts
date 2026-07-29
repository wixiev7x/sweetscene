"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { assertNotBanned } from "@/lib/utils/ban";
import { notifyRevealRequest, notifyRevealComplete } from "@/lib/notifications/dispatch";
import { logger } from "@/lib/utils/logger";

type RevealResult =
  | {
      ownRevealed: boolean;
      partnerRevealed: boolean;
      partnerMovedOn: boolean;
      status: string;
    }
  | { error: string };

/**
 * Records that the caller has chosen to reveal their identity in the
 * FadeToBlack overlay. Returns the up-to-date reveal state for both
 * participants so the UI can react to the partner's choice. When both
 * users have revealed, the match's status flips to `revealed`.
 */
export async function requestReveal(
  matchId: string
): Promise<RevealResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const banCheck = await assertNotBanned(supabase);
  if ("error" in banCheck) return banCheck;

  const { data, error } = await supabase.rpc("reveal_self", {
    p_match_id: matchId,
  });

  if (error || !data || data.length === 0) {
    return { error: "Could not request reveal" };
  }

  const row = data[0];
  const ownRevealed = row.own_revealed as boolean;
  const partnerRevealed = row.partner_revealed as boolean;
  const partnerMovedOn = row.partner_moved_on as boolean;
  const status = row.status as string;

  /* Phase 11: fire notifications best-effort. */
  if (ownRevealed && !partnerRevealed && !partnerMovedOn && status === "active") {
    /* The caller just revealed — notify the partner of the request. */
    const admin = createAdminClient();
    const { data: matchRow } = await admin
      .from("matches")
      .select("user_a, user_b")
      .eq("id", matchId)
      .single();
    if (matchRow) {
      const partnerId =
        (matchRow as { user_a: string; user_b: string | null }).user_a === user.id
          ? (matchRow as { user_b: string | null }).user_b
          : (matchRow as { user_a: string }).user_a;
      if (partnerId) {
        await notifyRevealRequest(partnerId, matchId, "Your partner").catch(
          (err) =>
            logger.error("notify_failed", {
              kind: "reveal_request",
              matchId,
              err,
            })
        );
      }
    }
  }

  if (status === "revealed") {
    /* Both participants revealed — notify each of them. */
    const admin = createAdminClient();
    const { data: matchRow } = await admin
      .from("matches")
      .select("user_a, user_b")
      .eq("id", matchId)
      .single();
    if (matchRow) {
      const { user_a, user_b } = matchRow as { user_a: string; user_b: string | null };
      const onRevealFail = (err: unknown) =>
        logger.error("notify_failed", {
          kind: "reveal_complete",
          matchId,
          err,
        });
      await notifyRevealComplete(user_a, matchId).catch(onRevealFail);
      if (user_b)
        await notifyRevealComplete(user_b, matchId).catch(onRevealFail);
    }
  }

  return {
    ownRevealed,
    partnerRevealed,
    partnerMovedOn,
    status,
  };
}

/**
 * Records that the caller chose to move on instead of revealing.
 */
export async function moveOn(matchId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("move_on", {
    p_match_id: matchId,
  });

  if (error) return { error: "Could not record move-on" };
  return {};
}

type RevealState = {
  ownRevealed: boolean;
  partnerRevealed: boolean;
  partnerMovedOn: boolean;
  status: string;
};

/**
 * Reads the current reveal state for a match. Used by the chat page
 * when entering a finished scene so the FadeToBlack overlay reflects
 * the partner's choice even across reloads.
 *
 * L13/L18 fix: does not expose raw user_a/user_b UUIDs. Determines
 * the caller's perspective server-side and returns only the relevant
 * flags (ownRevealed, partnerRevealed, partnerMovedOn, status).
 */
export async function getRevealState(
  matchId: string
): Promise<RevealState | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  /* E11: add explicit participant check as defense-in-depth —
     don't rely solely on RLS defense-in-depth —
     don't rely solely on RLS to block non-participants. */
  const { data, error } = await supabase
    .from("matches")
    .select(
      "user_a, user_b, user_a_revealed, user_b_revealed, user_a_moved_on, user_b_moved_on, status"
    )
    .eq("id", matchId)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle();

  if (error || !data) return { error: "Match not found" };

  const row = data as {
    user_a: string;
    user_b: string | null;
    user_a_revealed: boolean;
    user_b_revealed: boolean;
    user_a_moved_on: boolean;
    user_b_moved_on: boolean;
    status: string;
  };

  /* Determine the caller's perspective without exposing UUIDs. */
  const isUserA = row.user_a === user.id;
  const ownRevealed = isUserA ? row.user_a_revealed : row.user_b_revealed;
  const partnerRevealed = isUserA ? row.user_b_revealed : row.user_a_revealed;
  const partnerMovedOn = isUserA ? row.user_b_moved_on : row.user_a_moved_on;

  return {
    ownRevealed,
    partnerRevealed,
    partnerMovedOn,
    status: row.status,
  };
}