import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";

export const POINTS = {
  match_completed: 10,
  review_received_per_flame: 2,
  creator_new_chat: 3,
  daily_first_chat: 2,
} as const;

/** Idempotent (user, reason, ref) award. Never throws. */
export async function awardPoints(userId: string | null | undefined, points: number, reason: string, ref: string) {
  if (!userId || !points) return;
  try {
    await createAdminClient().rpc("award_points", { p_user: userId, p_points: points, p_reason: reason, p_ref: ref.slice(0, 120) } as never);
  } catch {
    /* non-fatal */
  }
}
