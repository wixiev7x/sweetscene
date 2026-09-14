-- ════════════════════════════════════════════════════════════════════
-- SUPERSEDED by 2026-09-10-05: same reason as 01 — column-level
-- REVOKEs are no-ops under a table-level GRANT. 05 revokes the
-- table-level UPDATE grant and re-grants only safe columns.
-- 2026-09-10 · CRITICAL · Privilege escalation + token minting fix
--
-- Run on BOTH projects (staging runjhpkyqcdbiijrqmfl AND production
-- vnugflrlzrvngopweixe) IMMEDIATELY, before anything else.
--
-- Verified live on staging (2026-09-10, adversarial test): an
-- authenticated user could PATCH their OWN profiles row with
--   { "is_admin": true }     → assert_current_user_admin() → true
--                              → full admin RPC access (list_reports,
--                                users, bans, settings UI)
--   { "tokens_balance": 999999 } → unlimited free tokens (each AI turn
--                                  costs the platform real money)
-- The "Users can update own profile" RLS policy has no column limits;
-- the column UPDATE REVOKEs that schema.sql has documented since
-- phases B5/B6/E2/E12 were NEVER applied to the running databases.
--
-- All revoked columns are written exclusively by service-role RPCs
-- (grant_vip, credit_tokens, set_age_cohort, set_nsfw_opt_in, admin
-- actions) — revoking direct client UPDATEs breaks nothing in the app.
-- Users keep updating their allowed columns (bio, avatar, username).
-- ════════════════════════════════════════════════════════════════════

REVOKE UPDATE (
  tokens_balance,
  is_vip,
  reputation_score,
  connection_tickets,
  vip_expires_at,
  nsfw_opt_in,
  age_cohort,
  is_admin,
  role
) ON profiles FROM authenticated, anon;

-- Sanity checks (SQL editor, as a normal signed-in user):
--   PATCH /rest/v1/profiles {is_admin:true}      → must be 42501
--   PATCH /rest/v1/profiles {tokens_balance:1e9} → must be 42501
--   PATCH /rest/v1/profiles {bio:"hi"}           → must still work
