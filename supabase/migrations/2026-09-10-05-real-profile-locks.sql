-- ════════════════════════════════════════════════════════════════════
-- 2026-09-10 · 05 · THE REAL profile locks
--
-- Run on BOTH projects (staging AND production). One paste each.
-- Supersedes migrations 01 and 03 — keep those; they ran fine, they
-- just did nothing.
--
-- ROOT CAUSE (found by live testing): PostgreSQL column-level REVOKEs
-- do NOT override a table-level GRANT. Supabase grants table-level
-- SELECT/UPDATE on profiles to anon + authenticated, so every column
-- revoke — including the ones this repo's schema.sql has documented
-- since phase B5/B6 — was a silent no-op. That is why tokens_balance
-- was always readable and self-admin escalation always worked.
--
-- The correct pattern is the reverse: revoke the TABLE-level grant,
-- then grant only the safe COLUMNS:
--   SELECT  → public/display columns
--   UPDATE  → the 5 columns the app's own actions write via the user
--             session (bio, avatar, anonymous name/pfp, age_confirmed)
-- Everything else (tokens_balance, is_admin, age_*, nsfw_opt_in, ...)
-- becomes unreachable from any client role. Owner reads keep working
-- through the get_own_profile() SECURITY DEFINER RPC; writes through
-- their existing SECURITY DEFINER RPCs (grant_vip, credit_tokens,
-- set_age_cohort, set_nsfw_opt_in) and the service-role server actions.
--
-- Also included:
--   · bots table: RLS was DISABLED (verified live — anon read an NSFW
--     row through the policy). Enabled here, plus an INSERT policy so
--     character creation keeps working, and the NSFW gate rewritten to
--     use a SECURITY DEFINER helper (policy subqueries run with the
--     caller's column privileges, which are about to shrink).
--   · characters NSFW gate rewritten the same way.
--   · NOTIFY pgrst — GRANT/REVOKE do not fire PostgREST's event
--     trigger, so the schema cache is reloaded explicitly.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Helper for NSFW row gates (SECURITY DEFINER → immune to the
--        column grants below; avoids recursion) ──
CREATE OR REPLACE FUNCTION is_adult_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.age_cohort = 'adult'
  );
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION is_adult_viewer() FROM public;
GRANT EXECUTE ON FUNCTION is_adult_viewer() TO anon, authenticated;

-- ── 2. SELECT locks: table-level revoke + safe column grants ──
REVOKE SELECT ON profiles FROM anon, authenticated;
GRANT SELECT (
  id, created_at, username, avatar_url, bio,
  anonymous_username, anonymous_pfp_url,
  reputation_score, reputation_tier, earned_tags,
  is_banned, banned_at, banned_until, ban_reason, role
) ON profiles TO anon, authenticated;

-- ── 3. UPDATE locks: nothing sensitive is client-writable anymore ──
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (
  bio, avatar_url, anonymous_username, anonymous_pfp_url, age_confirmed_at
) ON profiles TO anon, authenticated;

-- ── 4. NSFW row gates via the helper ──
DROP POLICY IF EXISTS "nsfw characters require adult cohort" ON characters;
CREATE POLICY "nsfw characters require adult cohort" ON characters
  FOR SELECT TO anon, authenticated
  USING (is_nsfw = false OR is_adult_viewer());

-- bots: everything guarded — the table only exists on staging so far
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'bots') THEN
    ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "nsfw rows require adult cohort" ON public.bots;
    CREATE POLICY "nsfw rows require adult cohort" ON public.bots
      FOR SELECT TO anon, authenticated
      USING (is_nsfw = false OR is_adult_viewer());

    DROP POLICY IF EXISTS "authenticated can create bots" ON public.bots;
    CREATE POLICY "authenticated can create bots" ON public.bots
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── 5. Reload PostgREST's schema cache (GRANT/REVOKE don't trigger it) ──
NOTIFY pgrst, 'reload schema';

-- ── Sanity checks (SQL editor, as yourself — expect the stated result) ──
-- has_column_privilege('anon','profiles','tokens_balance','SELECT')  → false
-- has_column_privilege('anon','profiles','bio','SELECT')             → true
-- has_column_privilege('authenticated','profiles','is_admin','UPDATE') → false
