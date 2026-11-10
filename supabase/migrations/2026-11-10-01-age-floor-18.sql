-- 2026-11-10-01 — Age floor 18+ (launch STEP 4c)
--
-- The platform copy now states an 18+ floor everywhere (terms, privacy,
-- safety, signup/login footers, manifest). This aligns the authoritative
-- server-side check with that copy: set_own_age_cohort previously rejected
-- only under-16 and classified 16–17 as 'minor'. It now rejects under-18
-- outright. The minor/adult CASE is retained defensively (schema compat)
-- but the 'minor' branch is unreachable with an 18+ floor.
--
-- Idempotent: CREATE OR REPLACE. No table changes. Existing rows are
-- untouched (write-once birthdate); no backfill needed — users who set a
-- 16–17 DOB before this change keep their stored cohort; NSFW access was
-- already gated to age_cohort='adult' (18+), so nothing tightens there.
-- Admin/support path for DOB corrections remains as before.

-- ── set_own_age_cohort: authenticated, write-once birthdate capture ──
-- Computes age server-side. Rejects under-18 outright (platform floor)
-- and refuses to overwrite an existing birthdate, so a user who
-- truthfully entered a minor DOB cannot resubmit as an adult.
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

  IF v_age < 18 THEN
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
