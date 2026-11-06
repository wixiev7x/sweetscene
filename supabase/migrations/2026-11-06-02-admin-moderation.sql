-- ════════════════════════════════════════════════════════════════════
-- Phase 4 — Admin panel: roles, typed bans (temp/permanent/shadow),
-- token_version, report targets, audit-log coverage, dashboard stats.
--
-- Idempotent + additive. Safe to run on:
--   * a fresh replay of lib/supabase/schema.sql (repo columns), and
--   * the live staging DB (which already has profiles.role,
--     profiles.ban_reason/banned_at, bans.moderator_id/created_at and
--     reports.target_type/target_id — the ADD COLUMN IF NOT EXISTS /
--     CREATE OR REPLACE statements no-op or supersede cleanly).
--
-- Canonical shapes AFTER this migration (legacy divergent columns are
-- left in place but no longer written by app code):
--   profiles.role          'user' | 'moderator' | 'admin'
--                          (existing 'super_admin' maps to 'admin')
--   profiles.token_version int, bumped on hard bans (temp/permanent)
--   bans.moderator_id      who created the ban (was banned_by)
--   bans.banned_at         when it was created
--   bans.type              'temp' | 'permanent' | 'shadow'
--   bans.appeal_state      'none' | 'pending' | 'granted' | 'denied'
--   reports.target_user_id the reported user (other match participant)
--
-- Enforcement model:
--   temp/permanent → profiles.is_banned + token_version++ (the app
--     layer additionally calls auth.admin signOut for immediate
--     revocation) + /banned page via proxy redirect.
--   shadow         → NO profile flags, NO sign-out. The messages
--     SELECT policy below filters the user's messages out of other
--     people's views (reads + realtime). The user notices nothing.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. profiles: role, token_version, ban_reason/banned_at ──

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Backfill: is_admin stays the source of truth for the admin tier;
-- reflect it into role so one column can drive both tiers.
UPDATE profiles
   SET role = 'admin'
 WHERE is_admin = true
   AND COALESCE(role, 'user') IN ('user', '');

-- ── 2. Role helpers ──

-- Effective role of ANY user. Internal only (not granted to anon or
-- authenticated — callers must not be able to probe other users'
-- staff status directly).
CREATE OR REPLACE FUNCTION public.get_effective_role(p_uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE((SELECT is_admin FROM profiles WHERE id = p_uid), false)
      THEN 'admin'
    WHEN (SELECT role FROM profiles WHERE id = p_uid) IN ('admin', 'super_admin')
      THEN 'admin'
    WHEN (SELECT role FROM profiles WHERE id = p_uid) = 'moderator'
      THEN 'moderator'
    ELSE 'user'
  END;
$$;

REVOKE EXECUTE ON FUNCTION get_effective_role(UUID) FROM PUBLIC, anon, authenticated;

-- Scalar gate: moderator tier OR admin. Used by the /admin layout and
-- the report/moderation server actions.
CREATE OR REPLACE FUNCTION public.assert_current_user_mod()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT get_effective_role(auth.uid()) IN ('moderator', 'admin');
$$;

REVOKE EXECUTE ON FUNCTION assert_current_user_mod() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION assert_current_user_mod() TO authenticated;

-- Own-role introspection for the admin UI (returns the caller's own
-- role only — no cross-user leak).
CREATE OR REPLACE FUNCTION public.get_my_admin_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT get_effective_role(auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION get_my_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_admin_role() TO authenticated;

-- ── 3. bans: typed bans + moderator_id + appeal_state ──

ALTER TABLE bans ADD COLUMN IF NOT EXISTS moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE bans ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS appeal_state TEXT NOT NULL DEFAULT 'none';

-- Backfill type from the old implicit convention (NULL expiry =
-- permanent).
UPDATE bans
   SET type = CASE WHEN expires_at IS NULL THEN 'permanent' ELSE 'temp' END
 WHERE type IS NULL;

ALTER TABLE bans ALTER COLUMN type SET NOT NULL;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bans_type_check') THEN
    ALTER TABLE bans ADD CONSTRAINT bans_type_check
      CHECK (type IN ('temp', 'permanent', 'shadow'));
  END IF;
END
$do$;

-- Legacy banned_by column (NOT NULL in the base schema, no default) is
-- superseded by moderator_id. New inserts never set it, so it must be
-- nullable wherever it still exists.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bans' AND column_name = 'banned_by'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bans ALTER COLUMN banned_by DROP NOT NULL;
  END IF;
END
$do$;

-- ── 4. Shadowban helper ──
-- Internal only: used by the messages SELECT policy, admin RPCs and
-- service-role actions. NOT granted to anon/authenticated so a
-- shadowbanned user cannot probe their own state via the REST API.

CREATE OR REPLACE FUNCTION public.user_is_shadowbanned(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM bans
    WHERE user_id = p_uid
      AND type = 'shadow'
      AND active = true
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION user_is_shadowbanned(UUID) FROM PUBLIC, anon, authenticated;

-- ── 5. messages SELECT policy: shadowban filter ──
-- Participants can still read every message they are party to, and a
-- shadowbanned user still sees their OWN messages (the point is that
-- they notice nothing) — but their messages are invisible to everyone
-- else. Supabase realtime evaluates the SELECT policy too, so live
-- INSERTs from a shadowbanned sender never reach the other
-- participant's subscription.
--
-- RLS policies evaluate as the REQUESTING role (authenticated), but
-- user_is_shadowbanned must stay ungrantable to authenticated (a
-- shadowbanned user must not be able to probe their own state via
-- /rest/v1/rpc). The policy therefore calls this SECURITY DEFINER
-- wrapper instead. Probe shield: it only answers for the caller's own
-- viewpoint (p_viewer = auth.uid()); any other combination returns
-- true ("visible"), which discloses nothing.

CREATE OR REPLACE FUNCTION public.messages_participant_visible(
  p_sender UUID,
  p_viewer UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_sender IS NULL THEN true                     -- system/AI rows
    WHEN p_sender = p_viewer THEN true                  -- own messages always visible
    WHEN p_viewer IS DISTINCT FROM auth.uid() THEN true -- probe shield
    ELSE NOT public.user_is_shadowbanned(p_sender)
  END;
$$;

REVOKE EXECUTE ON FUNCTION messages_participant_visible(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION messages_participant_visible(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Participants can view match messages" ON messages;
CREATE POLICY "Participants can view match messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
    AND public.messages_participant_visible(messages.sender_id, auth.uid())
  );

-- ── 6. reports: target_user_id + participant-aware filing ──

ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- report_conversation: same participant verification as before, now
-- also records the OTHER participant as the reported user.
CREATE OR REPLACE FUNCTION report_conversation(
  p_match_id UUID,
  p_reason TEXT,
  p_evidence JSONB
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
  v_target UUID;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RETURN; END IF;

  v_target := CASE WHEN m_row.user_a = auth.uid() THEN m_row.user_b ELSE m_row.user_a END;

  INSERT INTO reports (reporter_id, match_id, target_user_id, reason, evidence_snapshot)
  VALUES (auth.uid(), p_match_id, v_target, trim(p_reason), COALESCE(p_evidence, '[]'::jsonb));

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- list_reports: adds the reported user (id + username). Guard relaxed
-- to the moderator tier — the report inbox is moderator work.
-- Phase 17 changes the returned column set (target user) — REPLACE
-- cannot alter a TABLE return type, so drop first (recreated below).
DROP FUNCTION IF EXISTS list_reports(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION list_reports(
  p_status TEXT DEFAULT 'open',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  match_id UUID,
  target_user_id UUID,
  reason TEXT,
  evidence_snapshot JSONB,
  status TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ,
  reporter_username TEXT,
  target_username TEXT
) AS $$
BEGIN
  IF NOT assert_current_user_mod() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT
    r.id, r.reporter_id, r.match_id, r.target_user_id, r.reason,
    r.evidence_snapshot, r.status, r.resolution_note, r.created_at,
    rep.anonymous_username,
    tgt.anonymous_username
  FROM reports r
  LEFT JOIN profiles rep ON rep.id = r.reporter_id
  LEFT JOIN profiles tgt ON tgt.id = r.target_user_id
  WHERE (p_status = 'all' OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_reports(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_reports(TEXT, INT, INT) TO authenticated;

-- resolve_report: now validates the resolution, fails on unknown ids
-- and writes an audit entry (coverage gap fix).
CREATE OR REPLACE FUNCTION resolve_report(
  p_report_id UUID,
  p_resolution TEXT,
  p_note TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_mod() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_resolution NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid resolution';
  END IF;

  UPDATE reports
     SET status = p_resolution,
         resolved_by = auth.uid(),
         resolved_at = now(),
         resolution_note = p_note
   WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason, metadata)
  VALUES (auth.uid(), 'resolved_report', p_report_id::text, 'report', p_note,
          jsonb_build_object('resolution', p_resolution));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION resolve_report(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION resolve_report(UUID, TEXT, TEXT) TO authenticated;

-- ── 7. Typed ban engine ──

-- Core: temp | permanent | shadow. Reason is mandatory AT THE DATABASE
-- LEVEL. Staff (admin/moderator) and self cannot be banned. Hard bans
-- (temp/permanent) bump token_version and write ban_reason/banned_at
-- so the /banned page can render. Shadow bans touch ONLY the bans
-- row — no profile flags, no sign-out, nothing the user can observe.
CREATE OR REPLACE FUNCTION ban_user_typed(
  p_user_id    UUID,
  p_type       TEXT,
  p_reason     TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_type NOT IN ('temp', 'permanent', 'shadow') THEN
    RAISE EXCEPTION 'Invalid ban type';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;

  v_target_role := get_effective_role(p_user_id);
  IF v_target_role IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Cannot ban staff';
  END IF;

  IF p_type = 'permanent' AND p_expires_at IS NOT NULL THEN
    RAISE EXCEPTION 'Permanent bans cannot have an expiry';
  END IF;

  IF p_type IN ('temp', 'shadow') AND p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'Ban expiry must be in the future';
  END IF;

  IF p_type IN ('temp', 'permanent') THEN
    UPDATE profiles
       SET is_banned = true,
           banned_until = p_expires_at,
           ban_reason = trim(p_reason),
           banned_at = now(),
           token_version = token_version + 1
     WHERE id = p_user_id;

    -- Revoke every active session at the DB layer. Deleting session
    -- rows cascades to refresh_tokens + MFA claims, and this GoTrue
    -- version validates access tokens against auth.sessions, so the
    -- user's existing tokens die immediately (verified locally:
    -- refresh grant → 400, access token → 403). Shadow bans never
    -- reach this branch — a shadowbanned user must notice nothing.
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  INSERT INTO bans (user_id, moderator_id, reason, banned_at, expires_at, active, type, appeal_state)
  VALUES (p_user_id, auth.uid(), trim(p_reason), now(), p_expires_at, true, p_type, 'none');

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason, metadata)
  VALUES (auth.uid(),
          CASE WHEN p_type = 'shadow' THEN 'shadowbanned_user' ELSE 'banned_user' END,
          p_user_id::text, 'user', trim(p_reason),
          jsonb_build_object('type', p_type, 'expires_at', p_expires_at));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION ban_user_typed(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ban_user_typed(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- Core unban: reason mandatory, clears profile flags AND deactivates
-- every active bans row (including shadow).
CREATE OR REPLACE FUNCTION unban_user_typed(
  p_user_id UUID,
  p_reason  TEXT
) RETURNS VOID AS $$
DECLARE
  v_was_shadow BOOLEAN;
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT COALESCE(bool_or(type = 'shadow'), false) INTO v_was_shadow
    FROM bans WHERE user_id = p_user_id AND active = true;

  UPDATE profiles
     SET is_banned = false,
         banned_until = NULL,
         ban_reason = NULL,
         banned_at = NULL
   WHERE id = p_user_id;

  UPDATE bans SET active = false WHERE user_id = p_user_id AND active = true;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason, metadata)
  VALUES (auth.uid(),
          CASE WHEN v_was_shadow THEN 'unshadowbanned_user' ELSE 'unbanned_user' END,
          p_user_id::text, 'user', trim(p_reason),
          jsonb_build_object('was_shadow', v_was_shadow));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION unban_user_typed(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION unban_user_typed(UUID, TEXT) TO authenticated;

-- Legacy signatures kept as thin delegates so older callers keep
-- working (and pick up the audit + typed-row behaviour for free).
CREATE OR REPLACE FUNCTION ban_user_with_reason(
  p_user_id     UUID,
  p_reason      TEXT DEFAULT '',
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM ban_user_typed(
    p_user_id,
    CASE WHEN p_expires_at IS NULL THEN 'permanent' ELSE 'temp' END,
    p_reason,
    p_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ban_user_with_reason(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION unban_user_with_reason(
  p_user_id UUID,
  p_reason  TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
  PERFORM unban_user_typed(p_user_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION unban_user_with_reason(UUID, TEXT) TO authenticated;

-- ── 8. Ban history: moderator_id, type, appeal_state ──

-- Phase 17 adds type/appeal_state columns — drop first (recreated below).
DROP FUNCTION IF EXISTS list_ban_history(UUID);

CREATE OR REPLACE FUNCTION list_ban_history(
  p_user_id UUID
) RETURNS TABLE (
  id           UUID,
  moderator_id UUID,
  reason       TEXT,
  banned_at    TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  active       BOOLEAN,
  type         TEXT,
  appeal_state TEXT
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT b.id, b.moderator_id, b.reason, b.banned_at, b.expires_at,
         b.active, b.type, b.appeal_state
    FROM bans b
   WHERE b.user_id = p_user_id
   ORDER BY b.banned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_ban_history(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_ban_history(UUID) TO authenticated;

-- ── 9. list_admin_users: + effective role, + shadowban state ──

-- Phase 17 adds role/is_shadowbanned columns — drop first (recreated below).
DROP FUNCTION IF EXISTS list_admin_users(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION list_admin_users(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  anonymous_username TEXT,
  anonymous_pfp_url TEXT,
  reputation_score INT,
  tokens_balance INT,
  is_vip BOOLEAN,
  is_admin BOOLEAN,
  is_banned BOOLEAN,
  banned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  role TEXT,
  is_shadowbanned BOOLEAN
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT
    p.id, p.anonymous_username, p.anonymous_pfp_url,
    p.reputation_score, p.tokens_balance, p.is_vip,
    p.is_admin, p.is_banned, p.banned_until, p.created_at,
    get_effective_role(p.id),
    user_is_shadowbanned(p.id)
  FROM profiles p
  WHERE p_search = '' OR p.anonymous_username ILIKE '%' || p_search || '%'
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_admin_users(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_admin_users(TEXT, INT, INT) TO authenticated;

-- ── 10. Audit coverage: grant/flag/delete now write audit rows ──

CREATE OR REPLACE FUNCTION admin_grant_tokens(
  p_user_id UUID,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_amount = 0 THEN RETURN; END IF;

  IF p_amount > 0 THEN
    UPDATE profiles SET tokens_balance = tokens_balance + p_amount WHERE id = p_user_id;
  ELSE
    UPDATE profiles
    SET tokens_balance = GREATEST(0, tokens_balance + p_amount)
    WHERE id = p_user_id;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, metadata)
  VALUES (auth.uid(), 'grant_tokens', p_user_id::text, 'user',
          jsonb_build_object('amount', p_amount));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_grant_tokens(UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION admin_grant_tokens(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION admin_set_character_flag(
  p_character_id UUID,
  p_flag TEXT,
  p_value BOOLEAN
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_flag = 'is_featured' THEN
    UPDATE characters SET is_featured = p_value WHERE id = p_character_id;
  ELSIF p_flag = 'is_hidden' THEN
    UPDATE characters SET is_hidden = p_value WHERE id = p_character_id;
  ELSE
    RAISE EXCEPTION 'Unknown flag: %', p_flag;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, metadata)
  VALUES (auth.uid(), 'set_character_flag', p_character_id::text, 'character',
          jsonb_build_object('flag', p_flag, 'value', p_value));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_set_character_flag(UUID, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION admin_set_character_flag(UUID, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION admin_delete_character(
  p_character_id UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM characters WHERE id = p_character_id;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type)
  VALUES (auth.uid(), 'deleted_character', p_character_id::text, 'character');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_delete_character(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION admin_delete_character(UUID) TO authenticated;

-- ── 11. Moderation queue: moderator tier allowed ──

CREATE OR REPLACE FUNCTION list_moderation_queue(
  p_status       TEXT DEFAULT 'pending',
  p_content_type TEXT DEFAULT '',
  p_limit        INT DEFAULT 50,
  p_offset       INT DEFAULT 0
) RETURNS TABLE (
  id            UUID,
  content_type  TEXT,
  content_id    TEXT,
  reported_by   UUID,
  reason        TEXT,
  status        TEXT,
  reviewed_by   UUID,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT assert_current_user_mod() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT mq.id, mq.content_type, mq.content_id, mq.reported_by, mq.reason,
         mq.status, mq.reviewed_by, mq.reviewed_at, mq.created_at
    FROM moderation_queue mq
   WHERE (p_status = 'all' OR mq.status = p_status)
     AND (p_content_type = '' OR mq.content_type = p_content_type)
   ORDER BY mq.created_at DESC
   LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_moderation_queue(TEXT, TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_moderation_queue(TEXT, TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION resolve_moderation_item(
  p_item_id    UUID,
  p_resolution TEXT
) RETURNS VOID AS $$
DECLARE
  v_content_type  TEXT;
  v_content_id    TEXT;
BEGIN
  IF NOT assert_current_user_mod() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_resolution NOT IN ('approved', 'removed') THEN
    RAISE EXCEPTION 'Invalid resolution';
  END IF;

  SELECT content_type, content_id INTO v_content_type, v_content_id
    FROM moderation_queue WHERE id = p_item_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or already resolved';
  END IF;

  UPDATE moderation_queue
     SET status = p_resolution,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = p_item_id;

  IF p_resolution = 'removed' THEN
    IF v_content_type = 'character' THEN
      UPDATE characters SET is_hidden = true WHERE id = v_content_id::uuid;
    ELSIF v_content_type = 'bot' THEN
      DELETE FROM bots WHERE id = v_content_id::uuid;
    ELSIF v_content_type = 'bounty' THEN
      DELETE FROM bounties WHERE id = v_content_id::uuid;
    ELSIF v_content_type = 'confession' THEN
      DELETE FROM confessions WHERE id = v_content_id::uuid;
    ELSIF v_content_type = 'message' THEN
      DELETE FROM messages WHERE id = v_content_id::uuid;
    END IF;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason, metadata)
  VALUES (
    auth.uid(),
    'resolved_moderation',
    p_item_id::text,
    'moderation_queue',
    p_resolution,
    jsonb_build_object('content_type', v_content_type, 'content_id', v_content_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION resolve_moderation_item(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resolve_moderation_item(UUID, TEXT) TO authenticated;

-- ── 12. Dashboard stats: signups today, DAU, oldest open report age ──

-- Phase 17 adds signups/dau/oldest-report stats — drop first (recreated below).
DROP FUNCTION IF EXISTS get_admin_stats_v2();

CREATE OR REPLACE FUNCTION get_admin_stats_v2()
RETURNS TABLE (
  open_reports        INT,
  total_reports       INT,
  total_users         INT,
  total_characters    INT,
  banned_users        INT,
  featured_characters INT,
  active_bans         INT,
  pending_moderation  INT,
  reports_last_24h    INT,
  signups_today       INT,
  dau_last_24h        INT,
  oldest_open_report_hours INT
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO open_reports FROM reports WHERE status = 'open';
  SELECT count(*) INTO total_reports FROM reports;
  SELECT count(*) INTO total_users FROM profiles WHERE is_admin = false OR is_admin IS NULL;
  SELECT count(*) INTO total_characters FROM characters;
  SELECT count(*) INTO banned_users FROM profiles WHERE is_banned = true;
  SELECT count(*) INTO featured_characters FROM characters WHERE is_featured = true;
  SELECT count(*) INTO active_bans FROM bans WHERE active = true;
  SELECT count(*) INTO pending_moderation FROM moderation_queue WHERE status = 'pending';
  SELECT count(*) INTO reports_last_24h FROM reports WHERE created_at > now() - INTERVAL '24 hours';
  SELECT count(*) INTO signups_today FROM profiles WHERE created_at >= date_trunc('day', now());
  SELECT count(*) INTO dau_last_24h FROM auth.users WHERE last_sign_in_at > now() - INTERVAL '24 hours';
  SELECT COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at))) / 3600, 0)::INT
    INTO oldest_open_report_hours
    FROM reports WHERE status = 'open';

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_admin_stats_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_stats_v2() TO authenticated;

-- ── 13. Notifications: 'admin_message' already exists in the type
-- CHECK (schema.sql Phase 7); the warn wrapper lives in the app layer
-- and inserts via the existing create_notification RPC. No DDL here.

-- ── 14. claim_match: never pair a shadow-banned user with a real one
--
-- The app-layer queue query can't express "creator is shadow-banned"
-- (PostgREST has no inline function filter), so this is the enforcement
-- point — same pattern as the cohort and block checks it extends.
-- A shadow-banned user can still OPEN a match (they must not be able to
-- tell they are shadow-banned), but nobody can ever claim it, and they
-- can never claim anyone else's. Their open row just sits in the queue
-- until it goes stale; they experience eternal "waiting for a partner".
-- Two shadow-banned users are also never paired with each other (both
-- guards apply) — harmless either way, but consistent.
CREATE OR REPLACE FUNCTION claim_match(p_match_id UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
  RETURN QUERY
  UPDATE matches
  SET user_b = auth.uid(),
      shared_pool = matches.shared_pool * 2,
      last_activity = now()
  WHERE matches.id = p_match_id
    AND matches.user_b IS NULL
    AND matches.status = 'active'
    AND matches.user_a <> auth.uid()
    -- Refuse a join from a different age cohort.
    AND matches.cohort = COALESCE(
      (SELECT age_cohort FROM profiles WHERE profiles.id = auth.uid()), 'minor')
    -- Refuse if either user has blocked the other.
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks
      WHERE (user_blocks.blocker_id = auth.uid()
             AND user_blocks.blocked_id = matches.user_a)
         OR (user_blocks.blocker_id = matches.user_a
             AND user_blocks.blocked_id = auth.uid())
    )
    -- Phase 17: refuse if either party is shadow-banned.
    AND NOT public.user_is_shadowbanned(matches.user_a)
    AND NOT public.user_is_shadowbanned(auth.uid())
  RETURNING matches.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 15. send_human_message: enforce bans at the DB layer ──
--
-- Pre-existing gap found during Phase 4 verification: this SECURITY
-- DEFINER RPC bypasses the messages INSERT policy (whose WITH CHECK
-- includes NOT is_current_user_banned()), and the app sends messages
-- exclusively through this RPC — so the policy's ban check never ran
-- on the real send path. The TS guard (assertNotBanned in
-- messages.ts) was the only enforcement. This restores DB-layer
-- enforcement: a banned user calling the RPC directly (REST) gets the
-- same soft no-op as every other guard in this function, instead of
-- a message insert. Shadow-banned users are deliberately NOT blocked
-- here — they must experience the site normally; the SELECT policy
-- and claim_match hide their output instead.
CREATE OR REPLACE FUNCTION send_human_message(
  p_match_id UUID,
  p_encrypted_content TEXT
) RETURNS TABLE (
  success BOOLEAN,
  message_id UUID,
  human_message_count INT,
  ai_turn_due BOOLEAN
) AS $$
DECLARE
  m_row matches%ROWTYPE;
  msg_id UUID;
  new_count INT;
  should_ai BOOLEAN;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;
  IF m_row.ai_turn_due = true THEN RETURN; END IF;
  -- Phase 17: hard-banned users cannot send, even calling the RPC
  -- directly. Soft return, matching the guards above.
  IF public.is_current_user_banned() THEN RETURN; END IF;

  new_count := m_row.human_message_count + 1;
  should_ai := new_count >= m_row.ai_interval;

  INSERT INTO messages (match_id, sender_type, sender_id, character_id, content, tokens_used)
  VALUES (p_match_id, 'human', auth.uid(), NULL, p_encrypted_content, 0)
  RETURNING id INTO msg_id;

  UPDATE matches
  SET human_message_count = new_count,
      ai_turn_due = should_ai,
      last_human_message_at = now(),
      last_activity = now()
  WHERE id = p_match_id;

  RETURN QUERY SELECT true, msg_id, new_count, should_ai;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 16. send_human_message must be executable by authenticated ──
--
-- Found during Phase 4 verification: the base schema's dynamic grant
-- allowlist does NOT include send_human_message, yet the app calls it
-- with the user's client (lib/actions/messages.ts sendMessage) — the
-- live databases evidently carry this grant out-of-band. Fresh replays
-- (and the local stack) must match: without it every message send
-- fails with permission denied.
GRANT EXECUTE ON FUNCTION send_human_message(UUID, TEXT) TO authenticated;

-- ── 17. list_audit_log: accept "all" (and NULL) as no-filter ──
--
-- Pre-existing bug found during Phase 4 verification: the base version
-- treats only '' as no-filter, but the admin UI's "All" chip passes
-- 'all' (lib/actions/admin.ts listAuditLog passes the filter through
-- verbatim) — so the default audit view has always rendered empty.
-- Drop first: the base carries parameter defaults that CREATE OR
-- REPLACE cannot remove.
DROP FUNCTION IF EXISTS list_audit_log(TEXT, INT, INT);
CREATE OR REPLACE FUNCTION list_audit_log(
  p_action TEXT,
  p_limit  INT,
  p_offset INT
) RETURNS TABLE (
  id         UUID,
  admin_id   UUID,
  action     TEXT,
  target_id  TEXT,
  target_type TEXT,
  reason     TEXT,
  metadata   JSONB,
  occurred_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT al.id, al.admin_id, al.action, al.target_id, al.target_type, al.reason,
         al.metadata, al.occurred_at
    FROM admin_audit_log al
   WHERE (p_action IS NULL OR p_action IN ('', 'all') OR al.action = p_action)
   ORDER BY al.occurred_at DESC
   LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_audit_log(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_audit_log(TEXT, INT, INT) TO authenticated;
