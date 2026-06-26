import "server-only";
import { createClient } from "@supabase/supabase-js";

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
 * SECURITY: Every caller MUST verify `supabase.auth.getUser()` on the
 * regular server client BEFORE using this admin client. Never expose
 * the service role key to the browser.
 */

let cached: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  if (cached) return cached;

  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return cached;
}
