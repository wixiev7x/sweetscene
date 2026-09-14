-- ════════════════════════════════════════════════════════════════════
-- 2026-09-10 · 06 · Real profile locks — adaptive version
--
-- For PRODUCTION (vnugflrlzrvngopweixe). Staging already has 05.
-- Identical to 05 except the column grants are built dynamically from
-- the columns that actually exist — production lacks `username` and
-- `avatar_url`, which made 05's fixed list fail and roll back.
-- Safe to run more than once; safe on staging too (no-op effect).
-- ════════════════════════════════════════════════════════════════════

-- ── 1. NSFW-gate helper (SECURITY DEFINER — immune to column grants) ──
CREATE OR REPLACE FUNCTION is_adult_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.age_cohort = 'adult'
  );
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION is_adult_viewer() FROM public;
GRANT EXECUTE ON FUNCTION is_adult_viewer() TO anon, authenticated;

-- ── 2. SELECT locks — grant only the safe columns that exist here ──
REVOKE SELECT ON profiles FROM anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN (
      'id','created_at','username','avatar_url','bio',
      'anonymous_username','anonymous_pfp_url',
      'reputation_score','reputation_tier','earned_tags',
      'is_banned','banned_at','banned_until','ban_reason','role'
    );
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', cols);
END $$;

-- ── 3. UPDATE locks — only the columns the app's own actions write ──
REVOKE UPDATE ON profiles FROM anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN (
      'bio','avatar_url','anonymous_username','anonymous_pfp_url','age_confirmed_at'
    );
  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO anon, authenticated', cols);
END $$;

-- ── 4. NSFW row gates via the helper ──
DROP POLICY IF EXISTS "nsfw characters require adult cohort" ON characters;
CREATE POLICY "nsfw characters require adult cohort" ON characters
  FOR SELECT TO anon, authenticated
  USING (is_nsfw = false OR is_adult_viewer());

-- bots: guarded (table only exists on staging so far)
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

-- ── 5. Reload PostgREST's schema cache ──
NOTIFY pgrst, 'reload schema';
