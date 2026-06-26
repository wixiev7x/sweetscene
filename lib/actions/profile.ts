"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";

/* ════════════════════════════════════════════════════════════════════
 * Phase 5a — Profile server actions.
 *
 * After the Phase 5 SQL block REVOKE'd (tokens_balance, is_vip) from
 * authenticated, client-side `SELECT *` on profiles returns NULL for
 * those columns. These actions read via the get_own_profile SECURITY
 * DEFINER RPC (B1–B6) which returns the full row for the owner only.
 *
 * Username updates go through update_profile_username (column-restricted
 * RPC). Sign-out is now a server action (S5) so the session cookies
 * are cleared server-side.
 * ════════════════════════════════════════════════════════════════════ */

export type MyProfile = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  reputation_tier: string;
  tokens_balance: number;
  is_vip: boolean;
  recent_ratings: unknown;
  earned_tags: string[];
  connection_tickets: number;
  created_at: string;
};

type ProfileResult = { profile: MyProfile } | { error: string };

/**
 * Reads the caller's own profile via the get_own_profile SECURITY
 * DEFINER RPC. This is the ONLY safe way to read tokens_balance and
 * is_vip after the column-level REVOKE — a direct client SELECT
 * returns NULL for those columns.
 */
export async function getMyProfile(): Promise<ProfileResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("get_own_profile");

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Profile not found" };
  }

  const row = data[0] as MyProfile;

  return { profile: row };
}

type UpdateUsernameResult = { success: true } | { error: string };

/**
 * Updates the caller's anonymous username via the
 * update_profile_username SECURITY DEFINER RPC. The RPC validates
 * length (2–20 chars) and only touches the anonymous_username column
 * — tokens_balance, is_vip, and reputation_score are REVOKE'd from
 * UPDATE so they can't be modified through this path.
 */
export async function updateMyUsername(
  username: string
): Promise<UpdateUsernameResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return { error: "Username must be 2–20 characters" };
  }

  const { error } = await supabase.rpc("update_profile_username", {
    p_username: trimmed,
  });

  if (error) return { error: "Failed to update username" };

  return { success: true };
}

/**
 * Signs the caller out by clearing the Supabase auth session server-side
 * (S5). This is a server action so the auth cookies are invalidated
 * before the redirect — the previous client-only signOut didn't clear
 * the server-side cookie, leaving the session valid until expiry.
 */
export async function signOut(): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) return { error: "Failed to sign out" };

  return { success: true };
}