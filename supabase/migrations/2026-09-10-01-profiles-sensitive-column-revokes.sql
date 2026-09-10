-- ════════════════════════════════════════════════════════════════════
-- 2026-09-10 · CRITICAL · Profile column exposure fix
--
-- Run on BOTH the staging project (runjhpkyqcdbiijrqmfl) AND the
-- production project (vnugflrlzrvngopweixe).
--
-- Verified live on staging (2026-09-10): with only the public anon
-- key, EVERY profiles row was readable INCLUDING tokens_balance,
-- is_vip, vip_expires_at, nsfw_opt_in, age_cohort, birthdate,
-- is_admin, connection_tickets, recent_ratings, tos_accepted_at.
-- schema.sql has documented these REVOKEs since Phase B5/B6 — they
-- were simply never applied to the running database.
--
-- After running: the owner still sees their own values through the
-- get_own_profile() SECURITY DEFINER RPC (widened in migration 02).
-- Kept readable on purpose: display/flag columns used by hot paths
-- (is_banned, banned_at, banned_until, ban_reason for the banned
-- page, bio, avatar_url, anonymous_*, username, reputation_*).
-- Optional later tighten-up: move ban_reason behind an RPC too.
-- ════════════════════════════════════════════════════════════════════

REVOKE SELECT (
  tokens_balance,
  is_vip,
  vip_expires_at,
  nsfw_opt_in,
  age_cohort,
  age_cohort_set_at,
  age_confirmed_at,
  birthdate,
  is_admin,
  connection_tickets,
  recent_ratings,
  tos_accepted_at,
  age_verified,
  age_verification_id,
  age_verification_status,
  age_verified_at
) ON profiles FROM anon, authenticated;

-- Sanity check (run in the SQL editor, expect 42501 permission denied):
--   SELECT tokens_balance FROM profiles LIMIT 1;  -- as anon/authenticated
--   SELECT * FROM get_own_profile();              -- as authenticated: works
