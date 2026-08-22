import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side operations that need to
 * bypass RLS or access column-level restricted fields:
 *
 *   1. Reading `characters.system_prompt` — REVOKED from `authenticated`
 *      so no browser query can extract the secret anti-injection wrapper.
 *      Server actions use this client to fetch it.
 *
 *   2. Inserting AI messages into the `messages` table — the existing
 *      INSERT RLS policy only allows `sender_type = 'human'`, so AI
 *      messages (sender_type='ai', sender_id=null) are inserted via
 *      this admin client which bypasses RLS.
 *
 *   3. Reading `reports` — only the admin can view reported conversation
 *      evidence snapshots.
 *
 *   4. Reading `solo_sessions` for AI log inspection — the admin can
 *      query all solo sessions to review AI behaviour.
 *
 *   5. Phase 8: Writing to `payments` and `nowpayments_events` tables
 *      (no RLS policies for authenticated — admin client bypasses RLS).
 *      Calling `credit_tokens`, `grant_vip` service_role-only RPCs.
 *
 * SECURITY: Every caller MUST verify `supabase.auth.getUser()` on the
 * regular server client BEFORE using this admin client. Never expose
 * the service role key to the browser.
 */

/**
 * Explicitly typed as `SupabaseClient` (with default type params) so
 * that `.from("table_name")` resolves to a usable query builder
 * instead of `never`. Without this annotation, the 3-type-param
 * `createClient` from `@supabase/supabase-js` infers `Schema = never`
 * when `Database = any`, breaking all `.from()` calls.
 */
let cached: SupabaseClient | null = null;

/**
 * Reads the `role` claim out of a legacy Supabase JWT key.
 *
 * Returns null for anything that is not a decodable JWT — the modern
 * `sb_secret_…` / `sb_publishable_…` keys are opaque, so absence of a
 * role is not evidence of a wrong key. Never throws: a malformed key is
 * the connection's problem to report, not this check's.
 */
function jwtRole(key: string): string | null {
  const payload = key.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const role: unknown = JSON.parse(json)?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  /**
   * Fail loudly rather than handing `createClient` an empty string.
   * Every RPC this client drives is REVOKED from `anon` and
   * `authenticated`, so a missing key does not silently fall back to
   * reduced privileges — it produces an opaque 401 from PostgREST at
   * whatever call site happened to run first.
   */
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set. " +
        "Server-side actions (AI turns, billing, admin, moderation) cannot " +
        "run without the service role key."
    );
  }

  /**
   * The anon key is publishable and safe in a browser; the service role
   * key bypasses RLS entirely. Pasting the wrong one here would leave
   * every privileged path failing with a permissions error that looks
   * like a policy bug rather than a misconfiguration.
   */
  if (jwtRole(key) === "anon") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY holds an anon key. Use the service_role " +
        "key from Project Settings → API Keys."
    );
  }

  cached = createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return cached;
}
