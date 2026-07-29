"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { assertNotBanned } from "@/lib/utils/ban";
import { rateLimit } from "@/lib/utils/ratelimit";
import { DELETE_CONFIRMATION } from "@/lib/config/constants";

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
  vip_expires_at: string | null;
  recent_ratings: unknown;
  earned_tags: string[];
  connection_tickets: number;
  tos_accepted_at: string | null;
  age_cohort: string | null;
  nsfw_opt_in: boolean;
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

export type BirthdateResult =
  | { success: true; cohort: "adult" | "minor" }
  | { error: string; reason?: "already_set" | "underage" | "invalid" };

/**
 * Records the caller's birthdate through the authenticated
 * `set_own_age_cohort` RPC, which computes the age in SQL and derives
 * the cohort. Write-once.
 *
 * SECURITY: this replaces the previous flow, where app/page.tsx computed
 * the cohort in the browser, wrote it to a `sweetscene_age_cohort` cookie,
 * and the OAuth callback fed that cookie to a service-role RPC. That
 * made the entire 18+ NSFW gate bypassable with a single devtools line.
 * Never reintroduce a client-supplied cohort — send the birthdate and
 * let the database decide.
 */
export async function submitBirthdate(
  birthdate: string
): Promise<BirthdateResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  /* Shape-check only. The authoritative validation is in SQL. */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return { error: "Please enter a valid date of birth.", reason: "invalid" };
  }

  const { data, error } = await supabase.rpc("set_own_age_cohort", {
    p_birthdate: birthdate,
  });

  if (error) return { error: "Could not save your date of birth." };

  const row = (data as { success: boolean; cohort: string | null; reason: string | null }[] | null)?.[0];
  if (!row) return { error: "Could not save your date of birth." };

  if (!row.success) {
    switch (row.reason) {
      case "underage":
        return {
          error: "You must be at least 16 to use sweetscene.",
          reason: "underage",
        };
      case "already_set":
        return {
          error: "Your date of birth is already on file and cannot be changed here.",
          reason: "already_set",
        };
      default:
        return { error: "Please enter a valid date of birth.", reason: "invalid" };
    }
  }

  return { success: true, cohort: row.cohort === "adult" ? "adult" : "minor" };
}

/**
 * Sets the caller's NSFW opt-in preference via the set_nsfw_opt_in
 * SECURITY DEFINER RPC. The RPC re-validates adulthood server-side
 * against the DERIVED cohort (computed from the stored birthdate) — a
 * minor cannot enable NSFW even if they call this action directly.
 * Returns success=false if the age check fails.
 */
export async function setNsfwOptIn(
  optIn: boolean
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("set_nsfw_opt_in", {
    p_opt_in: optIn,
  });

  if (error) return { error: "Failed to update NSFW preference" };

  const result = data as unknown as { success: boolean }[] | null;
  if (!result || !Array.isArray(result) || result.length === 0 || !result[0].success) {
    return { error: "NSFW content is restricted to users 18 or older." };
  }

  return { success: true };
}
/* ════════════════════════════════════════════════════════════════════
 * Account deletion.
 *
 * The privacy policy has always promised this ("Deletion: You can delete
 * your account, which cascades to all associated data") with nothing
 * behind it. This is that.
 *
 * Deleting the auth.users row is what actually erases the account —
 * profiles.id references it ON DELETE CASCADE, and everything else keys
 * off profiles.id from there. Deleting only the profile row would leave
 * a live login attached to nothing.
 *
 * That delete needs the service role, so this is the one place a user
 * action reaches for the admin client. The identity comes from the
 * session and nowhere else: the caller does not get to say whose account
 * this is. A `userId` parameter here would be an account-deletion
 * endpoint for arbitrary accounts.
 * ════════════════════════════════════════════════════════════════════ */

export type DeleteAccountResult =
  | { success: true }
  | { error: string; reason?: "banned" | "confirmation" };

export async function deleteMyAccount(
  confirmation: string
): Promise<DeleteAccountResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  if (confirmation !== DELETE_CONFIRMATION) {
    return {
      error: `Type ${DELETE_CONFIRMATION} to confirm.`,
      reason: "confirmation",
    };
  }

  /* Deletion is not an escape hatch from moderation. A banned user who
     can delete and re-register has not been banned — they have been
     inconvenienced, and the ban is the only enforcement tool the
     platform has. Ban appeals go through support instead. */
  const banCheck = await assertNotBanned(supabase);
  if ("error" in banCheck) {
    return {
      error:
        "Accounts under moderation cannot be deleted. Contact support if you believe this is a mistake.",
      reason: "banned",
    };
  }

  /* Cascade does the rest. payments.user_id is SET NULL (Phase 14), so
     financial records survive de-identified — required for the 7-year
     retention the privacy policy commits to. */
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: "Could not delete the account. Please try again." };
  }

  /* Clear the session cookies. The JWT would otherwise stay valid until
     expiry, pointing at a user row that no longer exists. */
  await supabase.auth.signOut();

  return { success: true };
}
