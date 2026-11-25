import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";

export const POINTS = {
  match_completed: 10,
  review_received_per_flame: 2,
  creator_new_chat: 3,
  daily_first_chat: 2,
} as const;

/** Accounts younger than this don't generate points for others (anti alt-farming). */
const MIN_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** True if the account is old enough to count toward someone else's points. */
export async function isEstablished(userId: string): Promise<boolean> {
  try {
    const { data } = await createAdminClient().from("profiles").select("created_at, is_banned").eq("id", userId).maybeSingle();
    const p = data as { created_at: string; is_banned: boolean | null } | null;
    return !!p && !p.is_banned && Date.now() - new Date(p.created_at).getTime() >= MIN_ACCOUNT_AGE_MS;
  } catch {
    return false;
  }
}

/** Points only for live, visible characters. */
export async function isLiveCharacter(characterId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("characters").select("status, is_hidden, is_public").eq("id", characterId).maybeSingle();
  const c = data as { status: string; is_hidden: boolean; is_public: boolean } | null;
  return !!c && c.status === "published" && !c.is_hidden && c.is_public;
}

/** Idempotent (user, reason, ref) award with daily caps in SQL. Never throws. */
export async function awardPoints(userId: string | null | undefined, points: number, reason: string, ref: string) {
  if (!userId || !points) return;
  try {
    await createAdminClient().rpc("award_points", { p_user: userId, p_points: points, p_reason: reason, p_ref: ref.slice(0, 120) } as never);
  } catch {
    /* non-fatal */
  }
}
