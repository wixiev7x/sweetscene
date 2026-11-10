-- 2026-11-10-02: NULL-safe participant guard across match RPCs
--
-- STEP 4b E2E on DESIGN found a real hole in send_human_message: the
-- participant check used
--   IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
-- For a fresh/unclaimed match user_b is NULL, so `NULL <> auth.uid()`
-- evaluates to UNKNOWN, the AND goes UNKNOWN, the IF never fires — any
-- authenticated user could write into ANY unclaimed match through the
-- RPC (SECURITY DEFINER bypasses the messages INSERT policy). Direct
-- REST inserts stayed blocked by RLS; only the RPC path was open.
--
-- The identical broken pattern exists in NINE definitions in schema.sql:
-- append_human_message, claim_ai_turn, send_human_message (base + Phase
-- 17 mirror), request_direct_turn, request_ai_nudge, report_conversation
-- (base + Phase 10 variant), submit_match_rating. This migration
-- patches EVERY public function whose definition contains the broken
-- string, by rewriting it with NULL-safe IS DISTINCT FROM comparisons —
-- no bodies hand-copied, signatures discovered from the catalog.
--
-- Semantics: a NULL user_b (unclaimed match) now means "not you" for
-- everyone except user_a, which is the intent of a participant gate.
-- Idempotent: after the patch the broken substring no longer matches.

DO $patch$
DECLARE
  r RECORD;
  def TEXT;
  broken TEXT := 'm_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid()';
  fixed  TEXT := 'auth.uid() IS DISTINCT FROM m_row.user_a AND auth.uid() IS DISTINCT FROM m_row.user_b';
BEGIN
  FOR r IN
    SELECT p.oid AS fn_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosrc::text LIKE '%' || broken || '%'
  LOOP
    def := replace(pg_get_functiondef(r.fn_oid), broken, fixed);
    EXECUTE def;
    RAISE NOTICE 'patched participant guard: %', r.fn_oid::regprocedure;
  END LOOP;
END
$patch$;
