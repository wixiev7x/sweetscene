-- 2026-11-21-02 — Age floor back to 16 with strict age cohorts.
--
-- Product decision (2026-11-21): the platform is 16+. Accounts are
-- placed in a cohort from the server-computed age:
--   16–17 → 'minor'  (matched/messaged only within the minor cohort)
--   18+   → 'adult'
-- Matchmaking queues and DMs are already cohort-homogeneous
-- (lib/actions/matchmaking.ts, lib/actions/messages.ts), and NSFW stays
-- gated to age_cohort='adult' in set_nsfw_opt_in.
--
-- Supersedes 2026-11-10-01-age-floor-18.sql. Idempotent (CREATE OR
-- REPLACE). Birthdate stays write-once.

CREATE OR REPLACE FUNCTION set_own_age_cohort(p_birthdate DATE)
RETURNS TABLE (success BOOLEAN, cohort TEXT, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_dob DATE;
  v_age INT;
  v_cohort TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'unauthenticated'::TEXT;
    RETURN;
  END IF;

  SELECT birthdate INTO v_existing_dob
    FROM profiles WHERE id = auth.uid() FOR UPDATE;

  -- Write-once. Corrections require an admin/support path, by design.
  IF v_existing_dob IS NOT NULL THEN
    RETURN QUERY SELECT false, derived_age_cohort(auth.uid()), 'already_set'::TEXT;
    RETURN;
  END IF;

  IF p_birthdate IS NULL
     OR p_birthdate > CURRENT_DATE
     OR p_birthdate < CURRENT_DATE - INTERVAL '120 years' THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'invalid'::TEXT;
    RETURN;
  END IF;

  v_age := date_part('year', age(CURRENT_DATE, p_birthdate))::INT;

  IF v_age < 16 THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'underage'::TEXT;
    RETURN;
  END IF;

  v_cohort := CASE WHEN v_age >= 18 THEN 'adult' ELSE 'minor' END;

  UPDATE profiles
     SET birthdate         = p_birthdate,
         age_cohort        = v_cohort,   -- denormalised cache only
         age_cohort_set_at = now()
   WHERE id = auth.uid();

  RETURN QUERY SELECT true, v_cohort, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_own_age_cohort(DATE) FROM anon;
GRANT  EXECUTE ON FUNCTION set_own_age_cohort(DATE) TO authenticated;
