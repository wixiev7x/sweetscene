-- ════════════════════════════════════════════════════════════════════
-- SUPERSEDED by 2026-09-10-05 on the profiles-lock sections (same
-- column-REVOKE no-op reason). The age columns + widened RPC it
-- created are still valid and in use; run 05 after this one.
-- 2026-09-10 · 04 · PRODUCTION consolidated security migration
--
-- For vnugflrlzrvngopweixe ONLY. One paste, covers 01+02+03 combined.
-- Differs from staging's three files because production does not have
-- the `bots` table yet (ships with the staging-tables port later).
--
-- What it does:
--   1. Creates the age-verification columns (inert until a provider
--      is configured — safe to run now).
--   2. Widens the get_own_profile owner-read RPC.
--   3. SELECT revokes — closes the live-verified exposure where the
--      anon key reads any user's tokens_balance / is_admin / age data.
--   4. UPDATE revokes — closes the verified self-admin and
--      self-tokens escalation.
--   5. NSFW row gate on characters.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verification_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (age_verification_status IN ('unverified','pending','verified','failed','expired'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_age_verification_id ON profiles(age_verification_id);

DROP FUNCTION IF EXISTS get_own_profile();
CREATE OR REPLACE FUNCTION get_own_profile()
RETURNS TABLE (
  id UUID, anonymous_username TEXT, anonymous_pfp_url TEXT, reputation_score INT,
  reputation_tier TEXT, tokens_balance INT, is_vip BOOLEAN, recent_ratings JSONB,
  earned_tags TEXT[], connection_tickets INT, created_at TIMESTAMPTZ,
  age_verified BOOLEAN, age_verification_status TEXT, age_verified_at TIMESTAMPTZ,
  nsfw_opt_in BOOLEAN, age_cohort TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.anonymous_username, p.anonymous_pfp_url, p.reputation_score,
         p.reputation_tier, p.tokens_balance, p.is_vip, p.recent_ratings,
         p.earned_tags, p.connection_tickets, p.created_at, p.age_verified,
         p.age_verification_status, p.age_verified_at, p.nsfw_opt_in, p.age_cohort
  FROM profiles p WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION get_own_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION get_own_profile() FROM anon;

REVOKE SELECT (
  tokens_balance, is_vip, vip_expires_at, nsfw_opt_in, age_cohort, age_cohort_set_at,
  age_confirmed_at, birthdate, is_admin, connection_tickets, recent_ratings,
  tos_accepted_at, age_verified, age_verification_id, age_verification_status, age_verified_at
) ON profiles FROM anon, authenticated;

REVOKE UPDATE (
  tokens_balance, is_vip, reputation_score, connection_tickets, vip_expires_at,
  nsfw_opt_in, age_cohort, is_admin, role,
  age_verified, age_verification_id, age_verification_status, age_verified_at
) ON profiles FROM anon, authenticated;

DROP POLICY IF EXISTS "nsfw characters require adult cohort" ON characters;
CREATE POLICY "nsfw characters require adult cohort" ON characters
  FOR SELECT TO anon, authenticated
  USING (is_nsfw = false OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.age_cohort = 'adult'
  ));
