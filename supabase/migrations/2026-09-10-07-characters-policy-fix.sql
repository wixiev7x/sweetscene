-- ════════════════════════════════════════════════════════════════════
-- 2026-09-10 · 07 · Fix the characters policy stack
--
-- Run on BOTH projects (staging AND production). One paste each.
--
-- WHAT HAPPENED: the original schema's "Age-gated character viewing"
-- policy on characters reads profiles (age_cohort, nsfw_opt_in,
-- tos_accepted_at) directly — evaluated with the CALLER's privileges.
-- That was fine while anon/authenticated had table-level SELECT on
-- profiles. Migration 05/06 correctly removed that broad grant — which
-- made this old policy error out and broke character browsing on both
-- databases. (Verified: the only policy in the schema with a direct
-- profiles reference.)
--
-- THE FIX: one SECURITY DEFINER helper (can_view_nsfw) carries the
-- adult+opt-in+ToS check with owner privileges, immune to the caller's
-- column grants — same pattern as is_adult_viewer. The overlapping
-- policies are collapsed into ONE unified, NULL-safe policy.
-- Idempotent; safe to run more than once.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Helper: the full NSFW-view check (age + opt-in + ToS) ──
CREATE OR REPLACE FUNCTION can_view_nsfw()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.age_cohort = 'adult'
      AND p.nsfw_opt_in = true
      AND p.tos_accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION can_view_nsfw() FROM public;
GRANT EXECUTE ON FUNCTION can_view_nsfw() TO anon, authenticated;

-- ── 2. Characters: drop BOTH overlapping NSFW policies, create one ──
DROP POLICY IF EXISTS "Age-gated character viewing" ON characters;
DROP POLICY IF EXISTS "nsfw characters require adult cohort" ON characters;

CREATE POLICY "nsfw characters require adult viewer"
  ON characters FOR SELECT
  TO anon, authenticated
  USING (
    (is_public = true OR visibility = 'unlisted' OR creator_id = auth.uid())
    AND (
      is_nsfw IS NOT TRUE
      OR creator_id = auth.uid()
      OR can_view_nsfw()
    )
  );

-- ── 3. Bots: same NULL-safety pass (guarded — table is staging-only
--        for now) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'bots') THEN
    DROP POLICY IF EXISTS "nsfw rows require adult cohort" ON public.bots;
    CREATE POLICY "nsfw rows require adult viewer" ON public.bots
      FOR SELECT TO anon, authenticated
      USING (is_nsfw IS NOT TRUE OR is_adult_viewer());
  END IF;
END $$;

-- ── 4. Reload PostgREST's schema cache ──
NOTIFY pgrst, 'reload schema';
