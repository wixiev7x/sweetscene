-- ════════════════════════════════════════════════════════════════════
-- 2026-09-10 · Age/ID verification
--
-- Run on BOTH projects (staging first, then production). Requires no
-- provider to be configured — the columns are inert until the app has
-- AGE_VERIFICATION_* env keys (see lib/verification/config.ts).
--
-- What we store, deliberately: pass/fail + the provider's reference ID
-- + timestamp. ID documents and biometric data never touch this
-- database — they stay with the verification provider.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Columns ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verification_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (age_verification_status IN ('unverified', 'pending', 'verified', 'failed', 'expired'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_age_verification_id
  ON profiles(age_verification_id);

-- Only server actions (service role) and SECURITY DEFINER RPCs write
-- these — a client must never be able to flip its own verification.
REVOKE UPDATE (age_verified, age_verification_id, age_verification_status, age_verified_at)
  ON profiles FROM authenticated, anon;

-- ── 2. Widen get_own_profile so owners keep seeing their own values ──
-- (Return type changes → drop first; this is the documented pattern
-- from schema.sql phases 1417+.)
DROP FUNCTION IF EXISTS get_own_profile();
CREATE OR REPLACE FUNCTION get_own_profile()
RETURNS TABLE (
  id UUID,
  anonymous_username TEXT,
  anonymous_pfp_url TEXT,
  reputation_score INT,
  reputation_tier TEXT,
  tokens_balance INT,
  is_vip BOOLEAN,
  recent_ratings JSONB,
  earned_tags TEXT[],
  connection_tickets INT,
  created_at TIMESTAMPTZ,
  age_verified BOOLEAN,
  age_verification_status TEXT,
  age_verified_at TIMESTAMPTZ,
  nsfw_opt_in BOOLEAN,
  age_cohort TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.anonymous_username, p.anonymous_pfp_url,
         p.reputation_score, p.reputation_tier, p.tokens_balance,
         p.is_vip, p.recent_ratings, p.earned_tags, p.connection_tickets,
         p.created_at, p.age_verified, p.age_verification_status,
         p.age_verified_at, p.nsfw_opt_in, p.age_cohort
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_own_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION get_own_profile() FROM anon;

-- ── 3. DB-level NSFW row gates (bots + characters) ──
-- Closes the direct-API hole: a guest or minor could previously SELECT
-- NSFW rows straight through PostgREST, bypassing every UI filter.
--
-- PHASE A (this migration, run now): adult self-attestation
-- (age_cohort='adult') is enough — matches the current product.
DROP POLICY IF EXISTS "nsfw rows require adult cohort" ON bots;
CREATE POLICY "nsfw rows require adult cohort" ON bots
  FOR SELECT TO anon, authenticated
  USING (
    is_nsfw = false
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.age_cohort = 'adult'
    )
  );

DROP POLICY IF EXISTS "nsfw characters require adult cohort" ON characters;
CREATE POLICY "nsfw characters require adult cohort" ON characters
  FOR SELECT TO anon, authenticated
  USING (
    is_nsfw = false
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.age_cohort = 'adult'
    )
  );

-- ── 4. PHASE B — run ONLY once the ID-verification provider is live ──
-- Tightens both policies from "self-attested adult" to "ID-verified
-- adult". Do NOT run before AGE_VERIFICATION_* is configured, or NSFW
-- becomes unreachable for everyone (fail-closed with no way through).
--
-- ALTER POLICY "nsfw rows require adult cohort" ON bots
--   USING (is_nsfw = false OR EXISTS (
--     SELECT 1 FROM profiles p
--     WHERE p.id = auth.uid() AND p.age_cohort = 'adult' AND p.age_verified = true
--   ));
-- ALTER POLICY "nsfw characters require adult cohort" ON characters
--   USING (is_nsfw = false OR EXISTS (
--     SELECT 1 FROM profiles p
--     WHERE p.id = auth.uid() AND p.age_cohort = 'adult' AND p.age_verified = true
--   ));
