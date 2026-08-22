import "server-only";

/**
 * Checks whether the current authenticated user is banned.
 * Calls the `is_current_user_banned` SECURITY DEFINER RPC which
 * inspects `profiles.is_banned` and `profiles.banned_until`, treats an
 * elapsed `banned_until` as unbanned, and lazily clears it.
 *
 * Returns `{ ok: true }` if the user is NOT banned (or the ban has
 * expired), or `{ error }` if the user is currently banned or the check
 * could not be completed.
 *
 * FAILS CLOSED. This previously returned `{ ok: true }` whenever the RPC
 * errored — and because `is_current_user_banned` did not exist in the
 * schema at all, that error path was the ONLY path: every call returned
 * "not banned" and bans were unenforced everywhere this is used
 * (matchmaking, messages, reveal, solo). A moderation control that
 * fails open is not a moderation control.
 *
 * Consequence of failing closed: if the Phase 12 migration has not been
 * applied, these features return an error for everyone rather than
 * silently admitting banned users. That is the intended trade — see
 * SETUP.md.
 */
export async function assertNotBanned(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.rpc("is_current_user_banned");

  if (error) {
    return {
      error:
        "Could not verify account status. Please try again in a moment.",
    };
  }

  if ((data as unknown as boolean) === true) {
    return {
      error: "Your account has been banned. You cannot use this feature.",
    };
  }

  return { ok: true };
}
