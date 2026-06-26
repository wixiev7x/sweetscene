"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase.rpc("reveal_self", {
    p_match_id: matchId,
  });

  if (error || !data || data.length === 0) {
    return { error: "Could not request reveal" };
  }

  const row = data[0];
  return {
    ownRevealed: row.own_revealed as boolean,
    partnerRevealed: row.partner_revealed as boolean,
    partnerMovedOn: row.partner_moved_on as boolean,
    status: row.status as string,
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
  user_a_revealed: boolean;
  user_b_revealed: boolean;
  user_a_moved_on: boolean;
  user_b_moved_on: boolean;
  status: string;
  user_a: string;
  user_b: string | null;
};

/**
 * Reads the current reveal state for a match. Used by the chat page
 * when entering a finished scene so the FadeToBlack overlay reflects
 * the partner's choice even across reloads.
 */
export async function getRevealState(
  matchId: string
): Promise<RevealState | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("matches")
    .select(
      "user_a, user_b, user_a_revealed, user_b_revealed, user_a_moved_on, user_b_moved_on, status"
    )
    .eq("id", matchId)
    .single();

  if (error || !data) return { error: "Match not found" };

  return data as RevealState;
}