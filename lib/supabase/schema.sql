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
  UPDATE matches
  SET user_b = auth.uid(),
      shared_pool = shared_pool * 2,
      last_activity = now()
  WHERE id = p_match_id
    AND user_b IS NULL
    AND status = 'active'
    AND user_a <> auth.uid()
  RETURNING matches.id;
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'chatty_afk_kick'
  ) THEN
    PERFORM cron.schedule(
      'chatty_afk_kick',
      '* * * * *',
      $$SELECT kick_idle_matches();$$
    );
  END IF;
END $$;

-- ── Anonymous match_partners view ──
-- Given a match row and the calling user (auth.uid()), returns the
-- OTHER participant's anonymous_username and anonymous_avatar_url.
-- reputation_tier is NULL until Phase 6 adds the column. RLS on the
-- underlying matches table already restricts who can see the row.
CREATE OR REPLACE VIEW match_partners AS
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

-- ── Rolling story summary cache (AI director tuning) ──
ALTER TABLE matches ADD COLUMN IF NOT EXISTS context_summary TEXT;

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
  m_row matches%ROWTYPE;
BEGIN
  SELECT * INTO m_row FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF m_row.user_a <> auth.uid() AND m_row.user_b <> auth.uid() THEN RETURN; END IF;
  IF m_row.status <> 'active' THEN RETURN; END IF;
  IF m_row.ai_turn_due = true THEN RETURN; END IF;

  UPDATE matches
  SET human_message_count = human_message_count + 1,
      ai_turn_due = (human_message_count + 1 >= ai_interval),
      last_human_message_at = now(),
      last_activity = now()
  WHERE id = p_match_id;

  SELECT human_message_count, ai_turn_due INTO m_row
  FROM matches WHERE id = p_match_id;

  RETURN QUERY SELECT true, m_row.human_message_count, m_row.ai_turn_due;
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
        COALESCE((v_tag_counts->v_tag)::int, 0) + 1);
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

  -- Both ratings must exist.
  IF NOT FOUND THEN RETURN; END IF;

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