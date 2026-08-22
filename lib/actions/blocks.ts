"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";

/* ════════════════════════════════════════════════════════════════════
 * Phase 7 — User block actions.
 *
 * A user can block another user (identified by anonymous_username or
 * profile ID) to prevent them from being matched together in the
 * future. The block is silent — the blocked user isn't notified. The
 * claim_match RPC checks user_blocks before pairing two users, so a
 * blocked pair can never end up in the same scene.
 *
 * The blocker can unblock by deleting the row.
 * ════════════════════════════════════════════════════════════════════ */

type BlockResult = { success: true } | { error: string };

/**
 * Blocks a user by their profile ID. The caller cannot block themselves.
 * Idempotent — re-blocking an already-blocked user is a no-op.
 */
export async function blockUser(profileId: string): Promise<BlockResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  if (profileId === user.id) {
    return { error: "Cannot block yourself" };
  }

  /* Idempotent upsert — re-blocking a user is a no-op. */
  const { error } = await supabase.from("user_blocks").upsert(
    {
      blocker_id: user.id,
      blocked_id: profileId,
    },
    { onConflict: "blocker_id,blocked_id" }
  );

  if (error) return { error: "Failed to block user" };

  return { success: true };
}

/**
 * Removes a block by the blocked user's profile ID.
 */
export async function unblockUser(profileId: string): Promise<BlockResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", profileId);

  if (error) return { error: "Failed to unblock user" };

  return { success: true };
}

type BlockedUser = {
  blocked_id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  created_at: string;
};

type ListBlocksResult = { blocks: BlockedUser[] } | { error: string };

/**
 * Returns the list of users the caller has blocked, with their anonymous
 * profile info for display. Joins user_blocks → profiles on blocked_id.
 */
export async function listMyBlocks(): Promise<ListBlocksResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("user_blocks")
    .select(
      "blocked_id, created_at, profiles!user_blocks_blocked_id_fkey(anonymous_username, anonymous_pfp_url)"
    )
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: "Failed to fetch blocks" };

  const blocks: BlockedUser[] = (data as Array<Record<string, unknown>>).map(
    (row) => {
      const profile = row.profiles as {
        anonymous_username: string;
        anonymous_pfp_url: string | null;
      };
      return {
        blocked_id: row.blocked_id as string,
        anonymous_username: profile?.anonymous_username ?? "Unknown",
        anonymous_pfp_url: profile?.anonymous_pfp_url ?? null,
        created_at: row.created_at as string,
      };
    }
  );

  return { blocks };
}