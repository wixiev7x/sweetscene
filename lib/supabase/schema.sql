-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_username TEXT NOT NULL,
  anonymous_pfp_url TEXT,
  reputation_score INT DEFAULT 100,
  tokens_balance INT DEFAULT 10000,
  is_vip BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, anonymous_username)
  VALUES (
    NEW.id,
    'Anon_' || upper(substring(replace(NEW.id::text, '-', ''), 1, 6))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- characters table
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  system_prompt TEXT,
  is_public BOOLEAN DEFAULT false,
  scenario_tags TEXT[] NOT NULL DEFAULT '{}',
  is_nsfw BOOLEAN DEFAULT false,
  -- Phase 2: Janitor/SpicyChat parity fields
  personality TEXT[] NOT NULL DEFAULT '{}',
  first_message TEXT,
  example_dialog TEXT,
  alternate_greetings TEXT[] NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','unlisted','public')),
  avatar_url TEXT,
  connection_score INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_characters_visibility ON characters(visibility);
CREATE INDEX idx_characters_connection_score ON characters(connection_score DESC);

-- Keep `is_public` (legacy) in sync with the new `visibility` enum.
CREATE OR REPLACE FUNCTION sync_character_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visibility = 'public' THEN
    NEW.is_public := true;
  ELSE
    NEW.is_public := false;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER characters_visibility_sync
  BEFORE INSERT OR UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION sync_character_visibility();

-- RLS for characters
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public or own characters"
  ON characters FOR SELECT
  USING (is_public = true OR creator_id = auth.uid());

CREATE POLICY "Users can insert own characters"
  ON characters FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can update own characters"
  ON characters FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can delete own characters"
  ON characters FOR DELETE
  USING (creator_id = auth.uid());

-- matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_ai_match BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'revealed')),
  tier TEXT NOT NULL DEFAULT 'quick' CHECK (tier IN ('quick', 'deep')),
  scenario_tags TEXT[] NOT NULL DEFAULT '{}',
  shared_pool INT NOT NULL DEFAULT 2000,
  human_message_count INT NOT NULL DEFAULT 0,
  ai_turn_due BOOLEAN NOT NULL DEFAULT false,
  character_ids UUID[] NOT NULL DEFAULT '{}',
  ai_interval INT NOT NULL DEFAULT 6,
  -- dual-consent reveal columns
  user_a_revealed BOOLEAN NOT NULL DEFAULT false,
  user_b_revealed BOOLEAN NOT NULL DEFAULT false,
  user_a_moved_on BOOLEAN NOT NULL DEFAULT false,
  user_b_moved_on BOOLEAN NOT NULL DEFAULT false,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);

-- RLS for matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Participants can view their own matches, and waiting matches
-- (user_b IS NULL) are visible so matchmaking can find a partner.
CREATE POLICY "Participants and waiting matches can be viewed"
  ON matches FOR SELECT
  USING (
    user_a = auth.uid()
    OR user_b = auth.uid()
    OR (user_b IS NULL AND status = 'active')
  );

CREATE POLICY "Participants can update matches"
  ON matches FOR UPDATE
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- Atomic, race-safe join for a waiting match. Doubles the shared
-- pool (user_b contributes their half) and records who joined.
-- Returns the claimed match id, or an empty set if the claim failed.
CREATE OR REPLACE FUNCTION claim_match(p_match_id UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
  UPDATE matches m
  SET user_b = auth.uid(),
      shared_pool = m.shared_pool * 2,
      last_activity = now()
  WHERE m.id = p_match_id
    AND m.user_b IS NULL
    AND m.status = 'active'
    AND m.user_a <> auth.uid()
  RETURNING m.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- reveal columns can store who chose to reveal during FadeToBlack
CREATE OR REPLACE FUNCTION reveal_self(p_match_id UUID)
RETURNS TABLE(
  own_revealed BOOLEAN,
  partner_revealed BOOLEAN,
  partner_moved_on BOOLEAN,
  status TEXT
) AS $$
DECLARE
  m_row matches%ROWTYPE;
  is_a BOOLEAN;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  is_a := (m_row.user_a = auth.uid());

  IF is_a IS NULL THEN
    RETURN;
  END IF;

  IF is_a THEN
    UPDATE matches
    SET user_a_revealed = true,
        user_b_moved_on = COALESCE(user_b_moved_on, false),
        last_activity = now()
    WHERE id = p_match_id
      AND user_a = auth.uid();
  ELSE
    IF m_row.user_b <> auth.uid() THEN
      RETURN;
    END IF;

    UPDATE matches
    SET user_b_revealed = true,
        user_a_moved_on = COALESCE(user_a_moved_on, false),
        last_activity = now()
    WHERE id = p_match_id
      AND user_b = auth.uid();
  END IF;

  SELECT * INTO m_row FROM matches WHERE id = p_match_id;

  IF m_row.user_a_revealed AND m_row.user_b_revealed THEN
    UPDATE matches
    SET status = 'revealed', last_activity = now()
    WHERE id = p_match_id;
    m_row.status := 'revealed';
  END IF;

  RETURN QUERY
  SELECT
    (CASE WHEN is_a THEN m_row.user_a_revealed ELSE m_row.user_b_revealed END),
    (CASE WHEN is_a THEN m_row.user_b_revealed ELSE m_row.user_a_revealed END),
    (CASE WHEN is_a THEN m_row.user_b_moved_on ELSE m_row.user_a_moved_on END),
    m_row.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- mark that the caller chose to move on instead of revealing
CREATE OR REPLACE FUNCTION move_on(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
  m_row matches%ROWTYPE;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF m_row.user_a = auth.uid() THEN
    UPDATE matches SET user_a_moved_on = true, last_activity = now()
    WHERE id = p_match_id;
  ELSIF m_row.user_b = auth.uid() THEN
    UPDATE matches SET user_b_moved_on = true, last_activity = now()
    WHERE id = p_match_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Snapshot of a character's prompt at match-creation time. Editing a
-- character after the match starts must NOT change the in-flight scene,
-- so we freeze the relevant fields here. Participants-only RLS.
CREATE TABLE match_characters_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  personality TEXT[] NOT NULL DEFAULT '{}',
  first_message TEXT,
  system_prompt TEXT NOT NULL,
  is_nsfw BOOLEAN NOT NULL DEFAULT false,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_match_chars_match_id ON match_characters_snapshot(match_id);

ALTER TABLE match_characters_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match participants can view their snapshots"
  ON match_characters_snapshot FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_characters_snapshot.match_id
      AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
  ));

-- messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('human', 'ai')),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- RLS for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view match messages"
  ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM matches m WHERE m.id = messages.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));

CREATE POLICY "Participants can insert human messages"
  ON messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM matches m WHERE m.id = messages.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())) AND sender_type = 'human' AND sender_id = auth.uid());

-- Enable realtime for messages and matches
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- ════════════════════════════════════════════════════════════════════
-- Phase 3 — Solo play persistence + character ratings
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- No existing tables are modified.
-- ════════════════════════════════════════════════════════════════════

-- solo_sessions table — persisted 1-on-1 chats between a user and a
-- single AI character. messages JSONB holds an array of
-- {role:'user'|'assistant', content, created_at} entries, capped at
-- 50 on write by the app layer to bound JSONB size. is_waiting is
-- reserved for Phase 4's play-while-waiting feature (free waiting-room
-- chat spawned during matchmaking).
CREATE TABLE solo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL,
  is_waiting BOOLEAN NOT NULL DEFAULT false,
  messages JSONB NOT NULL DEFAULT '[]',
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_solo_sessions_user_id ON solo_sessions(user_id);
CREATE INDEX idx_solo_sessions_character_id ON solo_sessions(character_id);

-- Keep updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION touch_solo_session()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER solo_sessions_touch
  BEFORE UPDATE ON solo_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_solo_session();

-- RLS: owner-only across the board.
ALTER TABLE solo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own solo sessions"
  ON solo_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owner can insert own solo sessions"
  ON solo_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can update own solo sessions"
  ON solo_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can delete own solo sessions"
  ON solo_sessions FOR DELETE
  USING (user_id = auth.uid());

-- character_ratings table — one thumbs-up / thumbs-down per
-- (character, user). UNIQUE index enforces one rating each. The
-- touch_connection_score trigger recalculates characters.connection_score
-- = count(liked = true) on every change.
CREATE TABLE character_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  liked BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One rating per (character, user) — upserts use this as the conflict
-- target.
CREATE UNIQUE INDEX idx_character_ratings_unique
  ON character_ratings(character_id, user_id);

-- Recalculates connection_score after any rating change. SECURITY
-- DEFINER because the rater doesn't own the characters row and RLS
-- would otherwise block the UPDATE.
CREATE OR REPLACE FUNCTION touch_connection_score()
RETURNS TRIGGER AS $$
DECLARE
  char_id TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    char_id := OLD.character_id;
  ELSE
    char_id := NEW.character_id;
  END IF;

  IF char_id IS NOT NULL THEN
    -- Only updates rows that exist (JSON-default character IDs like
    -- "maid-001" simply match no row — a harmless no-op).
    UPDATE characters
    SET connection_score = (
      SELECT COUNT(*)::int FROM character_ratings
      WHERE character_id = char_id AND liked = true
    )
    WHERE id::text = char_id;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER character_ratings_touch_score
  AFTER INSERT OR UPDATE OR DELETE ON character_ratings
  FOR EACH ROW EXECUTE FUNCTION touch_connection_score();

-- RLS: users can rate and read only their own ratings.
ALTER TABLE character_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own character ratings"
  ON character_ratings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own character ratings"
  ON character_ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own character ratings"
  ON character_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own character ratings"
  ON character_ratings FOR DELETE
  USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- Phase 4 — Presence, AFK kick, and anonymous partner view
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- Track when the last human message was sent in a match. Used by
-- Phase 5's silence-nudge trigger and Phase 4's AFK kick cron.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_human_message_at TIMESTAMPTZ;

-- ── AFK kick ──
-- Ends matches that have been idle (no heartbeat / no activity) for
-- more than 90 seconds. Runs every minute via pg_cron. The UPDATE
-- propagates through Realtime so both clients see FadeToBlack.
CREATE OR REPLACE FUNCTION kick_idle_matches()
RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET status = 'ended',
      ended_at = now()
  WHERE status = 'active'
    AND now() - last_activity > INTERVAL '90 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the kick (Supabase ships pg_cron enabled by default).
-- Idempotent: uses job_name so re-running won't create duplicates.
-- The outer block is tagged $do$ because the scheduled command is
-- itself a string; a bare $$ here would close the DO block early and
-- the file would not parse at all.
DO $do$
BEGIN
  -- pg_cron is available on Supabase but is NOT enabled on a new
  -- project until someone turns it on. Skip rather than hard-fail so
  -- a fresh install of this file succeeds; the AFK kick is a
  -- background nicety, not a correctness requirement.
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - skipping sweetscene_afk_kick schedule';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sweetscene_afk_kick'
  ) THEN
    PERFORM cron.schedule(
      'sweetscene_afk_kick',
      '* * * * *',
      'SELECT kick_idle_matches();'
    );
  END IF;
END
$do$;

-- ── Anonymous match_partners view ──
-- Given a match row and the calling user (auth.uid()), returns the
-- OTHER participant's anonymous_username and anonymous_avatar_url.
-- reputation_tier is NULL until Phase 6 adds the column. RLS on the
-- underlying matches table already restricts who can see the row.
-- CREATE OR REPLACE VIEW cannot rename an existing column; the
-- hashed definition renames partner_id -> partner_id_hash.
DROP VIEW IF EXISTS match_partners;
CREATE VIEW match_partners AS
SELECT
  m.id AS match_id,
  auth.uid() AS viewer_id,
  CASE
    WHEN m.user_a = auth.uid() THEN m.user_b
    ELSE m.user_a
  END AS partner_id,
  p.anonymous_username AS partner_username,
  p.anonymous_pfp_url AS partner_avatar_url,
  NULL::TEXT AS reputation_tier
FROM matches m
JOIN profiles p ON p.id = (
  CASE
    WHEN m.user_a = auth.uid() THEN m.user_b
    ELSE m.user_a
  END
)
WHERE m.user_a = auth.uid() OR m.user_b = auth.uid();

-- ════════════════════════════════════════════════════════════════════
-- Phase 4.5 — Privacy: message encryption, reports, system_prompt lockdown
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── system_prompt column-level security ──
-- The secret anti-injection wrapper in characters.system_prompt must
-- NEVER be readable by authenticated users via direct client queries.
-- Only the service_role (server-side admin client) can SELECT it.
-- Server actions read it via the service-role client in
-- lib/supabase/server-admin.ts — never via the user's session.
REVOKE SELECT (system_prompt) ON characters FROM authenticated;
REVOKE SELECT (system_prompt) ON characters FROM anon;
GRANT SELECT (system_prompt) ON characters TO service_role;

-- Same lockdown for the match_characters_snapshot table.
REVOKE SELECT (system_prompt) ON match_characters_snapshot FROM authenticated;
REVOKE SELECT (system_prompt) ON match_characters_snapshot FROM anon;
GRANT SELECT (system_prompt) ON match_characters_snapshot TO service_role;

-- ── Reports table ──
-- When a user reports a conversation, the server action decrypts all
-- messages in the match and stores them as an evidence_snapshot. Only
-- the service_role (admin) can read reports — no SELECT policy for
-- authenticated means RLS blocks them entirely.
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_snapshot JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_match_id ON reports(match_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can only INSERT reports (file a report). They can never read
-- reports — not even their own. Only the service_role (admin) can,
-- and service_role bypasses RLS entirely.
CREATE POLICY "Users can file reports"
  ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- Phase 5 — Security hardening: column-level lockdown + RLS tightening
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── profiles: restrict UPDATE to safe columns only ──
-- Users can update their own anonymous_username and anonymous_pfp_url.
-- They CANNOT update tokens_balance, is_vip, or reputation_score —
-- those are managed exclusively by server-side RPCs / triggers with
-- the service_role. Prevents self-granting VIP or unlimited tokens.
REVOKE UPDATE (tokens_balance, is_vip, reputation_score) ON profiles FROM authenticated;
REVOKE UPDATE (tokens_balance, is_vip, reputation_score) ON profiles FROM anon;
REVOKE SELECT (tokens_balance, is_vip) ON profiles FROM authenticated;
REVOKE SELECT (tokens_balance, is_vip) ON profiles FROM anon;

-- Grant SELECT on tokens_balance + is_vip only to the profile owner
-- via a SECURITY DEFINER function (the owner still needs to see their
-- own balance). Non-owners get NULL for these columns.
CREATE OR REPLACE FUNCTION get_own_tokens_balance()
RETURNS TABLE (tokens_balance INT, is_vip BOOLEAN) AS $$
BEGIN
  RETURN QUERY SELECT p.tokens_balance, p.is_vip FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── matches: restrict UPDATE to last_activity only ──
-- Participants can update last_activity (heartbeat) and nothing else.
-- All other columns (shared_pool, status, human_message_count,
-- ai_turn_due, reveal flags, user_b) are managed by SECURITY DEFINER
-- RPCs only. This closes the token-pool cheat, fake-reveal, and
-- counter manipulation holes.
DROP POLICY IF EXISTS "Participants can update matches" ON matches;
CREATE POLICY "Participants can update last_activity only"
  ON matches FOR UPDATE
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

-- ── Rolling story summary cache (AI director tuning) ──
-- Declared here, ahead of the REVOKE below, because that REVOKE names
-- context_summary in its column list. Adding the column later would
-- make the REVOKE fail with "column does not exist" on a fresh
-- database and abort the whole migration.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS context_summary TEXT;

-- Revoke UPDATE on all match columns except last_activity. The user
-- can still SET last_activity (not revoked) but cannot SET any
-- sensitive column — Postgres rejects the statement entirely.
REVOKE UPDATE (id, user_a, user_b, is_ai_match, status, tier, scenario_tags,
  shared_pool, human_message_count, ai_turn_due, character_ids, ai_interval,
  user_a_revealed, user_b_revealed, user_a_moved_on, user_b_moved_on,
  context_summary, created_at, ended_at) ON matches FROM authenticated;
REVOKE UPDATE (id, user_a, user_b, is_ai_match, status, tier, scenario_tags,
  shared_pool, human_message_count, ai_turn_due, character_ids, ai_interval,
  user_a_revealed, user_b_revealed, user_a_moved_on, user_b_moved_on,
  context_summary, created_at, ended_at) ON matches FROM anon;

-- ── messages: require match.status = 'active' for INSERT ──
-- Messages can only be inserted into active (or revealed for DMs)
-- matches. Prevents inserting into ended matches.
DROP POLICY IF EXISTS "Participants can insert human messages" ON messages;
CREATE POLICY "Participants can insert human messages into active matches"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        AND (m.status = 'active' OR m.status = 'revealed')
    )
    AND sender_type = 'human'
    AND sender_id = auth.uid()
  );

-- ── Atomic token deduction (closes TOCTOU double-spend) ──
-- Atomically decrements the caller's tokens_balance by `amount` only
-- if the balance is sufficient. Returns the new balance, or NULL if
-- insufficient. Called from findMatch / createAIMatch server actions
-- instead of the read-check-write pattern that raced.
CREATE OR REPLACE FUNCTION deduct_tokens(p_amount INT)
RETURNS TABLE (new_balance INT) AS $$
BEGIN
  UPDATE profiles
  SET tokens_balance = tokens_balance - p_amount
  WHERE id = auth.uid() AND tokens_balance >= p_amount
  RETURNING profiles.tokens_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Atomic human message counter + AI turn trigger ──
-- Atomically increments human_message_count, flips ai_turn_due when the
-- threshold is met, and updates last_human_message_at + last_activity.
-- All conditions checked in a single UPDATE — no race window. Returns
-- the new count and whether an AI turn is now due.
-- Caller must be a participant; match must be active; ai_turn_due must
-- be false (no concurrent AI turn). Returns NULL if any check fails.
CREATE OR REPLACE FUNCTION append_human_message(p_match_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  human_message_count INT,
  ai_turn_due BOOLEAN
) AS $$
DECLARE
  m_row   matches%ROWTYPE;
  v_count INT;
  v_due   BOOLEAN;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;
  IF m_row.ai_turn_due = true THEN RETURN; END IF;

  -- Counters come back from the UPDATE itself. A follow-up
  -- `SELECT human_message_count, ai_turn_due INTO m_row` cannot work:
  -- INTO a %ROWTYPE variable requires the select list to match the
  -- row type structurally, so a two-column select into a 21-column
  -- rowtype fails at runtime on every call. Scalars, and RETURNING,
  -- also close the gap where a concurrent turn lands between the
  -- UPDATE and a re-read.
  UPDATE matches
  SET human_message_count = matches.human_message_count + 1,
      ai_turn_due = (matches.human_message_count + 1 >= matches.ai_interval),
      last_human_message_at = now(),
      last_activity = now()
  WHERE id = p_match_id
  RETURNING matches.human_message_count, matches.ai_turn_due
  INTO v_count, v_due;

  RETURN QUERY SELECT true, v_count, v_due;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Atomic AI turn claim (prevents double-fire) ──
-- Atomically flips ai_turn_due from true to false. Returns the
-- shared_pool at the moment of the claim so the caller knows how much
-- budget remains. If ai_turn_due is already false (another caller won
-- the race), returns NULL — the caller should abort.
CREATE OR REPLACE FUNCTION claim_ai_turn(p_match_id UUID)
RETURNS TABLE (shared_pool INT) AS $$
DECLARE
  m_row matches%ROWTYPE;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;
  IF m_row.ai_turn_due = false THEN RETURN; END IF;

  UPDATE matches
  SET ai_turn_due = false
  WHERE id = p_match_id;

  RETURN QUERY SELECT m_row.shared_pool;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Update profile username (column-restricted) ──
-- Since tokens_balance/is_vip/reputation_score are REVOKE'd from
-- UPDATE, users need a safe RPC to update their username without
-- the risk of accidentally (or intentionally) touching other columns.
CREATE OR REPLACE FUNCTION update_profile_username(p_username TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET anonymous_username = p_username
  WHERE id = auth.uid()
    AND length(p_username) >= 2
    AND length(p_username) <= 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════
-- Phase 5a — Application/RPC reconciliation
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- Closes C1-C6, H1, H2, H5-H7, M1, M2, M5, M6, M8, M9, S17, B1-B6.
-- ════════════════════════════════════════════════════════════════════

-- ── get_own_profile: replace client SELECT * on profiles ──
-- After the REVOKE on (tokens_balance, is_vip) from authenticated,
-- a client SELECT * returns NULL for those columns. This RPC returns
-- the caller's full row (SECURITY DEFINER bypasses column REVOKE).
-- CREATE OR REPLACE cannot change a function's return type, and each
-- redefinition below widens the column list. Drop first.
DROP FUNCTION IF EXISTS get_own_profile();
CREATE OR REPLACE FUNCTION get_own_profile()
RETURNS TABLE (
  id UUID,
  anonymous_username TEXT,
  anonymous_pfp_url TEXT,
  reputation_score INT,
  tokens_balance INT,
  is_vip BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.anonymous_username, p.anonymous_pfp_url,
         p.reputation_score, p.tokens_balance, p.is_vip, p.created_at
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── send_human_message: atomic INSERT + counter + ai_turn_due ──
-- Replaces the two-step client INSERT + client matches.update that
-- raced (M2) and allowed arbitrary column writes (C1). Combines
-- message insertion, counter increment, and ai_turn_due flip in one
-- transaction. Verifies participant + status='active' + ai_turn_due
-- is false (prevents spamming during AI turns — H1). Returns the new
-- message id, human_message_count, and ai_turn_due so the client can
-- update its optimistic state without any DB write.
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

-- ── apply_ai_turn: atomic AI message INSERT + match update ──
-- After claim_ai_turn atomically flips ai_turn_due to false, the
-- server action generates the AI response, encrypts it, and calls
-- this RPC to insert the message + update the match (pool, counter,
-- status) in one transaction. Closes C5/H6 double-fire and the
-- server-side UPDATE-after-REVOKE break. p_end_match flips status to
-- 'ended' when the pool is exhausted.
CREATE OR REPLACE FUNCTION apply_ai_turn(
  p_match_id UUID,
  p_encrypted_text TEXT,
  p_character_id UUID,
  p_tokens_used INT,
  p_caller_id UUID
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
  new_pool INT;
  end_match BOOLEAN;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> p_caller_id AND m_row.user_b <> p_caller_id THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;

  new_pool := m_row.shared_pool - p_tokens_used;
  end_match := new_pool <= 0;

  INSERT INTO messages (match_id, sender_type, sender_id, character_id, content, tokens_used)
  VALUES (p_match_id, 'ai', NULL, p_character_id, p_encrypted_text, p_tokens_used);

  UPDATE matches
  SET ai_turn_due = false,
      human_message_count = 0,
      shared_pool = new_pool,
      last_activity = now(),
      status = CASE WHEN end_match THEN 'ended' ELSE status END,
      ended_at = CASE WHEN end_match THEN now() ELSE ended_at END
  WHERE id = p_match_id;

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F1/F2/F3 fix: restrict apply_ai_turn, add_tokens, unclaim_match to
-- service_role only. These RPCs take caller-supplied IDs/amounts and
-- MUST NOT be callable by authenticated users via supabase.rpc().
-- The server actions call them via the admin (service-role) client.
REVOKE EXECUTE ON FUNCTION apply_ai_turn(UUID, TEXT, UUID, INT, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION apply_ai_turn(UUID, TEXT, UUID, INT, UUID) FROM anon;

-- ── request_direct_turn: flip ai_turn_due for @character addressing ──
-- Called when a human message directly addresses a character by name
-- (e.g., "@Director, what do you think?"). Flips ai_turn_due to true
-- only if the match is active and no AI turn is already pending.
CREATE OR REPLACE FUNCTION request_direct_turn(p_match_id UUID)
RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;
  IF m_row.ai_turn_due = true THEN RETURN; END IF;

  UPDATE matches SET ai_turn_due = true, last_activity = now()
  WHERE id = p_match_id;

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── request_ai_nudge: silence-nudge after 15s of inactivity ──
-- Flips ai_turn_due to true ONLY if no human message has been sent in
-- the last 15 seconds. Prevents the AI from nudging while conversation
-- is still flowing. Server-side gated so the client can't force-spam.
CREATE OR REPLACE FUNCTION request_ai_nudge(p_match_id UUID)
RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;
  IF m_row.ai_turn_due = true THEN RETURN; END IF;
  IF m_row.last_human_message_at IS NULL THEN RETURN; END IF;
  IF now() - m_row.last_human_message_at < INTERVAL '15 seconds' THEN RETURN; END IF;

  UPDATE matches SET ai_turn_due = true, last_activity = now()
  WHERE id = p_match_id;

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── report_conversation: verify participant before filing report ──
-- Closes M5 (reportConversation accepted any matchId). Verifies the
-- caller is a participant of the match before inserting the report.
CREATE OR REPLACE FUNCTION report_conversation(
  p_match_id UUID,
  p_reason TEXT,
  p_evidence JSONB
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
  evidence_capped JSONB;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RETURN; END IF;

  evidence_capped := COALESCE(p_evidence, '[]'::jsonb);

  INSERT INTO reports (reporter_id, match_id, reason, evidence_snapshot)
  VALUES (auth.uid(), p_match_id, trim(p_reason), evidence_capped);

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── update_solo_session: atomic messages + tokens update ──
-- After column REVOKE on solo_sessions.tokens_used and messages, the
-- owner can't directly UPDATE these columns via the client. This RPC
-- is the only write path. Verifies owner = auth.uid().
CREATE OR REPLACE FUNCTION update_solo_session(
  p_session_id UUID,
  p_messages JSONB,
  p_tokens_used INT
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE solo_sessions
  SET messages = p_messages, tokens_used = p_tokens_used
  WHERE id = p_session_id AND user_id = auth.uid();

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN QUERY SELECT rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── add_tokens: refund helper for failed match creation ──
-- Called from matchmaking server actions when a match INSERT fails
-- after tokens were already deducted. SECURITY DEFINER because the
-- action already verified the user. Takes p_user_id as parameter.
CREATE OR REPLACE FUNCTION add_tokens(p_user_id UUID, p_amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET tokens_balance = tokens_balance + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F2 fix: add_tokens is service_role-only. It accepts an arbitrary
-- user_id, so if it were callable by authenticated users, anyone could
-- give themselves unlimited tokens. The matchmaking action calls it via
-- the admin (service-role) client.
REVOKE EXECUTE ON FUNCTION add_tokens(UUID, INT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION add_tokens(UUID, INT) FROM anon;

-- ── unclaim_match: reset user_b on failed post-claim token deduction ──
-- If claim_match succeeded but deduct_tokens returned NULL (insufficient
-- funds due to a race), this resets the match back to waiting so another
-- user can claim it. Only resets if user_b is still set AND status active.
-- F3 fix: verify the caller (p_caller_id) is user_b — only the user who
-- just claimed can un-claim on their own failed deduction.
CREATE OR REPLACE FUNCTION unclaim_match(p_match_id UUID, p_caller_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET user_b = NULL, shared_pool = shared_pool / 2, last_activity = now()
  WHERE id = p_match_id
    AND user_b = p_caller_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F3 fix: unclaim_match is service_role-only (takes p_caller_id).
REVOKE EXECUTE ON FUNCTION unclaim_match(UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION unclaim_match(UUID, UUID) FROM anon;

-- ── solo_sessions column REVOKE: prevent self-resetting tokens/messages ──
-- The owner can SELECT tokens_used + messages (for display) but cannot
-- UPDATE them directly — all writes must go through update_solo_session.
-- Closes L17 (tokens_used self-reset).
REVOKE UPDATE (tokens_used, messages) ON solo_sessions FROM authenticated;
REVOKE UPDATE (tokens_used, messages) ON solo_sessions FROM anon;

-- ── Tighten messages INSERT RLS: require status IN ('active','revealed') ──
-- The 4.5/5 block already added this policy, but DROP + recreate ensures
-- idempotency. Messages can only be inserted into active (in-scene) or
-- revealed (post-reveal DM) matches. Closes M6.
DROP POLICY IF EXISTS "Participants can insert human messages" ON messages;
DROP POLICY IF EXISTS "Participants can insert human messages into active matches" ON messages;
CREATE POLICY "Participants can insert human messages into active matches"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        AND (m.status = 'active' OR m.status = 'revealed')
    )
    AND sender_type = 'human'
    AND sender_id = auth.uid()
  );

-- Note: AI messages (sender_type='ai') are inserted via the
-- apply_ai_turn SECURITY DEFINER RPC which bypasses RLS — the INSERT
-- policy above correctly allows only human messages from clients.

-- Note: The heartbeat update on matches.last_activity still works
-- post-REVOKE because last_activity is the one column NOT in the
-- REVOKE list. No touch_match_activity RPC is needed.

-- ════════════════════════════════════════════════════════════════════
-- Phase 6 — Vibe Check + reputation + smart refund
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── profiles: new columns for reputation + earned tags + tickets ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reputation_tier TEXT
  NOT NULL DEFAULT 'new'
  CHECK (reputation_tier IN ('new', 'regular', 'trusted', 'legendary'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recent_ratings JSONB
  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earned_tags TEXT[]
  NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS connection_tickets INT
  NOT NULL DEFAULT 0;

-- Revoke UPDATE/SELECT on the new sensitive columns (same pattern as
-- tokens_balance/is_vip — only the owner can read via get_own_profile,
-- only service_role RPCs can write).
REVOKE UPDATE (reputation_tier, recent_ratings, earned_tags, connection_tickets)
  ON profiles FROM authenticated;
REVOKE UPDATE (reputation_tier, recent_ratings, earned_tags, connection_tickets)
  ON profiles FROM anon;

-- ── match_ratings: one Vibe Check rating per (match, rater) ──
CREATE TABLE IF NOT EXISTS match_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vibe TEXT CHECK (vibe IN ('electric', 'warm', 'neutral', 'cold')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  reason TEXT CHECK (
    reason IN ('partner_afk', 'boring', 'i_left', 'mutual_end', 'good_end', 'instant_disconnect')
  ),
  wants_reveal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One rating per (match, rater) — upserts use this as the conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_ratings_unique
  ON match_ratings(match_id, rater_id);

CREATE INDEX IF NOT EXISTS idx_match_ratings_rater_id ON match_ratings(rater_id);

-- RLS: insert by self only, select own only.
ALTER TABLE match_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own match ratings"
  ON match_ratings FOR INSERT
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Users can view own match ratings"
  ON match_ratings FOR SELECT
  USING (rater_id = auth.uid());

CREATE POLICY "Users can update own match ratings"
  ON match_ratings FOR UPDATE
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

-- ── reputation_events: append-only audit trail ──
-- Only the service_role (admin) can read these. Users cannot.
CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_profile_id
  ON reputation_events(profile_id);

ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policy for authenticated → RLS blocks
-- all access. Only service_role (which bypasses RLS) can read/write.

-- ── recompute_tier: internal, called from submit_match_rating ──
-- Reads the last 10 match_ratings for p_profile_id, computes an
-- aggregate score (electric=+2, warm=+1, neutral=0, cold=-2), and
-- sets reputation_tier based on thresholds. Writes recent_ratings
-- JSONB for decay math. Also re-derives earned_tags from tag
-- frequency after every 5 ratings.
-- Service_role-only: NOT callable by authenticated users directly.
CREATE OR REPLACE FUNCTION recompute_tier(p_profile_id UUID)
RETURNS VOID AS $$
DECLARE
  v_count INT;
  v_score INT := 0;
  v_tier TEXT;
  v_recent JSONB;
  v_tag_counts JSONB := '{}'::jsonb;
  v_tag TEXT;
  v_top_tags TEXT[];
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM match_ratings WHERE rater_id = p_profile_id;

  -- Compute aggregate score from the last 10 ratings.
  SELECT COALESCE(SUM(
    CASE vibe
      WHEN 'electric' THEN 2
      WHEN 'warm' THEN 1
      WHEN 'neutral' THEN 0
      WHEN 'cold' THEN -2
      ELSE 0
    END
  ), 0) INTO v_score
  FROM (
    SELECT vibe FROM match_ratings
    WHERE rater_id = p_profile_id
    ORDER BY created_at DESC
    LIMIT 10
  ) recent;

  -- Tier thresholds.
  IF v_score < 5 THEN
    v_tier := 'new';
  ELSIF v_score < 15 THEN
    v_tier := 'regular';
  ELSIF v_score < 30 THEN
    v_tier := 'trusted';
  ELSE
    v_tier := 'legendary';
  END IF;

  -- Snapshot the last 10 ratings as JSONB for decay math.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vibe', vibe, 'reason', reason, 'created_at', created_at)
  ), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT vibe, reason, created_at FROM match_ratings
    WHERE rater_id = p_profile_id
    ORDER BY created_at DESC
    LIMIT 10
  ) recent;

  -- Derive earned tags from tag frequency after every 5 ratings.
  IF v_count > 0 AND v_count % 5 = 0 THEN
    v_top_tags := ARRAY[]::TEXT[];
    -- Count tag frequencies across all the user's ratings.
    FOR v_tag IN
      SELECT unnest(tags) FROM match_ratings WHERE rater_id = p_profile_id
    LOOP
      v_tag_counts := v_tag_counts || jsonb_build_object(v_tag,
        COALESCE((v_tag_counts->>v_tag)::int, 0) + 1);
    END LOOP;
    -- Top 3 tags by frequency.
    SELECT array_agg(tag ORDER BY freq DESC) INTO v_top_tags
    FROM (
      SELECT key AS tag, (value::text)::int AS freq
      FROM jsonb_each_text(v_tag_counts)
      ORDER BY freq DESC
      LIMIT 3
    ) top;
    IF v_top_tags IS NULL THEN v_top_tags := ARRAY[]::TEXT[]; END IF;
    UPDATE profiles
    SET reputation_tier = v_tier, recent_ratings = v_recent, earned_tags = v_top_tags
    WHERE id = p_profile_id;
  ELSE
    UPDATE profiles
    SET reputation_tier = v_tier, recent_ratings = v_recent
    WHERE id = p_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION recompute_tier(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION recompute_tier(UUID) FROM anon;

-- ── resolve_refund: internal, called when both ratings exist ──
-- Reads both ratings for a match and determines the refund:
--   Both mutual_end or good_end → no refund.
--   One partner_afk (wronged party) → refund 50% of their contribution.
--   Both i_left → no refund.
--   Mismatch (partner_afk vs good_end) → no refund, flag for review.
-- Logs every outcome to reputation_events.
-- Service_role-only: NOT callable by authenticated users directly.
CREATE OR REPLACE FUNCTION resolve_refund(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
  m_row matches%ROWTYPE;
  r_a match_ratings%ROWTYPE;
  r_b match_ratings%ROWTYPE;
  contribution INT;
  refund_amount INT;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- AI matches (user_b IS NULL) don't get refunds.
  IF m_row.user_b IS NULL THEN RETURN; END IF;

  SELECT * INTO r_a FROM match_ratings
    WHERE match_id = p_match_id AND rater_id = m_row.user_a;
  SELECT * INTO r_b FROM match_ratings
    WHERE match_id = p_match_id AND rater_id = m_row.user_b;

  -- Both ratings must exist. FOUND reflects only the most recent
  -- statement, so it reports on the r_b select alone -- a match where
  -- only user_b had rated would sail past this guard and refund
  -- against an all-NULL r_a. Test the rows themselves.
  IF r_a.id IS NULL OR r_b.id IS NULL THEN RETURN; END IF;

  -- Determine the initial contribution (per user = half the pool).
  contribution := m_row.shared_pool / 2;

  -- Rule: both mutual_end or good_end → no refund.
  IF (r_a.reason IN ('mutual_end', 'good_end'))
     AND (r_b.reason IN ('mutual_end', 'good_end')) THEN
    INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
    VALUES (m_row.user_a, 0, 'no_refund_both_good', p_match_id, 0),
           (m_row.user_b, 0, 'no_refund_both_good', p_match_id, 0);
    RETURN;
  END IF;

  -- Rule: both i_left → no refund.
  IF r_a.reason = 'i_left' AND r_b.reason = 'i_left' THEN
    INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
    VALUES (m_row.user_a, 0, 'no_refund_both_left', p_match_id, 0),
           (m_row.user_b, 0, 'no_refund_both_left', p_match_id, 0);
    RETURN;
  END IF;

  -- Rule: one partner_afk → refund 50% to the wronged party.
  -- The wronged party is the one who DIDN'T go AFK.
  -- If user_a says 'partner_afk' (user_b went AFK), user_b must confirm
  -- by saying 'i_left' (they agree they left). 'boring' is NOT a
  -- confirmation — treat as a mismatch and flag for review.
  IF r_a.reason = 'partner_afk' AND r_b.reason NOT IN ('partner_afk') THEN
    IF r_b.reason IN ('i_left', 'instant_disconnect') THEN
      refund_amount := contribution / 2; -- 50% of their contribution
      UPDATE profiles SET tokens_balance = tokens_balance + refund_amount
        WHERE id = m_row.user_a;
      INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
      VALUES (m_row.user_a, 0, 'refund_partner_afk', p_match_id, refund_amount),
             (m_row.user_b, -1, 'afk_kicked', p_match_id, 0);
    ELSE
      -- Mismatch — flag for review.
      INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
      VALUES (m_row.user_a, 0, 'refund_mismatch_review', p_match_id, 0),
             (m_row.user_b, 0, 'refund_mismatch_review', p_match_id, 0);
    END IF;
    RETURN;
  END IF;

  IF r_b.reason = 'partner_afk' AND r_a.reason NOT IN ('partner_afk') THEN
    IF r_a.reason IN ('i_left', 'instant_disconnect') THEN
      refund_amount := contribution / 2;
      UPDATE profiles SET tokens_balance = tokens_balance + refund_amount
        WHERE id = m_row.user_b;
      INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
      VALUES (m_row.user_b, 0, 'refund_partner_afk', p_match_id, refund_amount),
             (m_row.user_a, -1, 'afk_kicked', p_match_id, 0);
    ELSE
      INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
      VALUES (m_row.user_a, 0, 'refund_mismatch_review', p_match_id, 0),
             (m_row.user_b, 0, 'refund_mismatch_review', p_match_id, 0);
    END IF;
    RETURN;
  END IF;

  -- Default: no refund.
  INSERT INTO reputation_events (profile_id, delta, reason, match_id, amount)
  VALUES (m_row.user_a, 0, 'no_refund_default', p_match_id, 0),
         (m_row.user_b, 0, 'no_refund_default', p_match_id, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION resolve_refund(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION resolve_refund(UUID) FROM anon;

-- ── submit_match_rating: the public-facing Vibe Check action ──
-- Verifies the caller is a participant, the match is ended/revealed,
-- and no rating exists yet for this (match, rater). Inserts the
-- rating. If BOTH ratings now exist, calls recompute_tier for both
-- users and resolve_refund for the match.
CREATE OR REPLACE FUNCTION submit_match_rating(
  p_match_id UUID,
  p_vibe TEXT,
  p_tags TEXT[],
  p_reason TEXT,
  p_wants_reveal BOOLEAN
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
  existing_count INT;
  partner_id UUID;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status NOT IN ('ended', 'revealed') THEN RETURN; END IF;

  -- Already rated?
  SELECT COUNT(*) INTO existing_count
  FROM match_ratings
  WHERE match_id = p_match_id AND rater_id = auth.uid();
  IF existing_count > 0 THEN RETURN; END IF;

  -- Insert the rating.
  INSERT INTO match_ratings (match_id, rater_id, vibe, tags, reason, wants_reveal)
  VALUES (p_match_id, auth.uid(), p_vibe, p_tags, p_reason, p_wants_reveal);

  -- Determine the partner.
  partner_id := CASE WHEN m_row.user_a = auth.uid() THEN m_row.user_b ELSE m_row.user_a END;

  -- If both ratings exist, recompute tiers + resolve refund.
  SELECT COUNT(*) INTO existing_count
  FROM match_ratings WHERE match_id = p_match_id;

  IF existing_count >= 2 THEN
    -- For AI matches (user_b IS NULL), skip partner recompute.
    IF partner_id IS NOT NULL THEN
      PERFORM recompute_tier(auth.uid());
      PERFORM recompute_tier(partner_id);
    ELSE
      PERFORM recompute_tier(auth.uid());
    END IF;
    PERFORM resolve_refund(p_match_id);
  ELSE
    -- Only one rating so far — recompute the caller's tier.
    PERFORM recompute_tier(auth.uid());
  END IF;

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── end_match: internal helper to set match status to 'ended' ──
-- Called by the unmatch action. Service_role-only.
CREATE OR REPLACE FUNCTION end_match(
  p_match_id UUID,
  p_reason TEXT,
  p_caller_id UUID
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  m_row matches%ROWTYPE;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> p_caller_id AND m_row.user_b <> p_caller_id THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;

  UPDATE matches
  SET status = 'ended', ended_at = now(), last_activity = now()
  WHERE id = p_match_id;

  -- Insert a preliminary rating for the caller with the disconnect reason.
  INSERT INTO match_ratings (match_id, rater_id, vibe, tags, reason, wants_reveal)
  VALUES (p_match_id, p_caller_id, 'neutral', ARRAY[]::TEXT[], p_reason, false)
  ON CONFLICT (match_id, rater_id) DO NOTHING;

  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION end_match(UUID, TEXT, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION end_match(UUID, TEXT, UUID) FROM anon;

-- ── Update get_own_profile to include the new columns ──
-- CREATE OR REPLACE cannot change a function's return type, and each
-- redefinition below widens the column list. Drop first.
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
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.anonymous_username, p.anonymous_pfp_url,
         p.reputation_score, p.reputation_tier, p.tokens_balance,
         p.is_vip, p.recent_ratings, p.earned_tags, p.connection_tickets,
         p.created_at
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════
-- Phase 7 — DMs hardening + user blocks
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── connection_tickets column-level security ──
-- The owner can read connection_tickets via get_own_profile, but cannot
-- UPDATE it directly. Only service_role RPCs (free-tier monthly grant
-- in Phase 8, Stripe webhook in Phase 8) can modify it.
REVOKE UPDATE (connection_tickets) ON profiles FROM authenticated;
REVOKE UPDATE (connection_tickets) ON profiles FROM anon;
-- Note: UPDATE was already REVOKE'd in the Phase 6 block above, but
-- this re-asserts it for clarity since Phase 8 will write to it.

-- ── messages SELECT RLS: tighten to revealed-only for DM access ──
-- The existing SELECT policy allows participants of any match to read
-- all messages. For DM rooms (revealed matches), this is correct —
-- both participants can read. For active (in-scene) matches, the chat
-- page reads via getMatchMessages server action (decrypts server-side)
-- — direct client SELECT only returns ciphertext, so the policy is
-- safe. We keep the existing SELECT policy unchanged.
-- The INSERT policy already requires status IN ('active','revealed')
-- (Phase 5a) — DM messages (revealed matches) are correctly allowed.

-- ── user_blocks: prevent two users from being matched ──
-- When a user blocks another, the claim_match RPC refuses to pair them.
-- The blocked user is NOT notified (silent block). The blocker can
-- unblock by deleting the row.
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One block per (blocker, blocked) direction.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_unique
  ON user_blocks(blocker_id, blocked_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can view + insert + delete their own blocks only.
CREATE POLICY "Users can view own blocks"
  ON user_blocks FOR SELECT
  USING (blocker_id = auth.uid());

CREATE POLICY "Users can insert own blocks"
  ON user_blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks"
  ON user_blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- ── Update claim_match to refuse matching blocked users ──
-- The existing claim_match RPC sets user_b only if user_b IS NULL,
-- status='active', and user_a <> auth.uid(). We add a check: refuse
-- if either user has blocked the other.
CREATE OR REPLACE FUNCTION claim_match(p_match_id UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
  UPDATE matches
  SET user_b = auth.uid(),
      shared_pool = shared_pool * 2,
      last_activity = now()
  WHERE id = p_match_id
    AND user_b IS NULL
    AND status = 'active'
    AND user_a <> auth.uid()
    -- Refuse if either user has blocked the other.
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = matches.user_a)
         OR (blocker_id = matches.user_a AND blocked_id = auth.uid())
    )
  RETURNING matches.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════
-- Phase 8A — Character system rebuild (Character.AI / Janitor-style)
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── characters: new columns for the rebuilt character system ──
-- short_description: one line shown on cards (≤ 200 chars in app).
-- full_personality:  how the character talks, behaves, tone, quirks (≤ 3000).
-- backstory:         who the character is, background, lore (≤ 3000).
-- tags:              new tagging system (flirty, anime, romance, …).
-- category:          companion / roleplay / adventure / romance / assistant / other.
-- chat_count:        total new conversations started with this character.
-- All nullable/with defaults so existing characters don't break.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS full_personality TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS category TEXT
  NOT NULL DEFAULT 'other'
  CHECK (category IN ('companion','roleplay','adventure','romance','assistant','other'));
ALTER TABLE characters ADD COLUMN IF NOT EXISTS chat_count INT NOT NULL DEFAULT 0;

-- Indexes for fast browse filtering by the new dimension.
CREATE INDEX IF NOT EXISTS idx_characters_category ON characters(category);
CREATE INDEX IF NOT EXISTS idx_characters_chat_count ON characters(chat_count DESC);

-- chat_count is server-managed only (incremented by the
-- increment_chat_count RPC when a new solo session starts). REVOKE
-- UPDATE so a creator can't inflate their own character's popularity.
REVOKE UPDATE (chat_count) ON characters FROM authenticated;
REVOKE UPDATE (chat_count) ON characters FROM anon;

-- ── token_transactions: per-user ledger of every credit/debit ──
-- One row per token movement with a reason + optional match/payment
-- link. RLS: owner SELECT only; INSERT/UPDATE/DELETE via service_role
-- RPCs (deduct_message_tokens, credit_tokens in Phase 8 proper).
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('match_create','match_join','message','purchase','refund','vip_grant','admin','ticket_purchase')
  ),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id
  ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at
  ON token_transactions(created_at DESC);

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token transactions"
  ON token_transactions FOR SELECT
  USING (user_id = auth.uid());
-- No INSERT/UPDATE/DELETE policy for authenticated → only service_role
-- (which bypasses RLS) can write via the RPCs below.

-- ── increment_chat_count: bump characters.chat_count on new session ──
-- Service_role-only: the solo action calls it via the admin client.
CREATE OR REPLACE FUNCTION increment_chat_count(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE characters
  SET chat_count = chat_count + 1
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION increment_chat_count(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION increment_chat_count(UUID) FROM anon;

-- ── record_token_transaction: internal ledger writer ──
-- Called by deduct_message_tokens and (in Phase 8) by credit_tokens.
-- Service_role-only.
CREATE OR REPLACE FUNCTION record_token_transaction(
  p_user_id UUID,
  p_delta INT,
  p_reason TEXT,
  p_match_id UUID,
  p_payment_id TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO token_transactions (user_id, delta, reason, match_id, payment_id)
  VALUES (p_user_id, p_delta, p_reason, p_match_id, p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION record_token_transaction(UUID, INT, TEXT, UUID, TEXT)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION record_token_transaction(UUID, INT, TEXT, UUID, TEXT)
  FROM anon;

-- ── deduct_message_tokens: per-message atomic deduction ──
-- Atomically decrements profiles.tokens_balance by p_amount only if
-- the balance is sufficient. Records a 'message' token_transaction row.
-- Returns the new balance, or NULL if insufficient. Called by the solo
-- action via the admin client before the AI generates a response.
-- Service_role-only.
CREATE OR REPLACE FUNCTION deduct_message_tokens(
  p_user_id UUID,
  p_amount INT
) RETURNS TABLE (new_balance INT) AS $$
DECLARE
  current_balance INT;
  new_bal INT;
BEGIN
  SELECT tokens_balance INTO current_balance
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF current_balance IS NULL THEN RETURN; END IF;
  IF current_balance < p_amount THEN RETURN; END IF;

  new_bal := current_balance - p_amount;

  UPDATE profiles SET tokens_balance = new_bal WHERE id = p_user_id;

  PERFORM record_token_transaction(p_user_id, -p_amount, 'message', NULL, NULL);

  RETURN QUERY SELECT new_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION deduct_message_tokens(UUID, INT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION deduct_message_tokens(UUID, INT) FROM anon;

-- ════════════════════════════════════════════════════════════════════
-- Phase 8 — NOWPayments crypto monetization
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── profiles.vip_expires_at: VIP expiry timestamp ──
-- One-time 30-day pass model. When a VIP payment is confirmed, the
-- webhook sets is_vip=true and vip_expires_at = now() + 30 days. The
-- get_own_profile RPC auto-revokes when vip_expires_at < now().
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;

-- Same column-level protection as is_vip — users must not be able to
-- read or write their own expiry directly (only via get_own_profile).
REVOKE UPDATE (vip_expires_at) ON profiles FROM authenticated;
REVOKE UPDATE (vip_expires_at) ON profiles FROM anon;
REVOKE SELECT (vip_expires_at) ON profiles FROM authenticated;
REVOKE SELECT (vip_expires_at) ON profiles FROM anon;

-- ── get_own_profile: auto-revoke expired VIP + return vip_expires_at ──
-- Before returning the profile, clears is_vip for rows whose
-- vip_expires_at has passed. This makes the expiry self-enforcing
-- without a cron job. Returns vip_expires_at alongside the existing
-- columns.
-- CREATE OR REPLACE cannot change a function's return type, and each
-- redefinition below widens the column list. Drop first.
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
  vip_expires_at TIMESTAMPTZ,
  recent_ratings JSONB,
  earned_tags TEXT[],
  connection_tickets INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Auto-revoke expired VIP for the calling user.
  UPDATE profiles p
  SET is_vip = false
  WHERE p.id = auth.uid()
    AND p.is_vip = true
    AND p.vip_expires_at IS NOT NULL
    AND p.vip_expires_at < now();

  RETURN QUERY
  SELECT p.id, p.anonymous_username, p.anonymous_pfp_url,
         p.reputation_score, p.reputation_tier, p.tokens_balance,
         p.is_vip, p.vip_expires_at, p.recent_ratings, p.earned_tags,
         p.connection_tickets, p.created_at
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── credit_tokens: add tokens after a confirmed payment ──
-- Increments tokens_balance and records a 'purchase' transaction.
-- Service_role-only — called by the NOWPayments webhook via the admin
-- client. Idempotency is enforced at the webhook level via the
-- nowpayments_events table.
CREATE OR REPLACE FUNCTION credit_tokens(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT,
  p_payment_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET tokens_balance = tokens_balance + p_amount
  WHERE id = p_user_id;

  PERFORM record_token_transaction(p_user_id, p_amount, p_reason, NULL, p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION credit_tokens(UUID, INT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION credit_tokens(UUID, INT, TEXT, TEXT) FROM anon;

-- ── grant_vip: activate a 30-day VIP pass after a confirmed payment ──
-- Sets is_vip=true and vip_expires_at to now() + p_days (or extends an
-- existing active pass by p_days). Records a 'vip_grant' transaction.
-- Service_role-only — called by the NOWPayments webhook.
CREATE OR REPLACE FUNCTION grant_vip(
  p_user_id UUID,
  p_days INT,
  p_payment_id TEXT
) RETURNS VOID AS $$
DECLARE
  current_expiry TIMESTAMPTZ;
  new_expiry TIMESTAMPTZ;
BEGIN
  SELECT vip_expires_at INTO current_expiry
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  -- Extend from the current expiry if still active, otherwise from now.
  IF current_expiry IS NOT NULL AND current_expiry > now() THEN
    new_expiry := current_expiry + (p_days || ' days')::INTERVAL;
  ELSE
    new_expiry := now() + (p_days || ' days')::INTERVAL;
  END IF;

  UPDATE profiles
  SET is_vip = true, vip_expires_at = new_expiry
  WHERE id = p_user_id;

  PERFORM record_token_transaction(p_user_id, 0, 'vip_grant', NULL, p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION grant_vip(UUID, INT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION grant_vip(UUID, INT, TEXT) FROM anon;

-- ── nowpayments_events: webhook idempotency ledger ──
-- Every IPN callback is recorded here by its unique event/ payment ID.
-- The webhook handler checks for an existing row before processing to
-- prevent double-granting on retry. Service_role only (no RLS policy
-- for authenticated → only the admin client can read/write).
CREATE TABLE IF NOT EXISTS nowpayments_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nowpayments_events ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated/anon.
-- Only the service_role admin client (bypasses RLS) can access this.

-- ── payments: order tracking for NOWPayments invoices ──
-- One row per payment order created by billing actions. The webhook
-- updates the status to 'confirmed' when payment_confirmed is received.
-- Service_role only — users never query this directly.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vip', 'tokens')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  token_quantity INT,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated/anon.
-- Only the service_role admin client (bypasses RLS) can access this.

-- ════════════════════════════════════════════════════════════════════
-- Phase 9 — Safety & legal final pass
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── profiles: tos_accepted_at, age_cohort, nsfw_opt_in ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_cohort TEXT
  CHECK (age_cohort IS NULL OR age_cohort IN ('minor', 'adult'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nsfw_opt_in BOOLEAN DEFAULT false;

-- nsfw_opt_in is sensitive — REVOKE from authenticated, only writable
-- via the set_nsfw_opt_in RPC which re-validates age_cohort server-side.
REVOKE UPDATE (nsfw_opt_in) ON profiles FROM authenticated;
REVOKE UPDATE (nsfw_opt_in) ON profiles FROM anon;
REVOKE SELECT (nsfw_opt_in) ON profiles FROM authenticated;
REVOKE SELECT (nsfw_opt_in) ON profiles FROM anon;

-- age_cohort: readable by the owner via get_own_profile, but only
-- writable via the set_age_cohort RPC.
REVOKE UPDATE (age_cohort) ON profiles FROM authenticated;
REVOKE UPDATE (age_cohort) ON profiles FROM anon;

-- tos_accepted_at: readable by the owner, writable via accept_tos RPC.
REVOKE UPDATE (tos_accepted_at) ON profiles FROM authenticated;
REVOKE UPDATE (tos_accepted_at) ON profiles FROM anon;

-- ── accept_tos: record ToS acceptance timestamp for the caller ──
-- SECURITY DEFINER — caller identity via auth.uid(). Authenticated-only.
CREATE OR REPLACE FUNCTION accept_tos()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET tos_accepted_at = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION accept_tos() FROM anon;

-- ── set_age_cohort: record the user's age group ──
-- Service_role-only. Called by the auth callback via the admin client
-- after reading the sweetscene_age_cohort cookie. REVOKE'd from
-- authenticated so users cannot self-assert their age cohort via a
-- direct RPC call from the browser.
CREATE OR REPLACE FUNCTION set_age_cohort(p_cohort TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_cohort NOT IN ('minor', 'adult') THEN
    RAISE EXCEPTION 'Invalid age cohort';
  END IF;
  UPDATE profiles SET age_cohort = p_cohort WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION set_age_cohort(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION set_age_cohort(TEXT) FROM anon;

-- ── set_nsfw_opt_in: set NSFW consent, re-validates adult status ──
-- Refuses to enable NSFW if age_cohort is not 'adult'. This is the
-- server-side guard against client bypass of the age gate.
CREATE OR REPLACE FUNCTION set_nsfw_opt_in(p_opt_in BOOLEAN)
RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  current_cohort TEXT;
  tos_accepted TIMESTAMPTZ;
BEGIN
  SELECT age_cohort, tos_accepted_at INTO current_cohort, tos_accepted
  FROM profiles WHERE id = auth.uid() FOR UPDATE;

  IF p_opt_in AND (current_cohort IS NULL OR current_cohort <> 'adult') THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  IF p_opt_in AND tos_accepted IS NULL THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  UPDATE profiles SET nsfw_opt_in = p_opt_in WHERE id = auth.uid();
  RETURN QUERY SELECT true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION set_nsfw_opt_in(BOOLEAN) FROM anon;

-- ── Update get_own_profile to include new columns ──
-- Returns tos_accepted_at, age_cohort, nsfw_opt_in alongside existing columns.
-- CREATE OR REPLACE cannot change a function's return type, and each
-- redefinition below widens the column list. Drop first.
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
  vip_expires_at TIMESTAMPTZ,
  recent_ratings JSONB,
  earned_tags TEXT[],
  connection_tickets INT,
  tos_accepted_at TIMESTAMPTZ,
  age_cohort TEXT,
  nsfw_opt_in BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Auto-revoke expired VIP for the calling user.
  UPDATE profiles p
  SET is_vip = false
  WHERE p.id = auth.uid()
    AND p.is_vip = true
    AND p.vip_expires_at IS NOT NULL
    AND p.vip_expires_at < now();

  RETURN QUERY
  SELECT p.id, p.anonymous_username, p.anonymous_pfp_url,
         p.reputation_score, p.reputation_tier, p.tokens_balance,
         p.is_vip, p.vip_expires_at, p.recent_ratings, p.earned_tags,
         p.connection_tickets, p.tos_accepted_at, p.age_cohort,
         p.nsfw_opt_in, p.created_at
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── L14 fix: unlisted characters readable by anyone with the link ──
-- The visibility='unlisted' enum means "not in public listings, but
-- accessible if you know the UUID". The old RLS only allowed
-- is_public=true (which is false for unlisted via the trigger), so
-- unlisted characters were invisible to non-creators.
DROP POLICY IF EXISTS "Anyone can view public or own characters" ON characters;
DROP POLICY IF EXISTS "Anyone can view public or unlisted characters" ON characters;

CREATE POLICY "Anyone can view public or unlisted characters"
  ON characters FOR SELECT
  USING (is_public = true OR visibility = 'unlisted' OR creator_id = auth.uid());

-- ── L13/L18 fix: hash partner UUID in match_partners view ──
-- The raw partner_id UUID was exposed, de-anonymizing users. Replace
-- with a SHA-256 hash so the client gets a stable identifier without
-- the actual UUID. pgcrypto's digest() is needed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CREATE OR REPLACE VIEW cannot rename an existing column; the
-- hashed definition renames partner_id -> partner_id_hash.
DROP VIEW IF EXISTS match_partners;
CREATE VIEW match_partners AS
SELECT
  m.id AS match_id,
  auth.uid() AS viewer_id,
  encode(digest(
    CASE WHEN m.user_a = auth.uid() THEN m.user_b::text ELSE m.user_a::text END,
    'sha256'
  ), 'hex') AS partner_id_hash,
  p.anonymous_username AS partner_username,
  p.anonymous_pfp_url AS partner_avatar_url,
  NULL::TEXT AS reputation_tier
FROM matches m
JOIN profiles p ON p.id = (
  CASE
    WHEN m.user_a = auth.uid() THEN m.user_b
    ELSE m.user_a
  END
)
WHERE m.user_a = auth.uid() OR m.user_b = auth.uid();

-- ── M7 fix: atomic JSONB append for solo session messages ──
-- The old update_solo_session replaced the entire messages JSONB
-- column, causing a read-modify-write race where concurrent calls
-- could lose messages. This new RPC atomically appends to the JSONB
-- array using `||` concatenation.
CREATE OR REPLACE FUNCTION append_solo_messages(
  p_session_id UUID,
  p_new_messages JSONB,
  p_token_delta INT
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE solo_sessions
  SET messages = messages || p_new_messages,
      tokens_used = tokens_used + p_token_delta
  WHERE id = p_session_id AND user_id = auth.uid();

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN QUERY SELECT rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION append_solo_messages(UUID, JSONB, INT) FROM anon;

-- ════════════════════════════════════════════════════════════════════
-- Bug fix pass — full project audit remediation
-- Run after all preceding migrations. Append-only.
-- ════════════════════════════════════════════════════════════════════

-- A1. deduct_tokens: add sign guard + REVOKE from authenticated/anon +
-- ledger row. Without this, a user could call
--   supabase.rpc("deduct_tokens", { p_amount: -1000000 })
-- to add tokens to their own balance (negative deduction = addition).
CREATE OR REPLACE FUNCTION deduct_tokens(p_amount INT)
RETURNS TABLE (new_balance INT) AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  UPDATE profiles
  SET tokens_balance = tokens_balance - p_amount
  WHERE id = auth.uid() AND tokens_balance >= p_amount
  RETURNING profiles.tokens_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION deduct_tokens(INT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION deduct_tokens(INT) FROM anon;

-- A2. matches INSERT RLS policy. Without an INSERT policy, RLS
-- default-denies match creation via the user client, so findMatch
-- and createAIMatch always fail with "Failed to create match".
CREATE POLICY "Users can insert own matches"
  ON matches FOR INSERT
  WITH CHECK (user_a = auth.uid());

-- A3. set_age_cohort: add p_user_id param. The service-role client
-- sends no JWT, so auth.uid() returns NULL inside the RPC and the
-- UPDATE matches zero rows. Pass the user id explicitly from the
-- auth callback (which has it after exchangeCodeForSession).
CREATE OR REPLACE FUNCTION set_age_cohort(p_user_id UUID, p_cohort TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_cohort NOT IN ('minor', 'adult') THEN
    RAISE EXCEPTION 'Invalid age cohort';
  END IF;
  UPDATE profiles SET age_cohort = p_cohort WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION set_age_cohort(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION set_age_cohort(UUID, TEXT) FROM anon;

-- Also revoke the old single-param signature in case it lingers.
REVOKE EXECUTE ON FUNCTION set_age_cohort(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION set_age_cohort(TEXT) FROM anon;

-- A4. REVOKE SELECT on sensitive profile columns that are world-readable
-- via the "Anyone can view profiles" SELECT policy. The owner still
-- reads them via get_own_profile (SECURITY DEFINER bypasses column
-- REVOKE). Particularly important for age_cohort (minor/adult leak).
REVOKE SELECT (age_cohort, tos_accepted_at, connection_tickets,
               reputation_tier, recent_ratings, earned_tags)
  ON profiles FROM authenticated;
REVOKE SELECT (age_cohort, tos_accepted_at, connection_tickets,
               reputation_tier, recent_ratings, earned_tags)
  ON profiles FROM anon;

-- A5. NSFW character SELECT policy — age gate at DB level. Replace the
-- broad "anyone can view public or unlisted" policy with one that also
-- checks: for NSFW characters, the viewer must have age_cohort='adult'
-- AND nsfw_opt_in=true. SFW characters remain world-readable.
DROP POLICY IF EXISTS "Anyone can view public or unlisted characters" ON characters;

CREATE POLICY "Age-gated character viewing"
  ON characters FOR SELECT
  USING (
    (is_public = true OR visibility = 'unlisted' OR creator_id = auth.uid())
    AND (
      NOT is_nsfw
      OR creator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.age_cohort = 'adult'
          AND p.nsfw_opt_in = true
          AND p.tos_accepted_at IS NOT NULL
      )
    )
  );

-- A6. REVOKE UPDATE on solo_sessions.is_waiting to prevent users from
-- self-setting is_waiting=true for unlimited free AI generation.
REVOKE UPDATE (is_waiting) ON solo_sessions FROM authenticated;
REVOKE UPDATE (is_waiting) ON solo_sessions FROM anon;

-- A7. append_solo_messages: add message cap (max 100 messages per session)
-- and REVOKE from authenticated (service_role only, matching the pattern
-- of other mutating RPCs like add_tokens and deduct_message_tokens).
CREATE OR REPLACE FUNCTION append_solo_messages(
  p_session_id UUID,
  p_new_messages JSONB,
  p_token_delta INT
) RETURNS TABLE (success BOOLEAN) AS $$
DECLARE
  rows_affected INT;
  current_len INT;
BEGIN
  SELECT jsonb_array_length(messages) INTO current_len
  FROM solo_sessions WHERE id = p_session_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  -- Cap total messages at 100 to prevent unbounded JSONB growth.
  IF current_len >= 100 THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  UPDATE solo_sessions
  SET messages = messages || p_new_messages,
      tokens_used = tokens_used + p_token_delta
  WHERE id = p_session_id AND user_id = auth.uid();

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN QUERY SELECT rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION append_solo_messages(UUID, JSONB, INT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION append_solo_messages(UUID, JSONB, INT) FROM anon;

-- A8. match_ratings: drop UPDATE policy to make ratings append-only.
-- The submit_match_rating RPC already blocks duplicate submissions via
-- a unique index + FOR UPDATE check, but the UPDATE policy lets users
-- mutate reason/vibe post-hoc outside the RPC.
DROP POLICY IF EXISTS "Users can update own match ratings" ON match_ratings;

-- A9. profiles.anonymous_username: REVOKE UPDATE so users can only change
-- it via the update_profile_username RPC (which enforces 2-20 length).
-- Also add a CHECK on the column for defense-in-depth.
REVOKE UPDATE (anonymous_username) ON profiles FROM authenticated;
REVOKE UPDATE (anonymous_username) ON profiles FROM anon;

ALTER TABLE profiles ADD CONSTRAINT profiles_username_length
  CHECK (length(anonymous_username) BETWEEN 2 AND 20);

-- A10. matches FK: change user_a ON DELETE CASCADE to SET NULL so deleting
-- a user's auth account doesn't destroy the partner's match history.
-- Both user_a and user_b should be SET NULL to preserve history.
-- (Requires dropping and recreating the FK constraints.)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_a_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_b_fkey;
ALTER TABLE matches ADD CONSTRAINT matches_user_a_fkey
  FOREIGN KEY (user_a) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE matches ADD CONSTRAINT matches_user_b_fkey
  FOREIGN KEY (user_b) REFERENCES profiles(id) ON DELETE SET NULL;

-- Both keys above are ON DELETE SET NULL, so user_a must be nullable.
-- Left NOT NULL, deleting a profile that started any match raises
-- "null value in column user_a violates not-null constraint" and the
-- account deletion fails outright.
--
-- Inserts are unaffected: the "Users can insert own matches" policy
-- checks user_a = auth.uid(), and NULL = uid is never true.
ALTER TABLE matches ALTER COLUMN user_a DROP NOT NULL;

-- A11. Report conversation: cap evidence at 100 messages and 256 KB.
CREATE OR REPLACE FUNCTION report_conversation_capped(
  p_match_id UUID,
  p_reason TEXT,
  p_evidence JSONB DEFAULT '[]'::jsonb
) RETURNS VOID AS $$
DECLARE
  evidence_capped JSONB;
  evidence_size INT;
BEGIN
  evidence_capped := COALESCE(p_evidence, '[]'::jsonb);

  -- Cap at 100 messages.
  IF jsonb_array_length(evidence_capped) > 100 THEN
    evidence_capped := jsonb_path_query_array(evidence_capped, '$[0 to 99]');
  END IF;

  -- Cap total size at 256 KB.
  evidence_size := octet_length(evidence_capped::text);
  IF evidence_size > 262144 THEN
    RAISE EXCEPTION 'Evidence too large (max 256 KB)';
  END IF;

  INSERT INTO reports (reporter_id, match_id, reason, evidence_snapshot)
  VALUES (auth.uid(), p_match_id, trim(p_reason), evidence_capped);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════
-- Phase 10 — Admin dashboard + moderation
-- ════════════════════════════════════════════════════════════════════

-- 10.1a: profiles.is_admin — gates access to /admin routes and RPCs.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
REVOKE SELECT (is_admin) ON profiles FROM authenticated;
REVOKE SELECT (is_admin) ON profiles FROM anon;
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
REVOKE UPDATE (is_admin) ON profiles FROM anon;

-- 10.1b: profiles.is_banned / banned_until — ban users from matchmaking/chat.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
REVOKE UPDATE (is_banned) ON profiles FROM authenticated;
REVOKE UPDATE (is_banned) ON profiles FROM anon;
REVOKE UPDATE (banned_until) ON profiles FROM authenticated;
REVOKE UPDATE (banned_until) ON profiles FROM anon;

-- 10.1c: characters.is_featured — shown on the homepage "featured" carousel.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
REVOKE UPDATE (is_featured) ON characters FROM authenticated;
REVOKE UPDATE (is_featured) ON characters FROM anon;

-- 10.1d: characters.is_hidden — admin-only hide from public discovery.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
REVOKE UPDATE (is_hidden) ON characters FROM authenticated;
REVOKE UPDATE (is_hidden) ON characters FROM anon;

-- 10.1e: reports.status / resolved_by / resolved_at / resolution_note.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'
  CHECK (status IN ('open', 'resolved', 'dismissed'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note TEXT;
REVOKE UPDATE (status, resolved_by, resolved_at, resolution_note) ON reports FROM authenticated;

-- 10.2: assert_current_user_admin — SECURITY DEFINER helper.
-- Returns true if the calling user has profiles.is_admin = true.
-- All admin RPCs call this as a guard to prevent service_role key misuse.
CREATE OR REPLACE FUNCTION assert_current_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin_val BOOLEAN;
BEGIN
  SELECT p.is_admin INTO is_admin_val
  FROM profiles p
  WHERE p.id = auth.uid();

  RETURN COALESCE(is_admin_val, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION assert_current_user_admin() FROM anon;

-- 10.3: list_reports — returns reports with optional status filter.
CREATE OR REPLACE FUNCTION list_reports(
  p_status TEXT DEFAULT 'open',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  match_id UUID,
  reason TEXT,
  evidence_snapshot JSONB,
  status TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ,
  reporter_username TEXT
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT
    r.id, r.reporter_id, r.match_id, r.reason, r.evidence_snapshot,
    r.status, r.resolution_note, r.created_at,
    p.anonymous_username
  FROM reports r
  LEFT JOIN profiles p ON p.id = r.reporter_id
  WHERE (p_status = 'all' OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_reports(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_reports(TEXT, INT, INT) TO authenticated;

-- 10.4: resolve_report — marks a report resolved or dismissed.
CREATE OR REPLACE FUNCTION resolve_report(
  p_report_id UUID,
  p_resolution TEXT,
  p_note TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE reports
  SET status = p_resolution,
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_note
  WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION resolve_report(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION resolve_report(UUID, TEXT, TEXT) TO authenticated;

-- 10.5: ban_user — bans a user, optionally until a timestamp.
CREATE OR REPLACE FUNCTION ban_user(
  p_user_id UUID,
  p_banned_until TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
  SET is_banned = true,
      banned_until = p_banned_until
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION ban_user(UUID, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION ban_user(UUID, TIMESTAMPTZ) TO authenticated;

-- 10.6: unban_user — lifts a ban.
CREATE OR REPLACE FUNCTION unban_user(
  p_user_id UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
  SET is_banned = false,
      banned_until = NULL
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION unban_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION unban_user(UUID) TO authenticated;

-- 10.7: admin_grant_tokens — grants (or refunds) tokens to a user.
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_grant_tokens(UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION admin_grant_tokens(UUID, INT) TO authenticated;

-- 10.8: admin_set_character_flag — feature/unfeature + hide/unhide.
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_set_character_flag(UUID, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION admin_set_character_flag(UUID, TEXT, BOOLEAN) TO authenticated;

-- 10.9: admin_delete_character — force-delete (bypasses creator check).
CREATE OR REPLACE FUNCTION admin_delete_character(
  p_character_id UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM characters WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_delete_character(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION admin_delete_character(UUID) TO authenticated;

-- 10.10: list_admin_users — search users by username, paginated.
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
  created_at TIMESTAMPTZ
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
    p.is_admin, p.is_banned, p.banned_until, p.created_at
  FROM profiles p
  WHERE p_search = '' OR p.anonymous_username ILIKE '%' || p_search || '%'
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_admin_users(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_admin_users(TEXT, INT, INT) TO authenticated;

-- 10.11: list_admin_characters — all characters (including private/hidden).
CREATE OR REPLACE FUNCTION list_admin_characters(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  name TEXT,
  creator_id UUID,
  visibility TEXT,
  is_nsfw BOOLEAN,
  is_featured BOOLEAN,
  is_hidden BOOLEAN,
  chat_count INT,
  created_at TIMESTAMPTZ,
  creator_username TEXT
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := LEAST(p_limit, 100);

  RETURN QUERY
  SELECT
    c.id, c.name, c.creator_id, c.visibility, c.is_nsfw,
    c.is_featured, c.is_hidden, c.chat_count, c.created_at,
    p.anonymous_username
  FROM characters c
  LEFT JOIN profiles p ON p.id = c.creator_id
  WHERE p_search = '' OR c.name ILIKE '%' || p_search || '%'
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_admin_characters(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_admin_characters(TEXT, INT, INT) TO authenticated;

-- 10.12: populate_match_snapshot — snapshot character prompts at match creation.
CREATE OR REPLACE FUNCTION populate_match_snapshot(
  p_match_id UUID,
  p_character_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  cid UUID;
BEGIN
  FOREACH cid IN ARRAY p_character_ids LOOP
    INSERT INTO match_characters_snapshot (match_id, character_id, name, personality, first_message, system_prompt, is_nsfw, version)
    SELECT p_match_id, c.id, c.name, c.personality, c.first_message,
           COALESCE(c.system_prompt, c.user_prompt), COALESCE(c.is_nsfw, false), c.version
    FROM characters c
    WHERE c.id = cid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION populate_match_snapshot(UUID, UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION populate_match_snapshot(UUID, UUID[]) FROM authenticated;

-- L17: solo_sessions.tokens_used — REVOKE UPDATE so only service_role
-- can modify (done via append_solo_messages RPC). authenticated can
-- still SELECT it for display.
REVOKE UPDATE (tokens_used) ON solo_sessions FROM authenticated;
REVOKE UPDATE (tokens_used) ON solo_sessions FROM anon;

-- 10.13: get_admin_stats — dashboard counts.
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE (
  open_reports INT,
  total_reports INT,
  total_users INT,
  total_characters INT,
  banned_users INT,
  featured_characters INT
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

  /* P10 audit fix: RETURNS TABLE functions emit 0 rows without an
     explicit RETURN NEXT. The output variables (open_reports, etc.)
     are set above; RETURN NEXT emits a single row using their values. */
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Phase 11 — Notifications
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('match_found','reveal_request','reveal_complete','new_dm','rating_received','token_refund','vip_granted','admin_message')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  read_at     TIMESTAMPTZ,
  match_id    UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Owner can read their own notifications
CREATE POLICY notifications_owner_select
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Owner can UPDATE read_at only (not title/body/type)
CREATE POLICY notifications_owner_update
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No client INSERT — notifications are created server-side only
-- via the create_notification SECURITY DEFINER RPC.
REVOKE INSERT ON notifications FROM authenticated, anon;

-- REVOKE DELETE so a client can't wipe notifications
REVOKE DELETE ON notifications FROM authenticated, anon;

-- ── create_notification — internal RPC used by server actions ──
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id  UUID,
  p_type     TEXT,
  p_title    TEXT,
  p_body     TEXT DEFAULT '',
  p_match_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Must stay in step with notifications_type_check, which is widened
  -- with 'tokens_purchased' further down this file. Without it here,
  -- the constraint permits a type the only writer refuses to insert.
  IF p_type NOT IN ('match_found','reveal_request','reveal_complete','new_dm','rating_received','token_refund','tokens_purchased','vip_granted','admin_message') THEN
    RAISE EXCEPTION 'invalid notification type: %', p_type;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, match_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_match_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, UUID) FROM authenticated;

-- ── mark_notification_read — mark a single notification as read ──
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
     SET read_at = now()
   WHERE id = p_notification_id
     AND user_id = auth.uid()
     AND read_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_notification_read(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;

-- ── mark_all_notifications_read — mark all unread as read for caller ──
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE notifications
       SET read_at = now()
     WHERE user_id = auth.uid()
       AND read_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_all_notifications_read() FROM anon;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;

-- ── get_unread_notification_count ──
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
    FROM notifications
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_unread_notification_count() FROM anon;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;

-- Enable Realtime for notifications. REPLICA IDENTITY FULL emits the
-- full row (old+new) on UPDATE so the bell can diff read_at changes.
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- P11 audit fix: subscribe the table to the supabase_realtime
-- publication so the Realtime server actually broadcasts INSERT and
-- UPDATE events. Without this, REPLICA IDENTITY FULL alone does
-- nothing — no events reach the browser channel.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- P11 audit fix: column-level UPDATE restriction. The broad
-- notifications_owner_update RLS policy allows the user to UPDATE any
-- column — title, body, type, match_id, etc. — not just read_at as
-- the docstring claims. REVOKE the table-wide UPDATE, then GRANT
-- only the read_at column to authenticated so the browser can mark
-- notifications read but cannot tamper with the content.
REVOKE UPDATE ON notifications FROM authenticated, anon;
GRANT UPDATE (read_at) ON notifications TO authenticated;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    

-- ════════════════════════════════════════════════════════════════════
-- Phase 12 — Server-authoritative age cohort (CRITICAL SECURITY FIX)
-- Append-only migration. Run this block in the Supabase SQL Editor.
--
-- BEFORE: app/page.tsx computed the cohort in the browser and wrote it
-- to a `sweetscene_age_cohort` cookie; app/auth/callback/route.ts read that
-- cookie and passed it to the service-role set_age_cohort RPC. The RPC
-- was correctly REVOKE'd from authenticated/anon, but its INPUT was
-- fully attacker-controlled:
--     document.cookie = "sweetscene_age_cohort=adult; path=/"
-- ...defeated the entire 18+ NSFW gate from devtools. set_nsfw_opt_in's
-- re-validation was checking a value the user themselves supplied.
--
-- AFTER: the birthdate is submitted through an AUTHENTICATED RPC, the
-- age is computed in SQL, and the cohort is DERIVED from the stored
-- birthdate at read time (so a minor correctly becomes an adult on
-- their 18th birthday, which a frozen column would not do).
--
-- NOTE: this is still self-attested, like most of the industry. It
-- raises the bar from "edit a cookie" to "lie on a form" and makes the
-- claim recorded, timestamped, and auditable. It is NOT identity
-- verification — see the note in LOVABLE.md / handoff docs.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_cohort_set_at TIMESTAMPTZ;

-- The user may never write any age field directly; only the RPC below.
REVOKE UPDATE (age_cohort) ON profiles FROM authenticated, anon;
REVOKE UPDATE (birthdate, age_cohort_set_at) ON profiles FROM authenticated, anon;
-- Birthdate is PII: never readable by other users.
REVOKE SELECT (birthdate) ON profiles FROM anon, authenticated;

-- ── derived_age_cohort: cohort computed from birthdate, not stored ──
-- Single source of truth for adulthood. Returns NULL when no birthdate
-- has been recorded, so every caller fails CLOSED.
CREATE OR REPLACE FUNCTION derived_age_cohort(p_uid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN p.birthdate IS NULL THEN NULL
           WHEN date_part('year', age(CURRENT_DATE, p.birthdate)) >= 18 THEN 'adult'
           ELSE 'minor'
         END
    FROM profiles p
   WHERE p.id = p_uid;
$$;

REVOKE EXECUTE ON FUNCTION derived_age_cohort(UUID) FROM anon, authenticated;

-- ── set_own_age_cohort: authenticated, write-once birthdate capture ──
-- Computes age server-side. Rejects under-16 outright (platform floor)
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

-- ── set_nsfw_opt_in: re-point at the DERIVED cohort ──
-- Supersedes the earlier definition, which trusted the stored
-- age_cohort column (populated from the forgeable cookie).
CREATE OR REPLACE FUNCTION set_nsfw_opt_in(p_opt_in BOOLEAN)
RETURNS TABLE (success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohort TEXT;
  v_tos    TIMESTAMPTZ;
BEGIN
  SELECT tos_accepted_at INTO v_tos
    FROM profiles WHERE id = auth.uid() FOR UPDATE;

  v_cohort := derived_age_cohort(auth.uid());

  -- Fails closed: NULL cohort (no birthdate on file) is not adult.
  IF p_opt_in AND (v_cohort IS NULL OR v_cohort <> 'adult') THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  IF p_opt_in AND v_tos IS NULL THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  UPDATE profiles SET nsfw_opt_in = p_opt_in WHERE id = auth.uid();
  RETURN QUERY SELECT true;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_nsfw_opt_in(BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION set_nsfw_opt_in(BOOLEAN) TO authenticated;

-- ── Revoke the obsolete cookie-fed entry points ──
-- Kept as definitions for history, but no role may execute them.
REVOKE EXECUTE ON FUNCTION set_age_cohort(TEXT)       FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION set_age_cohort(UUID, TEXT) FROM authenticated, anon;

-- ── Backfill safety: any pre-existing cohort came from the forgeable
-- cookie and carries no birthdate. Clear the unverified adult claims so
-- those accounts must re-attest through the authenticated RPC.
UPDATE profiles
   SET age_cohort = NULL,
       nsfw_opt_in = false
 WHERE birthdate IS NULL;


-- ════════════════════════════════════════════════════════════════════
-- Phase 12 — Payments hardening
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── notifications.type: add 'tokens_purchased' ──
-- The NOWPayments webhook previously reused the 'token_refund' type on
-- a successful purchase, so paying users were told their tokens had
-- been "refunded". The inline CHECK is unnamed, so Postgres called it
-- notifications_type_check; drop and re-add with the new value.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'match_found','reveal_request','reveal_complete','new_dm',
    'rating_received','token_refund','tokens_purchased',
    'vip_granted','admin_message'
  ));

-- ── payments: index the status filter used by the webhook claim ──
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ── credit_tokens / grant_vip: make the grant idempotent per payment ──
-- Defence in depth behind the webhook's atomic claim on payments.status.
-- If a grant is ever replayed for a payment ID that already produced a
-- token transaction, this makes it a no-op instead of a double-credit.
CREATE OR REPLACE FUNCTION credit_tokens(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT,
  p_payment_id TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_payment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM token_transactions
     WHERE payment_id = p_payment_id
  ) THEN
    RETURN;
  END IF;

  UPDATE profiles
     SET tokens_balance = tokens_balance + p_amount
   WHERE id = p_user_id;

  PERFORM record_token_transaction(p_user_id, p_amount, p_reason, NULL, p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION credit_tokens(UUID, INT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION credit_tokens(UUID, INT, TEXT, TEXT) FROM anon;

-- Supports the idempotency EXISTS check in credit_tokens above.
CREATE INDEX IF NOT EXISTS idx_token_transactions_payment_id
  ON token_transactions(payment_id) WHERE payment_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════
-- Phase 12 — Ban enforcement + admin-managed platform settings
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── is_current_user_banned ──
-- CRITICAL: this function was referenced by lib/utils/ban.ts but never
-- existed. Every assertNotBanned() call therefore errored, and that
-- helper failed OPEN, so bans were entirely unenforced across
-- matchmaking, messages, reveal and solo play. The helper now fails
-- closed, which means this function must exist before deploying.
--
-- A temporary ban (banned_until in the future) counts as banned; once
-- banned_until has passed the user is free again without an admin
-- having to act.
CREATE OR REPLACE FUNCTION is_current_user_banned()
RETURNS BOOLEAN AS $$
DECLARE
  v_banned  BOOLEAN;
  v_until   TIMESTAMPTZ;
BEGIN
  SELECT is_banned, banned_until
    INTO v_banned, v_until
    FROM profiles
   WHERE id = auth.uid();

  -- No profile row -> treat as not banned; auth gating handles that case.
  IF NOT FOUND OR v_banned IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- Permanent ban.
  IF v_until IS NULL THEN
    RETURN true;
  END IF;

  -- Temporary ban still running.
  IF v_until > now() THEN
    RETURN true;
  END IF;

  -- Expired: lazily clear so admin listings show the real state.
  UPDATE profiles
     SET is_banned = false,
         banned_until = NULL
   WHERE id = auth.uid();

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION is_current_user_banned() FROM anon;
GRANT  EXECUTE ON FUNCTION is_current_user_banned() TO authenticated;

-- Supports the ban sweep below.
CREATE INDEX IF NOT EXISTS idx_profiles_banned_until
  ON profiles(banned_until) WHERE banned_until IS NOT NULL;

-- ── expire_bans: sweep elapsed temporary bans ──
-- The lazy clear above only fires when the banned user themselves acts.
-- Admins call this so the user list is not full of stale "banned" rows.
CREATE OR REPLACE FUNCTION expire_bans()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
     SET is_banned = false,
         banned_until = NULL
   WHERE is_banned = true
     AND banned_until IS NOT NULL
     AND banned_until <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION expire_bans() FROM anon;
GRANT  EXECUTE ON FUNCTION expire_bans() TO authenticated;

-- ── ban_user: reject self-ban and banning other admins ──
-- Without this an admin can lock themselves out, or one admin can
-- disable another. Replaces the Phase 10 definition.
CREATE OR REPLACE FUNCTION ban_user(
  p_user_id UUID,
  p_banned_until TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Cannot ban an admin';
  END IF;

  IF p_banned_until IS NOT NULL AND p_banned_until <= now() THEN
    RAISE EXCEPTION 'Ban expiry must be in the future';
  END IF;

  UPDATE profiles
     SET is_banned = true,
         banned_until = p_banned_until
   WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION ban_user(UUID, TIMESTAMPTZ) FROM anon;
GRANT  EXECUTE ON FUNCTION ban_user(UUID, TIMESTAMPTZ) TO authenticated;

-- ── platform_settings: admin-managed runtime configuration ──
-- Holds secrets (AI provider keys) so the operator can rotate them from
-- the admin dashboard without a redeploy.
--
-- SECURITY: RLS is enabled and NO policy is created for authenticated or
-- anon, so PostgREST denies every client read and write. Only the
-- service_role client (which bypasses RLS, and is only ever constructed
-- server-side behind an admin check) can touch this table. Values must
-- never be sent to the browser — the admin UI renders a masked preview
-- computed on the server.
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even a mistakenly added policy cannot grant column
-- access that was never granted in the first place.
REVOKE ALL ON platform_settings FROM authenticated;
REVOKE ALL ON platform_settings FROM anon;

-- ════════════════════════════════════════════════════════════════════
-- Phase 12 — Avatar URL hardening (deanonymization defense)
-- Append-only migration. Run this block in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- Avatar URLs are rendered in every other user's browser. Pointed at a
-- host the setter controls, an <img> tag reports back the IP address,
-- User-Agent and rough location of everyone who views the card. On a
-- platform whose entire premise is anonymous roleplay that is the most
-- damaging passive attack available, and it needs no exploit at all.
--
-- lib/utils/url.ts validates the character path, but profiles.
-- anonymous_pfp_url is writable directly through PostgREST (see the
-- Phase 5 column grants), so there is no server action to hook. The
-- constraint therefore lives in the database, where it holds for every
-- write path — REST, RPC, or a future migration that forgets.
CREATE OR REPLACE FUNCTION is_safe_avatar_url(p_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- No avatar is always fine.
  IF p_url IS NULL OR p_url = '' THEN
    RETURN true;
  END IF;

  IF length(p_url) > 2048 THEN
    RETURN false;
  END IF;

  -- Characters that break out of `url(...)` in CSS or out of an HTML
  -- attribute. A conforming https URL never needs these unescaped.
  IF p_url ~ '["''()\;{}<>]' OR p_url ~ '\s' THEN
    RETURN false;
  END IF;

  -- https only, on a host the platform already trusts.
  RETURN p_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/'
      OR p_url ~ '^https://image\.pollinations\.ai/'
      OR p_url ~ '^https://images\.unsplash\.com/';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- NOT VALID: enforced on every INSERT and UPDATE from here on, without
-- failing the migration if legacy rows already hold external URLs.
-- Clean those up, then run the matching VALIDATE CONSTRAINT below.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_pfp_url_safe;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_pfp_url_safe
  CHECK (is_safe_avatar_url(anonymous_pfp_url)) NOT VALID;

ALTER TABLE characters
  DROP CONSTRAINT IF EXISTS characters_avatar_url_safe;
ALTER TABLE characters
  ADD CONSTRAINT characters_avatar_url_safe
  CHECK (is_safe_avatar_url(avatar_url)) NOT VALID;

-- After clearing any pre-existing external URLs, promote to validated:
--   UPDATE profiles   SET anonymous_pfp_url = NULL
--     WHERE NOT is_safe_avatar_url(anonymous_pfp_url);
--   UPDATE characters SET avatar_url = NULL
--     WHERE NOT is_safe_avatar_url(avatar_url);
--   ALTER TABLE profiles   VALIDATE CONSTRAINT profiles_pfp_url_safe;
--   ALTER TABLE characters VALIDATE CONSTRAINT characters_avatar_url_safe;

-- ════════════════════════════════════════════════════════════════════
-- Phase 13 — Restore EXECUTE on auth.uid()-scoped RPCs
--            (CRITICAL — matchmaking and solo chat are dead without it)
-- ════════════════════════════════════════════════════════════════════
--
-- Blocks A1 (line ~1959) and A7 (line ~2044) hardened deduct_tokens and
-- append_solo_messages by adding argument guards, then revoked EXECUTE
-- from `authenticated`. The revoke was wrong, and it breaks the app.
--
-- Both functions scope their write with auth.uid():
--     UPDATE profiles ... WHERE id = auth.uid()
-- so they are only ever correct when called BY the end user, with the
-- user's JWT. That is exactly what the code does — lib/actions/
-- matchmaking.ts:205,243,355 and lib/actions/solo.ts:499 call them on
-- the client returned by createClient(), which carries the `authenticated`
-- role.
--
-- The revoke therefore leaves no working caller at all:
--   • user client      → permission denied for function
--   • service_role     → auth.uid() is NULL, WHERE matches no row
--
-- Net effect once A1/A7 are applied: every findMatch and createAIMatch
-- returns "Not enough tokens", and every solo message returns "Failed to
-- save message" and refunds itself. The two core features of the
-- platform stop working.
--
-- The abuse the revoke was aiming at — deduct_tokens(p_amount => -1000000)
-- to mint tokens — is already dead, closed by the sign guard added in the
-- same block (`IF p_amount IS NULL OR p_amount <= 0 THEN RETURN`) and by
-- the message-cap guard in A7. The grant is safe to restore; the guards
-- are what make it safe.
--
-- anon stays revoked: neither function means anything without a session.

GRANT EXECUTE ON FUNCTION deduct_tokens(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION append_solo_messages(UUID, JSONB, INT) TO authenticated;

REVOKE EXECUTE ON FUNCTION deduct_tokens(INT) FROM anon;
REVOKE EXECUTE ON FUNCTION append_solo_messages(UUID, JSONB, INT) FROM anon;

-- ════════════════════════════════════════════════════════════════════
-- Phase 14 — Account deletion
--
-- Deleting an account deletes the auth.users row, which cascades to
-- profiles and from there to everything keyed on profiles.id. That
-- cascade graph is mostly right already:
--
--   CASCADE (correct — the user's own data)
--     solo_sessions, notifications, user_blocks, match_ratings,
--     reputation_events, character_ratings, reports.reporter_id
--
--   SET NULL (correct — the OTHER participant's history survives)
--     matches.user_a / user_b (A10), messages.sender_id,
--     characters.creator_id
--
-- One row was wrong: payments CASCADE'd. The privacy policy commits to
-- retaining payment records for 7 years for tax and legal compliance,
-- and financial records generally cannot be erased on request. Deleting
-- an account would have silently destroyed them, making that promise
-- false and the books incomplete.
--
-- user_id becomes nullable and SET NULL: the transaction survives with
-- its amount, currency, order_id and timestamps intact, no longer
-- linked to a person. That satisfies both the retention obligation and
-- the erasure request.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- nowpayments_events is keyed on order_id, not user_id, so it is
-- unaffected — the IPN audit trail survives deletion by construction.

-- ════════════════════════════════════════════════════════════════════
-- Phase 15 — Cohort-segregated matchmaking
--
-- The platform floor is 16+ and NSFW is gated separately to
-- age_cohort = 'adult'. That gate governed what a user could SEE —
-- NSFW characters, the NSFW toggle — but not who they could be PAIRED
-- WITH. The queue query in lib/actions/matchmaking.ts filtered on
-- status, tier, and scenario tags, and claim_match enforced only that
-- the match was open and the two users had not blocked each other.
--
-- So a 16-year-old and a 35-year-old could be dropped into the same
-- live two-human scene. Nothing downstream corrected for it: the
-- message path applies no age-aware policy, and an anonymous
-- roleplay scene is precisely where that pairing does harm.
--
-- Matches now carry the cohort they belong to, and a user may only
-- join a match in their own.
--
-- The column is set by a BEFORE INSERT trigger from the creator's
-- profile, never by the client. The insert at matchmaking.ts is a
-- plain user-client INSERT under RLS, so a client-supplied cohort
-- would be a self-declared age — the same mistake the server
-- authoritative age cohort block (line 2649) already fixed once.
--
-- NULL cohort resolves to 'minor', not 'adult'. A user whose age has
-- never been recorded is treated as a minor for pairing: the failure
-- mode of guessing wrong in that direction is a missed match, and in
-- the other direction it is an adult in a scene with a child.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE matches ADD COLUMN IF NOT EXISTS cohort TEXT;

-- Backfill from the creator's recorded cohort, defaulting to 'minor'.
UPDATE matches m
SET cohort = COALESCE(p.age_cohort, 'minor')
FROM profiles p
WHERE p.id = m.user_a AND m.cohort IS NULL;

-- Matches whose creator's profile is already gone (user_a SET NULL on
-- account deletion) have no cohort to read. They are historical rows,
-- closed to new joins by the status filter regardless.
UPDATE matches SET cohort = 'minor' WHERE cohort IS NULL;

ALTER TABLE matches ALTER COLUMN cohort SET DEFAULT 'minor';
ALTER TABLE matches ALTER COLUMN cohort SET NOT NULL;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_cohort_check;
ALTER TABLE matches ADD CONSTRAINT matches_cohort_check
  CHECK (cohort IN ('minor', 'adult'));

-- ── Server-authoritative assignment ──
CREATE OR REPLACE FUNCTION set_match_cohort()
RETURNS TRIGGER AS $$
DECLARE
  creator_cohort TEXT;
BEGIN
  SELECT age_cohort INTO creator_cohort FROM profiles WHERE id = NEW.user_a;
  NEW.cohort := COALESCE(creator_cohort, 'minor');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_match_cohort ON matches;
CREATE TRIGGER trg_set_match_cohort
  BEFORE INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION set_match_cohort();

-- The trigger assigns NEW.cohort internally, so revoking the column
-- from clients costs nothing: their INSERT never names it. What this
-- stops is an UPDATE moving an existing match between cohorts.
REVOKE INSERT (cohort), UPDATE (cohort) ON matches FROM authenticated;
REVOKE INSERT (cohort), UPDATE (cohort) ON matches FROM anon;

-- Serves the waiting-match lookup, which now filters on cohort too.
CREATE INDEX IF NOT EXISTS idx_matches_open_queue
  ON matches (cohort, tier, status)
  WHERE user_b IS NULL AND is_ai_match = false;

-- ── claim_match: refuse a cross-cohort join ──
-- The queue query's cohort filter is a fast path and nothing more —
-- claim_match takes a match id, and a client can call it with any id
-- it can name. This is the enforcement point, in the same way that
-- the block check below it is.
CREATE OR REPLACE FUNCTION claim_match(p_match_id UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
  -- RETURN QUERY is required: a bare UPDATE ... RETURNING inside a
  -- plpgsql body has nowhere to put its result and raises "query has
  -- no destination for result data" on every call.
  --
  -- Every column is schema-qualified because the OUT parameter `id`
  -- shadows matches.id -- unqualified, `WHERE id = p_match_id` compares
  -- the output variable against itself and matches every row.
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
  RETURNING matches.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═════════════════════════════════════════════════════════════════════
-- HARDENING -- must run last
--
-- Every `REVOKE EXECUTE ... FROM authenticated` and `... FROM anon`
-- above this line is a no-op. Postgres grants EXECUTE to PUBLIC on
-- every newly created function, and `authenticated`/`anon` inherit it
-- through PUBLIC -- revoking from the role never touches the PUBLIC
-- grant that is actually doing the work.
--
-- The effect, before this section existed: all 57 SECURITY DEFINER
-- functions were callable by anon over /rest/v1/rpc/<name> with only
-- the publishable anon key. That included add_tokens, credit_tokens
-- and grant_vip (mint balance and VIP for any user id) and
-- set_age_cohort (promote any account to 'adult', which is the single
-- gate standing between the 16+ floor and NSFW content).
--
-- Keep this block at the end of the file: it revokes across the whole
-- schema, so anything created after it stays open.
-- ═════════════════════════════════════════════════════════════════════

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Functions added later default to closed rather than open.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Server-side code holding the service_role key drives everything the
-- browser is not allowed to call directly.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Granted back by name: exactly what a browser session calls. The
-- admin entries are safe to expose because each gates on
-- assert_current_user_admin() internally. Anything absent from this
-- list is reachable only through the service_role key.
DO $do$
DECLARE
  fn      TEXT;
  sig     TEXT;
  allowed TEXT[] := ARRAY[
    'accept_tos', 'set_own_age_cohort', 'set_nsfw_opt_in',
    'get_own_profile', 'update_profile_username', 'is_current_user_banned',
    'get_unread_notification_count', 'mark_notification_read',
    'mark_all_notifications_read',
    'claim_match', 'claim_ai_turn', 'reveal_self', 'move_on',
    'request_direct_turn', 'request_ai_nudge', 'submit_match_rating',
    'report_conversation', 'deduct_tokens', 'update_solo_session',
    'append_solo_messages',
    'assert_current_user_admin', 'list_reports', 'resolve_report',
    'list_admin_users', 'list_admin_characters', 'get_admin_stats',
    'ban_user', 'unban_user', 'expire_bans', 'admin_grant_tokens',
    'admin_set_character_flag', 'admin_delete_character'
  ];
BEGIN
  FOREACH fn IN ARRAY allowed LOOP
    FOR sig IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname,
                    pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND p.prokind = 'f'
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    END LOOP;
  END LOOP;
END
$do$;

-- Evaluated inside CHECK constraints on profiles.anonymous_pfp_url and
-- characters.avatar_url. IMMUTABLE, not SECURITY DEFINER, reads no
-- tables -- leaving it open removes any chance of an INSERT failing on
-- a privilege check.
GRANT EXECUTE ON FUNCTION public.is_safe_avatar_url(TEXT) TO PUBLIC;

-- ── Pin search_path on every function ────────────────────────────────
-- A SECURITY DEFINER function without a pinned search_path resolves
-- unqualified names against the caller's search_path. Anyone able to
-- create a schema that sorts earlier can shadow `profiles` or `matches`
-- and have the function operate on their table with owner rights.
-- pg_temp goes last so a temp table can never win resolution.
DO $do$
DECLARE
  sig TEXT;
BEGIN
  FOR sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
  END LOOP;
END
$do$;

-- Trigger functions: Postgres checks EXECUTE at CREATE TRIGGER time,
-- not each time the trigger fires, so they need no grant at all and
-- should not appear on the public API surface.
DO $do$
DECLARE
  sig TEXT;
BEGIN
  FOR sig IN
    SELECT format('%I.%I()', n.nspname, p.proname)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public' AND t.typname = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated, anon, PUBLIC', sig);
  END LOOP;
END
$do$;

-- A definer-rights view runs as its owner no matter who queries it,
-- bypassing RLS on matches and profiles. The view's own WHERE already
-- restricts to the caller's matches and profiles SELECT is row-open
-- (column-level revokes do the real work), so invoker rights change no
-- legitimate result.
ALTER VIEW public.match_partners SET (security_invoker = on);

-- ── auth.uid() per-row re-evaluation ─────────────────────────────────
-- A bare auth.uid() in a policy is re-evaluated once per candidate row.
-- Wrapping it in a scalar subquery lets the planner hoist it into an
-- InitPlan and evaluate it once per query. Semantically identical; on
-- messages and matches it is one call versus one call per row scanned.
-- Policies are rebuilt from pg_policy's own rendering, so the wrapping
-- is the only change.
DO $do$
DECLARE
  r       RECORD;
  v_qual  TEXT;
  v_check TEXT;
  v_roles TEXT;
  v_cmd   TEXT;
  v_sql   TEXT;
BEGIN
  FOR r IN
    SELECT pol.polname, cls.relname, nsp.nspname,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS withcheck,
           pol.polcmd, pol.polpermissive, pol.polroles
    FROM pg_policy pol
    JOIN pg_class     cls ON cls.oid = pol.polrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
  LOOP
    CONTINUE WHEN coalesce(r.qual, '')      !~ 'auth\.uid\(\)'
              AND coalesce(r.withcheck, '') !~ 'auth\.uid\(\)';

    v_qual  := regexp_replace(r.qual,      'auth\.uid\(\)',
                              '(SELECT auth.uid())', 'g');
    v_check := regexp_replace(r.withcheck, 'auth\.uid\(\)',
                              '(SELECT auth.uid())', 'g');

    v_cmd := CASE r.polcmd
               WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
               ELSE 'ALL' END;

    SELECT CASE
             WHEN r.polroles = '{0}'::oid[] THEN 'PUBLIC'
             ELSE (SELECT string_agg(quote_ident(rolname), ', ')
                   FROM pg_roles WHERE oid = ANY (r.polroles))
           END
      INTO v_roles;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.polname, r.nspname, r.relname);

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                    r.polname, r.nspname, r.relname,
                    CASE WHEN r.polpermissive THEN 'PERMISSIVE'
                         ELSE 'RESTRICTIVE' END,
                    v_cmd, v_roles);
    IF v_qual  IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_qual); END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_check); END IF;

    EXECUTE v_sql;
  END LOOP;
END
$do$;

-- ── Unindexed foreign keys ───────────────────────────────────────────
-- Without these, a parent-row delete or key update degrades into a
-- sequential scan of the child table to validate the constraint.
CREATE INDEX IF NOT EXISTS idx_character_ratings_user_id    ON character_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_characters_creator_id        ON characters (creator_id);
CREATE INDEX IF NOT EXISTS idx_mcs_character_id             ON match_characters_snapshot (character_id);
CREATE INDEX IF NOT EXISTS idx_messages_character_id        ON messages (character_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id           ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_match_id       ON notifications (match_id);
CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by ON platform_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id          ON reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_by          ON reports (resolved_by);
CREATE INDEX IF NOT EXISTS idx_reputation_events_match_id   ON reputation_events (match_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_match_id  ON token_transactions (match_id);

-- ── Avatar storage bucket ────────────────────────────────────────────
-- Public read is served by the storage CDN without any policy; adding a
-- broad SELECT policy would only grant the ability to enumerate every
-- object in the bucket. Writes are scoped to a folder named for the
-- uploader's uid.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152,
        ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif'];

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars'
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars'
         AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars'
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars'
         AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ═══════════════════════════════════════════════════════════════════════
-- Phase 16 — Admin panel: ban history, moderation queue, audit log
--
-- Additive only. All new tables and functions. Does not modify or
-- remove anything from prior phases.
--
-- Tables added:
--   bans             — every ban/restriction with reason + admin identity
--   moderation_queue — flagged content awaiting review
--   admin_audit_log  — every admin action, for accountability
--
-- Functions added:
--   is_current_user_admin_bool  — scalar helper for RLS policies
--   ban_user_with_reason        — ban + bans row + audit log (atomic)
--   unban_user_with_reason      — unban + deactivate bans row + audit log
--   resolve_moderation_item     — approve/remove + content action + audit log
--   list_moderation_queue       — admin-only listing
--   list_audit_log              — admin-only listing
--   list_ban_history            — admin-only listing
--   get_admin_stats_v2          — dashboard counts including new tables
-- ═══════════════════════════════════════════════════════════════════════

-- ── is_current_user_admin_bool: scalar boolean for RLS policies ──
-- assert_current_user_admin() returns a table; RLS USING/WITH CHECK
-- need a scalar. This wrapper is SECURITY DEFINER so it can read the
-- is_admin column that is REVOKE'd from authenticated/anon.
CREATE OR REPLACE FUNCTION is_current_user_admin_bool()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION is_current_user_admin_bool() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- bans — history of every ban/restriction with reason and admin identity
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  banned_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL DEFAULT '',
  banned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_bans_user_id ON bans (user_id);
CREATE INDEX IF NOT EXISTS idx_bans_active ON bans (active) WHERE active = true;

ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY bans_admin_all
  ON bans FOR ALL TO authenticated
  USING (is_current_user_admin_bool())
  WITH CHECK (is_current_user_admin_bool());

REVOKE ALL ON bans FROM anon;

-- ═══════════════════════════════════════════════════════════════════════
-- moderation_queue — flagged content awaiting admin review
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moderation_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  TEXT NOT NULL CHECK (content_type IN ('character','bounty','confession','message','bot')),
  content_id    TEXT NOT NULL,
  reported_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','removed')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mod_queue_status ON moderation_queue (status);
CREATE INDEX IF NOT EXISTS idx_mod_queue_type ON moderation_queue (content_type);

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY mod_queue_user_insert
  ON moderation_queue FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY mod_queue_user_select_own
  ON moderation_queue FOR SELECT TO authenticated
  USING (reported_by = (SELECT auth.uid()));

CREATE POLICY mod_queue_admin_all
  ON moderation_queue FOR ALL TO authenticated
  USING (is_current_user_admin_bool())
  WITH CHECK (is_current_user_admin_bool());

REVOKE ALL ON moderation_queue FROM anon;

-- ═══════════════════════════════════════════════════════════════════════
-- admin_audit_log — every admin action, for accountability
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_id   TEXT,
  target_type TEXT,
  reason      TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON admin_audit_log (occurred_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_select
  ON admin_audit_log FOR SELECT TO authenticated
  USING (is_current_user_admin_bool());

REVOKE INSERT ON admin_audit_log FROM authenticated, anon;
REVOKE UPDATE ON admin_audit_log FROM authenticated, anon;
REVOKE DELETE ON admin_audit_log FROM authenticated, anon;
REVOKE ALL ON admin_audit_log FROM anon;

-- ═══════════════════════════════════════════════════════════════════════
-- RPCs — atomic operations that check admin + write audit log
-- ═══════════════════════════════════════════════════════════════════════

-- ── ban_user_with_reason ──
-- Bans a user, records the ban with reason in the bans table, and
-- writes an audit log entry — all in one transaction.
CREATE OR REPLACE FUNCTION ban_user_with_reason(
  p_user_id     UUID,
  p_reason      TEXT DEFAULT '',
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Cannot ban an admin';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'Ban expiry must be in the future';
  END IF;

  UPDATE profiles
     SET is_banned = true,
         banned_until = p_expires_at
   WHERE id = p_user_id;

  INSERT INTO bans (user_id, banned_by, reason, expires_at)
  VALUES (p_user_id, auth.uid(), p_reason, p_expires_at);

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason)
  VALUES (auth.uid(), 'banned_user', p_user_id::text, 'user', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ban_user_with_reason(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- ── unban_user_with_reason ──
-- Lifts a ban, deactivates all active bans rows for the user, and
-- writes an audit log entry.
CREATE OR REPLACE FUNCTION unban_user_with_reason(
  p_user_id  UUID,
  p_reason   TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
     SET is_banned = false,
         banned_until = NULL
   WHERE id = p_user_id;

  UPDATE bans SET active = false WHERE user_id = p_user_id AND active = true;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason)
  VALUES (auth.uid(), 'unbanned_user', p_user_id::text, 'user', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION unban_user_with_reason(UUID, TEXT) TO authenticated;

-- ── resolve_moderation_item ──
-- Approves or removes a moderation queue item. When removing, also
-- deletes or hides the underlying content. Writes an audit log entry.
CREATE OR REPLACE FUNCTION resolve_moderation_item(
  p_item_id    UUID,
  p_resolution TEXT
) RETURNS VOID AS $$
DECLARE
  v_content_type  TEXT;
  v_content_id    TEXT;
BEGIN
  IF NOT assert_current_user_admin() THEN
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

GRANT EXECUTE ON FUNCTION resolve_moderation_item(UUID, TEXT) TO authenticated;

-- ── list_moderation_queue ──
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
  IF NOT assert_current_user_admin() THEN
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

GRANT EXECUTE ON FUNCTION list_moderation_queue(TEXT, TEXT, INT, INT) TO authenticated;

-- ── list_audit_log ──
CREATE OR REPLACE FUNCTION list_audit_log(
  p_action  TEXT DEFAULT '',
  p_limit   INT DEFAULT 50,
  p_offset  INT DEFAULT 0
) RETURNS TABLE (
  id          UUID,
  admin_id    UUID,
  action      TEXT,
  target_id   TEXT,
  target_type TEXT,
  reason      TEXT,
  metadata    JSONB,
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
   WHERE (p_action = '' OR al.action = p_action)
   ORDER BY al.occurred_at DESC
   LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION list_audit_log(TEXT, INT, INT) TO authenticated;

-- ── list_ban_history ──
CREATE OR REPLACE FUNCTION list_ban_history(
  p_user_id UUID
) RETURNS TABLE (
  id          UUID,
  banned_by   UUID,
  reason      TEXT,
  banned_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  active      BOOLEAN
) AS $$
BEGIN
  IF NOT assert_current_user_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT b.id, b.banned_by, b.reason, b.banned_at, b.expires_at, b.active
    FROM bans b
   WHERE b.user_id = p_user_id
   ORDER BY b.banned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION list_ban_history(UUID) TO authenticated;

-- ── get_admin_stats_v2 ──
-- Extends the original get_admin_stats with new table counts.
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
  reports_last_24h    INT
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

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_stats_v2() TO authenticated;
